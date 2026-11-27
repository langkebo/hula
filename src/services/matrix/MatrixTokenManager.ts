import type { MatrixClient } from 'matrix-js-sdk'
import { logoutExpiredSession } from '@/services/matrix/matrixClientPlatform'
import { computeBackoffDelay } from '@/utils/backoff'
import { createLogger } from '@/utils/Logger'
import { refreshAccessToken } from './MatrixTokenRefreshCoordinator'

const logger = createLogger('TokenManager')

const MIN_REFRESH_INTERVAL_MS = 30000
const RETRY_INTERVAL_MS = 30000
const MAX_RETRIES = 5

// 兼容旧引用：解析逻辑已收敛到刷新协调器（登录路径与定时刷新共用同一口径）
export { resolveTokenExpiryMs } from './MatrixTokenRefreshCoordinator'

export class MatrixTokenManager {
  private timer: ReturnType<typeof setTimeout> | null = null
  private refreshing = false
  private retryCount = 0

  /**
   * Schedule automatic token refresh `expiresInMs - 60s` before expiry.
   * Cancels any existing scheduled refresh.
   *
   * @throws Never throws (errors surface in the refresh cycle's logout path).
   */
  schedule(client: MatrixClient, refreshToken: string, expiresInMs: number): void {
    this.clear()
    if (!refreshToken || expiresInMs <= 0) return

    const refreshAt = Math.max(expiresInMs - 60000, MIN_REFRESH_INTERVAL_MS)
    logger.info(`[TokenRefresh] Scheduled refresh in ${refreshAt}ms (expiresInMs=${expiresInMs})`)

    this.timer = setTimeout(() => {
      this.refresh(client, refreshToken).catch((err) => {
        logger.error('[TokenRefresh] refresh threw uncaught error:', err)
      })
    }, refreshAt)
  }

  /**
   * Cancel any pending token refresh timer and reset retry state.
   *
   * @throws Never throws (pure cleanup, no external calls).
   */
  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.retryCount = 0
  }

  /**
   * Whether a token refresh is currently in progress.
   */
  isRefreshing(): boolean {
    return this.refreshing
  }

  /**
   * Execute a token refresh against POST /refresh.
   *
   * On success: persists new tokens and re-schedules the next refresh.
   * On 404: stops auto-refresh (server does not support it).
   * On 429 / network error: retries with exponential backoff (30s→480s, max 5 attempts).
   * On any other error: logs out the expired session.
   *
   * @throws Never throws to callers (all error paths handled internally).
   */
  private async refresh(client: MatrixClient, refreshToken: string): Promise<void> {
    if (this.refreshing) return
    this.refreshing = true

    try {
      // P-26：定时刷新与登录/恢复路径共用同一协调器，避免多窗口并发重放旧 refresh token
      // 触发服务端 reuse detection（导致全量吊销、登录后必然掉线）。
      const refreshed = await refreshAccessToken(client, client.getUserId() ?? '', refreshToken, 'tokenManager')
      this.retryCount = 0
      logger.info(
        refreshed.refreshed
          ? '[TokenRefresh] Access token refreshed successfully'
          : '[TokenRefresh] Adopted token rotated by another window'
      )
      if (refreshed.expiresInMs > 0) {
        this.schedule(client, refreshed.refreshToken, refreshed.expiresInMs)
      } else {
        logger.info('[TokenRefresh] Server returned no expiry, auto-refresh chain stops')
      }
    } catch (err: unknown) {
      const httpStatus = (err as { httpStatus?: number })?.httpStatus
      if (httpStatus === 404) {
        logger.warn('[TokenRefresh] Server does not support token refresh (404), stopping auto-refresh')
        this.clear()
        return
      }
      if (httpStatus === 429 || httpStatus === undefined) {
        this.retryCount++
        if (this.retryCount > MAX_RETRIES) {
          logger.error(`[TokenRefresh] Max retries (${MAX_RETRIES}) exceeded, logging out`)
          try {
            await logoutExpiredSession()
          } catch (cleanupErr) {
            logger.warn('Cleanup error:', cleanupErr)
          }
          return
        }
        // Exponential backoff: 30s, 60s, 120s, 240s, 480s
        const backoffMs = computeBackoffDelay({ baseDelayMs: RETRY_INTERVAL_MS, attempt: this.retryCount - 1 })
        // Respect retry_after_ms header if present (429 only)
        const retryAfterMs = (err as { data?: { retry_after_ms?: number } })?.data?.retry_after_ms
        const delay = retryAfterMs ? Math.max(retryAfterMs, RETRY_INTERVAL_MS) : backoffMs
        const reason = httpStatus === 429 ? 'Rate limited (429)' : 'Network error'
        logger.warn(`[TokenRefresh] ${reason}, retry ${this.retryCount}/${MAX_RETRIES} in ${delay}ms`)
        this.schedule(client, refreshToken, delay)
        return
      }
      logger.error(`[TokenRefresh] Refresh failed: ${err}`)
      logger.warn('[TokenRefresh] Session expired, clearing stored session')
      try {
        await logoutExpiredSession()
      } catch (cleanupErr) {
        logger.warn('Cleanup error:', cleanupErr)
      }
    } finally {
      this.refreshing = false
    }
  }
}
