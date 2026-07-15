import type { MatrixClient } from 'matrix-js-sdk'
import { logoutExpiredSession, persistRefreshedToken } from '@/services/matrix/matrixClientPlatform'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('TokenManager')

export class MatrixTokenManager {
  private timer: ReturnType<typeof setTimeout> | null = null
  private refreshing = false

  /**
   * Schedule automatic token refresh before expiry.
   *
   * @param client — MatrixClient for making the refresh request
   * @param refreshToken — current refresh token
   * @param expiresInMs — time until token expires in milliseconds
   */
  schedule(client: MatrixClient, refreshToken: string, expiresInMs: number): void {
    this.clear()
    if (!refreshToken || expiresInMs <= 0) return

    const effectiveExpiry = expiresInMs < 1000 ? expiresInMs * 1000 : expiresInMs
    const refreshAt = Math.max(effectiveExpiry - 60000, 30000)
    logger.info(`[TokenRefresh] Scheduled refresh in ${refreshAt}ms (expiresInMs=${expiresInMs})`)

    this.timer = setTimeout(() => {
      void this.refresh(client, refreshToken)
    }, refreshAt)
  }

  /**
   * Cancel any pending token refresh timer.
   */
  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  /**
   * Whether a token refresh is currently in progress.
   */
  isRefreshing(): boolean {
    return this.refreshing
  }

  /**
   * Attempt to refresh the access token.
   *
   * Handles 404 (unsupported), 429 (rate-limited retry),
   * and fatal errors (session expiry).
   */
  private async refresh(client: MatrixClient, refreshToken: string): Promise<void> {
    if (this.refreshing) return
    this.refreshing = true

    try {
      logger.info('[TokenRefresh] Attempting token refresh')
      const result = (await client.http.request('POST', '/_matrix/client/v3/refresh', undefined, {
        refresh_token: refreshToken
      })) as Record<string, unknown>

      const newAccessToken = result.access_token as string | undefined
      const newRefreshToken = result.refresh_token as string | undefined
      let newExpiresInMs = result.expires_in_ms as number | undefined
      const expiresInSec = result.expires_in as number | undefined
      if (!newExpiresInMs && expiresInSec) {
        newExpiresInMs = expiresInSec * 1000
      }

      if (newAccessToken) {
        const uid = client.getUserId()
        if (uid) {
          await persistRefreshedToken(uid, newAccessToken, newRefreshToken ?? '')
        }
        logger.info('[TokenRefresh] Access token refreshed successfully')
        this.schedule(client, newRefreshToken ?? refreshToken, newExpiresInMs ?? 0)
      }
    } catch (err: unknown) {
      const httpStatus = (err as { httpStatus?: number })?.httpStatus
      if (httpStatus === 404) {
        logger.warn('[TokenRefresh] Server does not support token refresh (404), stopping auto-refresh')
        this.clear()
        return
      }
      if (httpStatus === 429) {
        logger.warn('[TokenRefresh] Rate limited (429), retrying in 30s')
        this.schedule(client, refreshToken, 30000)
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
