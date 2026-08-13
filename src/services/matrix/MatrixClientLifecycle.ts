/**
 * MatrixClientLifecycle — 客户端生命周期协作类
 *
 * 承载 MatrixClientService 的生命周期相关职责：
 * - initialize：客户端重建/复用决策、监听器清理、AvatarUtils 解析器注册
 * - startClient / stopClient：幂等启动与停止
 * - forceReconnect：系统恢复后重连
 * - waitForClientReady / waitForSlidingSyncReady：就绪等待
 * - resolveDeviceIdByWhoami：token 登录前预解析 deviceId
 *
 * 通过 deps 注入主类持有的协作模块（connectionManager / eventRouter /
 * syncManager / cryptoTracker / tokenManager / startClientGuard），
 * 不再让主类直接承载这些方法的实现细节。
 */
import { useI18nGlobal } from '@/services/i18n'
import { setupSystemResumeListener } from '@/services/matrix/matrixClientPlatform'
import type { MatrixClient } from '@/services/matrix/sdk'
import { PendingEventOrdering } from '@/types/matrix-js-sdk'
import { AvatarUtils } from '@/utils/AvatarUtils'
import type { IdempotencyGuard } from '@/utils/ExecutionGuard'
import { createLogger } from '@/utils/Logger'
import type { MatrixClientConfig, MatrixConnectionManager } from './MatrixConnectionManager'
import type { MatrixCryptoStateTracker } from './MatrixCryptoStateTracker'
import type { MatrixEventRouter } from './MatrixEventRouter'
import type { MatrixSyncManager } from './MatrixSyncManager'
import type { MatrixTokenManager } from './MatrixTokenManager'
import { PREFIX_V3 } from './paths'

const logger = createLogger('MatrixClient')

type StartClientOptions = Parameters<MatrixClient['startClient']>[0]

/** Lifecycle 子服务依赖的主类协作模块集合 */
export interface MatrixClientLifecycleDeps {
  readonly connectionManager: MatrixConnectionManager
  readonly eventRouter: MatrixEventRouter
  readonly syncManager: MatrixSyncManager
  readonly cryptoTracker: MatrixCryptoStateTracker
  readonly tokenManager: MatrixTokenManager
  readonly startClientGuard: IdempotencyGuard
}

/**
 * 客户端生命周期协作类。
 *
 * 不持有自己的可变状态——所有状态都委托给 deps 中的协作模块，
 * 由 MatrixClientService 单例保证全局唯一性。
 */
export class MatrixClientLifecycle {
  constructor(private readonly deps: MatrixClientLifecycleDeps) {}

  /**
   * Initialize the Matrix client with the provided config.
   *
   * Detaches old event listeners, resets crypto debug state, and delegates
   * client creation + accessor setup to MatrixConnectionManager.
   *
   * @throws {Error} if client creation fails.
   */
  async initialize(config: MatrixClientConfig): Promise<void> {
    const { connectionManager, eventRouter, syncManager, cryptoTracker, startClientGuard } = this.deps

    // 记录 initialize 前的 client 引用，用于检测 fallback 重建
    const previousClient = connectionManager.getClient()

    // 仅当不会复用现有 client 时才 detach 监听器 / 停止 sync / 重置 crypto。
    // 复用路径若先 detach，已挂载的事件路由会丢失（eventRouter.setup 仅在 startClient 重挂）。
    if (!connectionManager.shouldReuse(config)) {
      const observed = eventRouter.getObservedClient()
      if (observed) {
        eventRouter.detach(observed, syncManager)
      }
      syncManager.stop()
      cryptoTracker.resetState()
      // 重建 client 时重置启动守卫，允许新 client 重新走 startClient 流程
      startClientGuard.reset()
    }
    await connectionManager.initialize(config)

    // Fallback 重建检测：shouldReuse 判定复用（身份匹配，仅 token 变化），
    // 但 connectionManager.initialize 内部 setAccessToken 失败回退到 rebuild。
    // 此时 client 引用已变更，但 facade 未 detach 旧监听器 → 需要补做清理。
    const currentClient = connectionManager.getClient()
    if (previousClient && currentClient && previousClient !== currentClient && startClientGuard.isSettled) {
      logger.warn('检测到 setAccessToken fallback 重建，清理旧 client 监听器与启动状态')
      eventRouter.detach(previousClient, syncManager)
      syncManager.stop()
      cryptoTracker.resetState()
      startClientGuard.reset()
    }

    // Register mxc:// resolver so AvatarUtils can convert Matrix media URIs.
    // Use client.mxcUrlToHttp() directly to avoid circular dependency with MatrixMediaService.
    const client = connectionManager.getClient()
    if (client) {
      AvatarUtils.setMxcResolver((mxcUrl, width, height) => {
        // 防护：登录失败或 client 未完全初始化时 mxcUrlToHttp 可能不存在
        const resolver = client.mxcUrlToHttp
        if (typeof resolver !== 'function') return null
        try {
          if (width && height) {
            return resolver.call(client, mxcUrl, width, height, 'scale')
          }
          return resolver.call(client, mxcUrl)
        } catch {
          return null
        }
      })
    }
  }

  /**
   * 启动客户端（幂等）。
   *
   * 通过 IdempotencyGuard 实现：
   * - settled 短路：已成功启动后再次调用直接返回
   * - in-flight 复用：并发调用共享同一 Promise
   */
  async startClient(): Promise<void> {
    return this.deps.startClientGuard.run(() => this.doStartClient())
  }

  private async doStartClient(): Promise<void> {
    const { connectionManager, eventRouter, syncManager, cryptoTracker } = this.deps
    const client = connectionManager.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    // setupSystemResumeListener 返回 void（不提供取消订阅 API），
    // 用 wrapper 适配 ConnectionManager.setupResumeListener 要求的 `() => () => void` 契约。
    connectionManager.setupResumeListener(
      () => {
        const currentClient = connectionManager.getClient()
        if (currentClient && connectionManager.getConnectionState() === 'CONNECTED') {
          this.forceReconnect()
        }
      },
      (cb: () => void) => {
        setupSystemResumeListener(cb)
        return () => {}
      }
    )

    try {
      const startOpts: StartClientOptions = {
        initialSyncLimit: 20,
        pendingEventOrdering: PendingEventOrdering.Detached
      }

      const config = connectionManager.getConfig()
      if (config?.accessToken) {
        // Sliding Sync 端点探测：若服务器不支持 Sliding Sync，不注入 slidingSync 实例，
        // SDK 会自动降级到传统 /sync 端点，避免 404 反复重试导致 sync 永不 prepared。
        let slidingSyncSupported = true
        try {
          slidingSyncSupported = await client.isSlidingSyncSupported()
        } catch (probeErr) {
          // 探测失败时保守降级为不使用 SlidingSync，避免 sync 卡死
          logger.warn('Sliding Sync 端点探测失败，降级到 /sync:', probeErr)
          slidingSyncSupported = false
        }

        if (slidingSyncSupported) {
          if (!syncManager.get()) {
            syncManager.create(client, config)
          }
          syncManager.resetReady()
          startOpts.slidingSync = syncManager.get()!
        } else {
          // 降级：销毁可能存在的旧 SlidingSync 实例，走传统 /sync
          logger.warn('Sliding Sync 不可用，降级到传统 /sync 端点')
          syncManager.stop()
        }
      } else {
        syncManager.stop()
      }

      await cryptoTracker.ensureCrypto(client, !!config?.accessToken)

      eventRouter.setSyncStateHandler((state, prevState, data) => {
        const result = connectionManager.mapSyncState(state, prevState, data)
        if (result.connectionState) {
          connectionManager.updateConnectionState(result.connectionState)
        }
        if (result.isReady) {
          syncManager.markReady()
        }
      })
      eventRouter.setLifecycleErrorHandler((err) => {
        connectionManager.handleSyncLifecycleError(err)
      })
      eventRouter.setLifecycleResetHandler(() => {
        connectionManager.resetSyncErrorCount()
      })
      eventRouter.setEventDecryptedHandler((event, err) => {
        cryptoTracker.handleEventDecrypted(event, err)
      })

      eventRouter.setup(client, syncManager)
      await client.startClient(startOpts)

      logger.info('客户端启动成功')
    } catch (err) {
      connectionManager.updateConnectionState('ERROR')
      const errorMessage = err instanceof Error ? err.message : '客户端启动失败'
      logger.error(errorMessage, err)
      throw err
    }
  }

  /** 停止客户端并清理监听器
   */
  async stopClient(): Promise<void> {
    const { connectionManager, eventRouter, syncManager, tokenManager, startClientGuard } = this.deps
    try {
      tokenManager.clear()
      const client = connectionManager.getClient()
      if (client) {
        eventRouter.detach(client, syncManager)
        syncManager.stop()
        client.stopClient()
        AvatarUtils.setMxcResolver(null)
        connectionManager.updateConnectionState('DISCONNECTED')
        // 重置启动守卫，允许下次 startClient 重新初始化
        startClientGuard.reset()
        logger.info('客户端已停止')
      }
    } catch (err) {
      logger.error('停止客户端失败:', err)
      throw err
    }
  }

  private async forceReconnect(): Promise<void> {
    const { connectionManager, eventRouter, syncManager } = this.deps
    const client = connectionManager.getClient()
    if (!client) return

    try {
      logger.info('[LIFECYCLE] Stopping current sync for reconnect')
      client.stopClient()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      connectionManager.updateConnectionState('RECONNECTING')

      // 关键修复：必须先 detach 旧监听器 + 销毁 terminated SlidingSync 实例，
      // 否则 slidingSync.stop() 设置的 terminated=true 会导致新 start() 立即退出，
      // sync 永不重启；同时 removeAllListeners 会让事件监听器全部丢失。
      eventRouter.detach(client, syncManager)
      syncManager.stop()

      const startOpts: StartClientOptions = {
        initialSyncLimit: 10,
        pendingEventOrdering: PendingEventOrdering.Detached
      }

      const config = connectionManager.getConfig()
      if (config?.accessToken) {
        // 探测 Sliding Sync 端点（与 startClient 保持一致）
        let slidingSyncSupported = true
        try {
          slidingSyncSupported = await client.isSlidingSyncSupported()
        } catch (probeErr) {
          logger.warn('[LIFECYCLE] Sliding Sync 探测失败，降级到 /sync:', probeErr)
          slidingSyncSupported = false
        }

        if (slidingSyncSupported) {
          // 创建全新的 SlidingSync 实例（terminated=false，监听器干净）
          syncManager.create(client, config)
          syncManager.resetReady()
          startOpts.slidingSync = syncManager.get()!
        }
      }

      // 重新注册所有 handler（与 startClient 一致）
      eventRouter.setSyncStateHandler((state, prevState, data) => {
        const result = connectionManager.mapSyncState(state, prevState, data)
        if (result.connectionState) {
          connectionManager.updateConnectionState(result.connectionState)
        }
        if (result.isReady) {
          syncManager.markReady()
        }
      })
      eventRouter.setup(client, syncManager)

      // await！原实现不 await 会导致异步错误被静默吞没
      await client.startClient(startOpts)
      logger.info('[LIFECYCLE] Sync restarted after system resume')
    } catch (error) {
      logger.error('[LIFECYCLE] Failed to reconnect Matrix sync:', error)
      connectionManager.updateConnectionState('ERROR')
    }
  }

  /** 等待客户端就绪
   */
  async waitForClientReady(opts?: { timeoutMs?: number; intervalMs?: number }): Promise<MatrixClient> {
    return this.deps.connectionManager.waitForClientReady(opts)
  }

  /** 等待 SlidingSync 就绪
   */
  async waitForSlidingSyncReady(timeoutMs: number = 10000): Promise<boolean> {
    return this.deps.syncManager.waitForReady(timeoutMs)
  }

  /**
   * 通过 whoami 端点（带 token 的直接 HTTP 调用，无需已初始化的 MatrixClient）
   * 解析 access token 绑定的 deviceId，用于 token 登录 / 会话恢复时一次性确定稳定设备 ID，
   * 避免「先建 client 再发现 deviceId 又重建」的泄漏与重复 E2EE 查询。
   */
  async resolveDeviceIdByWhoami(token: string, homeserverUrl: string): Promise<string | undefined> {
    const { getRuntimeAwareFetch } = await import('@/services/matrix/network/runtimeFetch')
    const runtimeFetch = getRuntimeAwareFetch()
    const url = `${homeserverUrl.replace(/\/+$/, '')}${PREFIX_V3}/account/whoami`
    try {
      const response = await runtimeFetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        logger.warn(`whoami 预解析 deviceId 失败 (status=${response.status})，回退 SDK 默认设备`)
        return undefined
      }
      const data = (await response.json()) as { device_id?: string | null; user_id?: string | null }
      return data.device_id ?? undefined
    } catch (err) {
      logger.warn('whoami 预解析 deviceId 异常，回退 SDK 默认设备', err)
      return undefined
    }
  }
}
