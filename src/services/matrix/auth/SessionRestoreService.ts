import { TauriCommand } from '@/enums'
import { resolveMatrixSessionEndpointConfig } from '@/services/backend/config'
import { switchUserDatabase } from '@/services/backend/tauriCommand'
import { useI18nGlobal } from '@/services/i18n'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { patchMatrixSessionSnapshot } from '@/services/matrix/matrixSessionState'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import { createLogger } from '@/utils/Logger'
import { invokeWithErrorHandler, invokeWithResult } from '@/utils/TauriInvokeHandler'
import type {
  RestoreMatrixRuntimeSessionOptions,
  SessionRuntimeHost,
  SessionRuntimeState,
  StoredMatrixTokens
} from './sessionRuntimeInternal'

const logger = createLogger('SessionRestoreService')

/**
 * Session restore logic: read stored tokens, probe authenticated sessions,
 * restore a session from an access token, and wait for Matrix sync to reach
 * PREPARED / SYNCING.
 */
export class SessionRestoreService {
  constructor(
    private readonly host: SessionRuntimeHost,
    private readonly state: SessionRuntimeState
  ) {}

  /**
   * Retrieve stored tokens from the Tauri backend.
   *
   * @throws Never throws (returns null tokens on error).
   */
  async getStoredTokens(): Promise<StoredMatrixTokens> {
    const port = this.host.port
    // 浏览器/E2E 环境：从 Pinia store（localStorage 持久化）读取 token
    if (!hasTauriRuntime()) {
      const token = port.matrix.getAccessToken()
      if (token) {
        logger.debug('从 Pinia store 恢复 WEB 端 token')
        return { token, refreshToken: null }
      }
      logger.debug('WEB 端无存储的 token')
      return { token: null, refreshToken: null }
    }
    await ensureAppStateReady()
    const result = await invokeWithResult<StoredMatrixTokens>(TauriCommand.GET_USER_TOKENS)
    if (result.isErr()) {
      logger.error(`获取存储令牌失败: ${result.error}`)
      return { token: null, refreshToken: null }
    }
    return result.value
  }

  /** 检查是否存在已认证会话
   */
  async hasAuthenticatedSession(): Promise<boolean> {
    const port = this.host.port
    try {
      // 快速路径：已登录直接返回，不走 IPC
      if (port.matrix.isLoggedIn()) {
        this.state.cachedHasSession = null
        return true
      }

      // 已初始化但未登录，无可用会话
      if (port.matrix.isInitialized()) {
        this.state.cachedHasSession = null
        return false
      }

      // 未登录+未初始化：首次走 IPC，后续导航复用缓存避免重复 IPC
      // 缓存在登出或会话恢复成功后清除
      if (this.state.cachedHasSession !== null) {
        return this.state.cachedHasSession
      }

      const tokens = await this.getStoredTokens()
      const hasSession = !!tokens.token
      this.state.cachedHasSession = hasSession
      return hasSession
    } catch (err) {
      logger.error(`检查认证会话失败: ${err}`)
      return false
    }
  }

  /**
   * Restore an authenticated session using an existing access token.
   *
   * @throws {Error} if uid or accessToken is empty.
   * @throws {Error} if session restore via loginWithToken fails.
   */
  async restoreWithAccessToken(options: RestoreMatrixRuntimeSessionOptions): Promise<void> {
    const port = this.host.port
    try {
      const {
        uid,
        accessToken,
        refreshToken,
        displayName,
        account,
        avatar,
        client,
        persistTokens = false,
        persistUserInfo = true,
        switchDatabase = true,
        bootstrapAfterRestore = false
      } = options

      if (!uid) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.user_id_missing'))
      }

      if (!accessToken) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.access_token_missing'))
      }

      const { homeserverUrl, identityServerUrl } = resolveMatrixSessionEndpointConfig()

      await ensureAppStateReady()

      if (switchDatabase) {
        await switchUserDatabase(uid)
      }

      if (persistTokens && hasTauriRuntime()) {
        await invokeWithErrorHandler(TauriCommand.UPDATE_TOKEN, {
          req: {
            uid,
            token: accessToken,
            refreshToken: refreshToken ?? ''
          }
        })
      }

      await port.matrix.initialize({
        homeserverUrl,
        identityServerUrl,
        accessToken,
        userId: uid,
        allowInsecureHttp: homeserverUrl.startsWith('http://')
      })

      const success = await port.matrix.loginWithToken(accessToken, uid, refreshToken)
      if (!success) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.session_restore_failed'))
      }
      patchMatrixSessionSnapshot({
        userId: uid,
        deviceId: this.host.getCurrentClientDeviceId(),
        accessToken,
        homeserverUrl
      })

      const resolvedDisplayName = this.host.resolveDisplayName(uid, displayName, account)
      port.user.initUserInfo(uid, resolvedDisplayName)

      if (persistUserInfo && hasTauriRuntime()) {
        await invokeWithErrorHandler(TauriCommand.SAVE_USER_INFO, {
          userInfo: {
            uid
          }
        })
      }

      if (bootstrapAfterRestore) {
        await this.host.bootstrapPostLoginState({
          account,
          displayName: resolvedDisplayName,
          avatar,
          client
        })
      }
    } catch (err) {
      logger.error(`恢复登录会话失败: ${err}`)
      throw err
    }
  }

  /**
   * Wait for Matrix sync to reach PREPARED / SYNCING state.
   * Uses event listener + polling fallback to handle the race where sync
   * may already be prepared before the listener is registered.
   */
  waitSyncPrepared(timeoutMs = 8000): Promise<void> {
    return new Promise((resolve) => {
      let settled = false

      const finish = (state: string, source: 'event' | 'poll') => {
        if (settled) return
        settled = true
        matrixClientService.off('sync', off as never)
        if (pollHandle) clearTimeout(pollHandle)
        logger.info(`waitSyncPrepared: sync 状态 ${state}（${source}），继续 bootstrap`)
        resolve()
      }

      const off = (data: unknown) => {
        const state = (data as { state?: string })?.state
        if (state === 'PREPARED' || state === 'SYNCING') {
          finish(state, 'event')
        }
      }

      // 注意：不能通过 getConnectionState() 提前返回，因为 login()/loginWithToken()
      // 会在 startClient() 之前就把 connectionState 设为 'CONNECTED'，
      // 这并不代表 sync 真正进入 PREPARED/SYNCING 状态。
      // 必须等待 SDK 的 sync 事件确认 sync 已就绪，否则后续 loadRooms/getSessionList
      // 会在 sync 未完成时执行，导致空数据或卡住。
      matrixClientService.on('sync', off as never)

      // 竞态修复：注册监听器后立即检查 getSyncState()，避免错过已触发的 sync 事件。
      // settlePostLoginStartup 中的 startClient() 可能在 bootstrapPostLoginState
      // 注册监听器之前就已经让 sync 进入 PREPARED，此时事件已错过，只靠监听会必然超时。
      // 采用轮询兜底（与 CryptoSDKAdapter.ts:508-533 一致的范式）：
      // 立即查一次，之后每 200ms 查一次，直到状态满足或超时。
      let pollHandle: ReturnType<typeof setTimeout> | undefined
      const pollSyncState = () => {
        if (settled) return
        const client = matrixClientService.getClient()
        const currentState = client?.getSyncState?.()
        if (currentState === 'PREPARED' || currentState === 'SYNCING') {
          finish(currentState, 'poll')
          return
        }
        // 继续轮询，直到超时
        pollHandle = setTimeout(pollSyncState, 200)
      }
      // 立即查一次（不等 200ms），覆盖"sync 已在注册前 prepared"的竞态
      pollSyncState()

      setTimeout(() => {
        if (settled) return
        settled = true
        matrixClientService.off('sync', off as never)
        if (pollHandle) clearTimeout(pollHandle)
        logger.warn(`waitSyncPrepared 超时 ${timeoutMs}ms，使用当前状态继续 bootstrap`)
        resolve()
      }, timeoutMs)
    })
  }
}
