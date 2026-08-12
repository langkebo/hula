import { emit } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useWindow } from '@/composables/common/useWindow'
import { stopPresenceHeartbeat } from '@/composables/user/usePresenceHeartbeat'
import { EventEnum, TauriCommand } from '@/enums'
import { clearMatrixSessionEndpointConfig } from '@/services/backend/config'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { matrixWsBridge } from '@/services/matrix/MatrixWsBridge'
import { patchMatrixSessionSnapshot } from '@/services/matrix/matrixSessionState'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import { createLogger } from '@/utils/Logger'
import { isDesktop, isMac } from '@/utils/PlatformConstants'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'
import type {
  LogoutMatrixRuntimeSessionOptions,
  ResetMatrixRuntimeSessionOptions,
  SessionRuntimeHost,
  SessionRuntimeState
} from './sessionRuntimeInternal'

const logger = createLogger('SessionLogoutService')

/**
 * Logout and local session reset: stop presence / WS / worker pipelines,
 * clear local storage and caches, remove tokens, and trigger the desktop
 * login window transition.
 */
export class SessionLogoutService {
  constructor(
    private readonly host: SessionRuntimeHost,
    private readonly state: SessionRuntimeState
  ) {}

  /**
   * Reset the local runtime session state without server interaction.
   *
   * @throws {Error} if token removal or state cleanup fails.
   */
  async resetLocalSessionState(options: ResetMatrixRuntimeSessionOptions = {}): Promise<void> {
    const port = this.host.port
    try {
      const { preserveTokens = false } = options

      // 重置 bootstrap 幂等守卫，确保下次登录能重新执行 bootstrap pipeline
      this.state.bootstrapGuard.reset()

      if (!preserveTokens) {
        localStorage.removeItem('user')
        localStorage.removeItem('TOKEN')
        localStorage.removeItem('REFRESH_TOKEN')
        await invokeWithErrorHandler(TauriCommand.REMOVE_TOKENS)
      }
      patchMatrixSessionSnapshot({
        userId: null,
        deviceId: null,
        accessToken: null,
        homeserverUrl: null
      })
      clearMatrixSessionEndpointConfig()

      port.setting.closeAutoLogin()
      port.user.clearUser()
      port.global.updateCurrentSessionRoomId('')

      if (isMac()) {
        const homeWindow = await WebviewWindow.getByLabel('home')
        if (homeWindow) {
          await homeWindow.setBadgeCount(undefined)
        }
      }
    } catch (err) {
      logger.error(`重置本地会话状态失败: ${err}`)
      throw err
    }
  }

  /**
   * Log out the current session: stop presence, clear state, and optionally reset all local data.
   *
   * @throws {Error} if resetLocalSessionState or the underlying logout request fails.
   */
  async logoutCurrentSession(options: LogoutMatrixRuntimeSessionOptions = {}): Promise<void> {
    const port = this.host.port
    const { resetLocalState = true, preserveTokens = false } = options
    const { resizeWindow, createWebviewWindow } = useWindow()

    stopPresenceHeartbeat()
    matrixWsBridge.stop()

    // 清理 presence 变化回调，避免登出后残留监听器导致重复处理
    if (this.state.presenceChangeCleanup) {
      this.state.presenceChangeCleanup()
      this.state.presenceChangeCleanup = null
    }

    // 清除会话检查缓存，下次导航重新走 IPC
    this.state.cachedHasSession = null

    const cleanupAndTerminate = async () => {
      try {
        await matrixWorkerHost.resetSearchIndex()
      } catch (err) {
        logger.warn(`登出时清理搜索索引失败: ${err}`)
      } finally {
        matrixWorkerHost.terminate('logout')
      }
    }
    void cleanupAndTerminate()
    if (typeof window !== 'undefined' && this.state.beforeUnloadRegistered) {
      window.removeEventListener('beforeunload', this.state.onBeforeUnload)
      this.state.beforeUnloadRegistered = false
    }
    try {
      await matrixPresenceService.setPresence('unavailable')
    } catch (err) {
      logger.warn(`登出时 setPresence(unavailable) 失败：${err}`)
    }

    if (resetLocalState) {
      await this.resetLocalSessionState({
        preserveTokens
      })
    } else {
      port.global.updateCurrentSessionRoomId('')
    }

    await port.matrix.logout()

    if (isDesktop()) {
      port.global.setTrayMenuShow(false)
      try {
        await createWebviewWindow('登录', 'login', 420, 640, undefined, false, 420, 640)
        await emit(EventEnum.LOGOUT)
        await resizeWindow('tray', 130, 44)
      } catch (error) {
        logger.warn('执行桌面端退出收尾失败:', error)
      }
      return
    }

    try {
      await emit(EventEnum.LOGOUT)
    } catch (error) {
      logger.warn('执行移动端退出事件失败:', error)
    }
  }
}
