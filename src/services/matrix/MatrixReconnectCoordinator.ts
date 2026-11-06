/**
 * MatrixReconnectCoordinator — 系统唤醒后的同步重连协调器。
 *
 * 从 MatrixClientLifecycle 拆出，负责：
 * - single-flight：唤醒风暴合并为一次重连；
 * - 指数退避：连续失败 1s → 2s → … → 30s 上限，成功后归零；
 * - 复用同一 client 时重建 SlidingSync、重挂事件监听、重新初始化 crypto。
 */
import type { MatrixClient } from '@/services/matrix/sdk'
import { PendingEventOrdering } from '@/types/matrix-js-sdk'
import { computeBackoffDelay, sleep } from '@/utils/backoff'
import { createLogger } from '@/utils/Logger'
import type { MatrixConnectionManager } from './MatrixConnectionManager'
import type { MatrixCryptoStateTracker } from './MatrixCryptoStateTracker'
import type { MatrixEventRouter } from './MatrixEventRouter'
import type { MatrixSyncManager } from './MatrixSyncManager'

const logger = createLogger('MatrixClient')

type StartClientOptions = Parameters<MatrixClient['startClient']>[0]

/** 系统唤醒重连退避基数（ms）。 */
const RECONNECT_BASE_DELAY_MS = 1000

/** 系统唤醒重连退避上限（ms）。 */
const RECONNECT_MAX_DELAY_MS = 30_000

interface MatrixReconnectDeps {
  readonly connectionManager: MatrixConnectionManager
  readonly eventRouter: MatrixEventRouter
  readonly syncManager: MatrixSyncManager
  readonly cryptoTracker: MatrixCryptoStateTracker
}

export class MatrixReconnectCoordinator {
  /** 进行中的系统唤醒重连任务（single-flight，H-11）。 */
  private reconnectInFlight: Promise<void> | null = null

  /** 连续重连失败次数，用于指数退避；成功后归零。 */
  private reconnectAttempt = 0

  constructor(private readonly deps: MatrixReconnectDeps) {}

  /**
   * 系统唤醒后重连（single-flight + 指数退避，H-11）。
   *
   * 系统唤醒可能同时触发多个监听器回调；这里把并发调用合并到同一个 Promise，
   * 并按连续失败次数退避（1s → 2s → … → 30s 上限），避免唤醒风暴打出并发连接。
   */
  forceReconnect(): Promise<void> {
    if (this.reconnectInFlight) {
      logger.info('[LIFECYCLE] 重连已在进行中，复用现有任务（single-flight）')
      return this.reconnectInFlight
    }

    const task = this.doForceReconnect().finally(() => {
      if (this.reconnectInFlight === task) {
        this.reconnectInFlight = null
      }
    })
    this.reconnectInFlight = task
    return task
  }

  private async doForceReconnect(): Promise<void> {
    const { connectionManager, eventRouter, syncManager, cryptoTracker } = this.deps
    const client = connectionManager.getClient()
    if (!client) return

    try {
      logger.info('[LIFECYCLE] Stopping current sync for reconnect')
      client.stopClient()
      // SDK 契约（fork ≥ `0824bb23a`，A3）：`stopClient()` 会停掉 crypto（olmMachine.close()，
      // IndexedDB 连接关闭）**并清空** `client.cryptoBackend` ⇒ 同一 client 可直接重新
      // `initRustCrypto`。下面的解绑是**兜底**（SDK 若回退成"只停不清"仍能救回 E2EE），
      // 正常时序下它看到 `getCrypto() === undefined`（no-crypto）而直接返回。
      cryptoTracker.releaseStoppedCryptoBinding(client)

      const backoffDelay = computeBackoffDelay({
        baseDelayMs: RECONNECT_BASE_DELAY_MS,
        maxDelayMs: RECONNECT_MAX_DELAY_MS,
        attempt: this.reconnectAttempt
      })
      this.reconnectAttempt += 1
      await sleep(backoffDelay)

      // 退避期间客户端可能已被 stopClient 或实例切换，此时放弃本次重连，
      // 否则会对已废弃的 client 重新 startClient，导致泄漏的连接与事件。
      if (connectionManager.getClient() !== client) {
        logger.info('[LIFECYCLE] 等待退避期间客户端已变更，放弃本次重连')
        return
      }

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

      // crypto 已随 stopClient 停止（且绑定已被 SDK 清空）⇒ 重启 sync 前必须重新初始化，
      // 否则解密/加密全失效。传 accessToken 判据与 doStartClient 一致。
      await cryptoTracker.ensureCrypto(client, !!config?.accessToken)

      // await！原实现不 await 会导致异步错误被静默吞没
      await client.startClient(startOpts)
      // 重连成功，退避计数归零（下次唤醒从 1s 起）
      this.reconnectAttempt = 0
      logger.info('[LIFECYCLE] Sync restarted after system resume')
    } catch (error) {
      logger.error('[LIFECYCLE] Failed to reconnect Matrix sync:', error)
      connectionManager.updateConnectionState('ERROR')
    }
  }
}
