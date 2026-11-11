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
import { resolveMxcToHttp } from '@/services/matrix/media/mxcUrl'
import type { MatrixClient } from '@/services/matrix/sdk'
import { PendingEventOrdering } from '@/types/matrix-js-sdk'
import { AvatarUtils } from '@/utils/AvatarUtils'
import type { IdempotencyGuard } from '@/utils/ExecutionGuard'
import { createLogger } from '@/utils/Logger'
import type { MatrixClientConfig, MatrixConnectionManager } from './MatrixConnectionManager'
import type { MatrixCryptoStateTracker } from './MatrixCryptoStateTracker'
import type { MatrixEventRouter } from './MatrixEventRouter'
import { MatrixReconnectCoordinator } from './MatrixReconnectCoordinator'
import type { MatrixSyncManager } from './MatrixSyncManager'
import type { MatrixTokenManager } from './MatrixTokenManager'
import { PREFIX_V3 } from './paths'

const logger = createLogger('MatrixClient')

type StartClientOptions = Parameters<MatrixClient['startClient']>[0]

/** Sliding Sync 端点探测超时（ms）：探测挂起时降级到传统 /sync，避免 startClient 卡死 */
const SLIDING_SYNC_PROBE_TIMEOUT_MS = 5_000

/** Lifecycle 子服务依赖的主类协作模块集合 */
interface MatrixClientLifecycleDeps {
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
  /** 系统唤醒重连协调器（single-flight + 指数退避，H-11）。 */
  private readonly reconnectCoordinator: MatrixReconnectCoordinator

  constructor(private readonly deps: MatrixClientLifecycleDeps) {
    // 必须在构造函数体内构造：字段初始化器会早于参数属性赋值执行，
    // 此时 `this.deps` 仍为 undefined。
    this.reconnectCoordinator = new MatrixReconnectCoordinator(deps)
  }

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
    // 走 media/mxcUrl 的单一事实源（SDK 的 mxcUrlToHttp 在 ProfileManager 上，不在 MatrixClient 上）；
    // 该模块是叶子依赖，不会与 MatrixMediaService 形成循环引用。
    const client = connectionManager.getClient()
    if (client) {
      AvatarUtils.setMxcResolver((mxcUrl, width, height) => resolveMxcToHttp(client, mxcUrl, width, height))
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

  /**
   * 探测 Sliding Sync 端点是否可用，带超时保护。
   *
   * 根因（2026-08-25）：`client.isSlidingSyncSupported()` 在服务器端点不响应时会挂起
   * （日志中 08:46:08 → 08:46:23 无任何输出，startClient 被卡约 15s 直到 settlePostLoginStartup 超时）。
   * 加 5s 超时兜底：超时即降级到传统 /sync，避免整个启动流程被探测拖死。
   */
  private probeSlidingSyncSupport(client: MatrixClient): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          logger.warn(`Sliding Sync 端点探测超过 ${SLIDING_SYNC_PROBE_TIMEOUT_MS}ms，降级到传统 /sync`)
          resolve(false)
        }
      }, SLIDING_SYNC_PROBE_TIMEOUT_MS)

      client.isSlidingSyncSupported().then(
        (supported) => {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            resolve(supported)
          }
        },
        () => {
          if (!settled) {
            settled = true
            clearTimeout(timer)
            resolve(false)
          }
        }
      )
    })
  }

  private async doStartClient(): Promise<void> {
    const { connectionManager, eventRouter, syncManager, cryptoTracker } = this.deps
    const client = connectionManager.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    // setupSystemResumeListener 返回取消订阅函数，直接满足
    // ConnectionManager.setupResumeListener 的 `() => () => void` 契约；
    // 重复调用会先清理旧监听器，避免系统唤醒触发 N 次重连。
    connectionManager.setupResumeListener(
      () => {
        const currentClient = connectionManager.getClient()
        if (currentClient && connectionManager.getConnectionState() === 'CONNECTED') {
          this.reconnectCoordinator.forceReconnect()
        }
      },
      (cb: () => void) => setupSystemResumeListener(cb)
    )

    try {
      const startOpts: StartClientOptions = {
        initialSyncLimit: 20,
        pendingEventOrdering: PendingEventOrdering.Detached,
        // SDK 的 supportsThreads() 直接读 startClient 传入的 opts（clientOpts），
        // 不开此开关则 room.getThread() 恒为 null、/relations 线程内容不进入 SDK（D14）。
        threadSupport: true
      }

      const config = connectionManager.getConfig()
      if (config?.accessToken) {
        // Sliding Sync 端点探测：若服务器不支持 Sliding Sync，不注入 slidingSync 实例，
        // SDK 会自动降级到传统 /sync 端点，避免 404 反复重试导致 sync 永不 prepared。
        let slidingSyncSupported = true
        try {
          slidingSyncSupported = await this.probeSlidingSyncSupport(client)
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

      // crypto 后端随 startClient 建立；这里只做引导，不阻塞启动。
      const { startE2EE } = await import('./crypto/e2eeStartup')
      void startE2EE()

      // VoIP 服务初始化：注册 Call.incoming / Call.hangup / Call.replaced 监听器
      const { matrixVoIPService } = await import('./media/MatrixVoIPService')
      await matrixVoIPService.initialize()

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
    const { connectionManager, eventRouter, syncManager, tokenManager, cryptoTracker, startClientGuard } = this.deps
    try {
      tokenManager.clear()
      // 必须先注销系统唤醒监听器，否则下次 startClient 会叠加新的监听器。
      connectionManager.cleanupResumeListener()
      const client = connectionManager.getClient()
      if (client) {
        eventRouter.detach(client, syncManager)
        syncManager.stop()
        try {
          client.stopClient()
        } finally {
          // D9：SDK 的 stopClient() 会停掉 crypto 并清空 `cryptoBackend`
          // （node_modules/matrix-js-sdk/lib/client-lifecycle-stop.js 的 releaseCryptoBackend），
          // 但 tracker 是窗口级单例、不随 client 变化 —— 不重置就会留下
          // 「initialized=true，而 getCrypto() 已是 undefined」的脱钩状态。
          // 放在 finally 里：即使停止过程抛错，旧绑定也不可再信。
          cryptoTracker.resetState()
        }
        const { stopE2EE } = await import('./crypto/e2eeStartup')
        stopE2EE()
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
   * 解析 access token 绑定的 identity（userId + deviceId）。
   *
   * 用途：
   * - token 登录 / 会话恢复时一次性确定稳定设备 ID，避免「先建 client 再发现 deviceId 又重建」；
   * - 冷启动时本地 uid 丢失（store / 后端记录缺失）但 token 仍有效，用 whoami 恢复身份，
   *   否则会话恢复会静默返回、页面停在「已登录但无 client」（D2/D12）。
   *
   * 失败返回空对象（调用方据此如实报错，不伪造身份）。
   */
  async resolveIdentityByWhoami(token: string, homeserverUrl: string): Promise<{ userId?: string; deviceId?: string }> {
    const { getRuntimeAwareFetch } = await import('@/services/matrix/network/runtimeFetch')
    const runtimeFetch = getRuntimeAwareFetch()
    const url = `${homeserverUrl.replace(/\/+$/, '')}${PREFIX_V3}/account/whoami`
    try {
      const response = await runtimeFetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!response.ok) {
        logger.warn(`whoami 预解析 identity 失败 (status=${response.status})`)
        return {}
      }
      const whoami = (await response.json()) as { device_id?: string | null; user_id?: string | null }
      return {
        ...(whoami.user_id ? { userId: whoami.user_id } : {}),
        ...(whoami.device_id ? { deviceId: whoami.device_id } : {})
      }
    } catch (err) {
      logger.warn('whoami 预解析 identity 异常', err)
      return {}
    }
  }

  /**
   * 通过 whoami 端点解析 access token 绑定的 deviceId，
   * 用于 token 登录 / 会话恢复时一次性确定稳定设备 ID。
   */
  async resolveDeviceIdByWhoami(token: string, homeserverUrl: string): Promise<string | undefined> {
    const identity = await this.resolveIdentityByWhoami(token, homeserverUrl)
    if (!identity.deviceId) {
      logger.warn('whoami 未返回 deviceId，回退 SDK 默认设备')
    }
    return identity.deviceId
  }
}
