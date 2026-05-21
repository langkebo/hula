import type { MatrixClient, SlidingSync } from 'matrix-js-sdk'
import { useI18nGlobal } from '@/services/i18n'
import { createLogger } from '@/utils/Logger'
import { refreshAccessToken } from './matrixClientAuth'
import { logoutExpiredSession, persistRefreshedToken, setupSystemResumeListener } from './matrixClientPlatform'
import { createStartClientOptions } from './matrixClientSync'

const logger = createLogger('MatrixClient')

// 生命周期相关常量
const _RECONNECT_RETRY_COUNT = 10
const _RECONNECT_DELAY_MS = 1000
const INITIAL_CLIENT_RETRY_COUNT = 20
const _TOKEN_REFRESH_BUFFER_MS = 60000
const _TOKEN_REFRESH_MIN_DELAY_MS = 30000
const _CLIENT_READY_TIMEOUT_MS = 5000
const _CLIENT_READY_POLL_INTERVAL_MS = 50
const SLIDING_SYNC_READY_TIMEOUT_MS = 10000

type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR'

interface MatrixClientLifecycleDeps {
  getClient: () => MatrixClient | null
  getConfig: () => { accessToken?: string } | null
  getSlidingSync: () => SlidingSync | null
  setSlidingSync: (slidingSync: SlidingSync | null) => void
  createSlidingSync: () => SlidingSync
  getConnectionState: () => ConnectionState
  updateConnectionState: (state: ConnectionState) => void
  setupEventListeners: () => void
  detachEventListeners: (client: MatrixClient) => void
  clearObservedClient: () => void
}

export function createMatrixClientLifecycleManager(deps: MatrixClientLifecycleDeps) {
  let slidingSyncReadyResolve: (() => void) | null = null
  let slidingSyncReadyPromise: Promise<void> | null = null
  let tokenRefreshTimer: ReturnType<typeof setTimeout> | null = null
  let isRefreshingToken = false
  let resumeListenerRegistered = false

  const clearTokenRefreshTimer = (): void => {
    if (tokenRefreshTimer) {
      clearTimeout(tokenRefreshTimer)
      tokenRefreshTimer = null
    }
  }

  const resetSlidingSyncReady = (): void => {
    if (slidingSyncReadyPromise) {
      slidingSyncReadyResolve?.()
    }
    slidingSyncReadyPromise = new Promise<void>((resolve) => {
      slidingSyncReadyResolve = resolve
    })
  }

  const markSlidingSyncReady = (): void => {
    if (slidingSyncReadyResolve) {
      slidingSyncReadyResolve()
      slidingSyncReadyResolve = null
    }
  }

  const getReconnectStartOptions = (): ReturnType<typeof createStartClientOptions> => {
    let slidingSync: SlidingSync | null = null
    if (deps.getConfig()?.accessToken) {
      const currentSlidingSync = deps.getSlidingSync() ?? deps.createSlidingSync()
      deps.setSlidingSync(currentSlidingSync)
      resetSlidingSyncReady()
      slidingSync = currentSlidingSync
    }
    return createStartClientOptions(10, slidingSync)
  }

  const forceReconnect = async (): Promise<void> => {
    const client = deps.getClient()
    if (!client) return

    try {
      logger.info('[LIFECYCLE] Stopping current sync for reconnect')
      client.stopClient()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      deps.updateConnectionState('RECONNECTING')
      client.startClient(getReconnectStartOptions())
      logger.info('[LIFECYCLE] Sync restarted after system resume')
    } catch (error) {
      logger.error('[LIFECYCLE] Failed to reconnect Matrix sync:', error)
      deps.updateConnectionState('ERROR')
    }
  }

  const setupResumeListener = (): void => {
    if (resumeListenerRegistered) return
    resumeListenerRegistered = true
    setupSystemResumeListener(() => {
      if (deps.getClient() && deps.getConnectionState() === 'CONNECTED') {
        void forceReconnect()
      }
    })
  }

  const tryRefreshToken = async (refreshToken: string): Promise<void> => {
    const client = deps.getClient()
    if (isRefreshingToken || !client) return
    isRefreshingToken = true

    try {
      logger.info('[TokenRefresh] 开始刷新访问令牌')
      const {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresInMs: newExpiresInMs
      } = await refreshAccessToken(client, refreshToken)

      if (newAccessToken) {
        const uid = client.getUserId()
        if (uid) {
          await persistRefreshedToken(uid, newAccessToken, newRefreshToken ?? '')
        }
        logger.info('[TokenRefresh] 访问令牌刷新成功')
        scheduleTokenRefresh(newRefreshToken, newExpiresInMs)
      }
    } catch (err) {
      logger.error(`[TokenRefresh] 刷新访问令牌失败: ${err}`)
      logger.warn('[TokenRefresh] Session expired, clearing stored session')
      try {
        await logoutExpiredSession()
      } catch (cleanupError) {
        logger.warn(`[TokenRefresh] 登出清理失败(非关键): ${cleanupError}`)
      }
    } finally {
      isRefreshingToken = false
    }
  }

  const scheduleTokenRefresh = (refreshToken?: string, expiresInMs?: number): void => {
    clearTokenRefreshTimer()
    if (!refreshToken || !expiresInMs || expiresInMs <= 0) return

    const refreshAt = Math.max(expiresInMs - 60000, 30000)
    logger.info(`[TokenRefresh] 已调度 Token 刷新: ${refreshAt}ms 后`)
    tokenRefreshTimer = setTimeout(() => {
      void tryRefreshToken(refreshToken)
    }, refreshAt)
  }

  const startClient = async (): Promise<void> => {
    const client = deps.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }

    setupResumeListener()

    try {
      let slidingSync: SlidingSync | null = null
      if (deps.getConfig()?.accessToken) {
        const currentSlidingSync = deps.getSlidingSync() ?? deps.createSlidingSync()
        deps.setSlidingSync(currentSlidingSync)
        resetSlidingSyncReady()
        slidingSync = currentSlidingSync
      } else {
        deps.setSlidingSync(null)
      }

      const startOpts = createStartClientOptions(INITIAL_CLIENT_RETRY_COUNT, slidingSync)
      await client.startClient(startOpts)

      deps.updateConnectionState('CONNECTED')
      deps.setupEventListeners()
      logger.info('客户端启动成功')
    } catch (err) {
      deps.updateConnectionState('ERROR')
      const errorMessage = err instanceof Error ? err.message : '客户端启动失败'
      logger.error(errorMessage, err)
      throw err
    }
  }

  const stopClient = async (): Promise<void> => {
    try {
      clearTokenRefreshTimer()
      const client = deps.getClient()
      if (client) {
        deps.detachEventListeners(client)
        deps.clearObservedClient()
        deps.getSlidingSync()?.stop?.()
        client.stopClient()
        deps.updateConnectionState('DISCONNECTED')
        logger.info('客户端已停止')
      }
    } catch (err) {
      logger.error('停止客户端失败:', err)
      throw err
    }
  }

  const waitForClientReady = async (opts?: { timeoutMs?: number; intervalMs?: number }): Promise<MatrixClient> => {
    const existingClient = deps.getClient()
    if (existingClient) return existingClient

    const timeoutMs = opts?.timeoutMs ?? 5000
    const intervalMs = opts?.intervalMs ?? 50
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const currentClient = deps.getClient()
      if (currentClient) return currentClient
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    throw new Error(useI18nGlobal().t('matrix_error.client.not_ready_timeout'))
  }

  const waitForSlidingSyncReady = async (timeoutMs: number = SLIDING_SYNC_READY_TIMEOUT_MS): Promise<boolean> => {
    if (!deps.getSlidingSync()) return false
    if (!slidingSyncReadyPromise) return true

    try {
      await Promise.race([
        slidingSyncReadyPromise,
        new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Sliding Sync ready timeout')), timeoutMs))
      ])
      return true
    } catch (error) {
      logger.warn(`Wait for Sliding Sync ready failed (timeout=${timeoutMs}ms)`, { error })
      return false
    }
  }

  return {
    clearTokenRefreshTimer,
    markSlidingSyncReady,
    resetSlidingSyncReady,
    scheduleTokenRefresh,
    startClient,
    stopClient,
    waitForClientReady,
    waitForSlidingSyncReady
  }
}
