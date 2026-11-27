import { emit } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useWindow } from '@/composables/common/useWindow'
import { stopPresenceHeartbeat } from '@/composables/user/usePresenceHeartbeat'
import { EventEnum, TauriCommand } from '@/enums'
import { clearMatrixSessionEndpointConfig } from '@/services/backend/config'
import { matrixVerificationService } from '@/services/matrix/crypto/MatrixVerificationService'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { matrixWsBridge } from '@/services/matrix/MatrixWsBridge'
import { patchMatrixSessionSnapshot } from '@/services/matrix/matrixSessionState'
import { clearDndMirrorCache } from '@/services/matrix/notifications/dndMirror'
import { clearInvitePolicyCache } from '@/services/matrix/user/invitePolicy'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import { lockSecretChatSession, stopSecretChatAutoLock } from '@/stores/domains/settings/secretChatSession'
import { createLogger } from '@/utils/Logger'
import { removeUserEncryptedMediaCache } from '@/utils/PathUtil'
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

      // 未读账本（sessionUnread，含 lastReadActiveTimeStore）的清除点在这里，而不是 bootstrap：
      // bootstrap 在每次冷启动自动登录时都会跑，清掉它会让跨重启的已读纠正只生效一次。
      // 这里是显式登出 / 账号重置路径，与 preserveTokens 无关：即使保留令牌，本地未读账本也随
      // 当前会话一起作废（换账号后旧 uid 的数据本就不会被新账号读到，这里是主动回收）。
      localStorage.removeItem('sessionUnread')

      // 邀请策略缓存按 userId 隔离，登出必须回收当前账号那一条：
      // 否则同设备换账号后仍可能读到上一个账号的策略（与未读账本同理，主动回收）。
      clearInvitePolicyCache(port.matrix.getUserId())

      // 加密附件解密后的明文按账号落盘（userData/{uid}/encrypted-media），登出必须整目录回收：
      // 否则同设备换账号后，上一个账号的图片/音视频明文仍留在磁盘上。
      await removeUserEncryptedMediaCache(port.matrix.getUserId() || '')

      // DND 镜像是设备级 key（跨会话存在）。登出必须整体回收：镜像里较新的 updatedAt
      // 会在「本地新者胜」规则下，把下一个账号的服务端勿扰窗口永久挡住。
      clearDndMirrorCache()

      // 私密聊天解锁态（含 dbKey）是模块级单例，必须随当前会话一起上锁并停掉巡检：
      // 否则同一 webview 换账号后「已解锁」会被继承，新账号可直接读到私密房内容。
      lockSecretChatSession('退出登录')
      stopSecretChatAutoLock()

      if (!preserveTokens) {
        localStorage.removeItem('user')
        localStorage.removeItem('TOKEN')
        localStorage.removeItem('REFRESH_TOKEN')
        await invokeWithErrorHandler(TauriCommand.REMOVE_TOKENS)
      }
      patchMatrixSessionSnapshot({
        userId: null,
        deviceId: null,
        homeserverUrl: null
      })
      clearMatrixSessionEndpointConfig()

      port.setting.closeAutoLogin()
      port.user.clearUser()
      // 群/成员缓存（membersMap + groupInfoMap + 成员加载错误映射）必须随登出一起丢弃：
      // 此前只有登录 bootstrap 会清 membersMap，登出到下次登录之间旧账号成员仍留在内存，
      // 且 `memberLoadErrors` 两处都没清 ⇒ 换账号后进同一 roomId 会看到上个账号的失败横幅。
      // 消息缓存（messageMap / messageOptions / 排序键 / 回复映射 / 未读计数 / 撤回态）
      // 同样按账号作废：此前只在登录 bootstrap 删 localStorage 分片，登出后旧账号消息仍在内存。
      port.chat.clearMessages()
      port.group.clearGroupStore()
      port.group.clearGroupDetails()
      port.global.updateCurrentSessionRoomId('')
      // 位置/信标状态是模块级单例（含到期定时器与后台上报链）：登出必须停止并清空，
      // 否则同一 webview 换账号后仍会为旧账号继续共享位置。
      port.location.reset()

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

    // 清除会话检查缓存，下次导航重新走 IPC
    this.state.cachedHasSession = null

    // ⚠️ 原先这里还会调 `matrixWorkerHost.clearStores()`，并注释承诺「清除 IndexedDB store /
    // legacy crypto store / rust-crypto store」。Batch 3.2 取证确认该消息在 worker 侧是
    // `if (state.client)` 的 no-op（worker 从不持有 client）⇒ 承诺从未兑现。**已删除该调用**，
    // 不再用一个空操作冒充 store 清理；账号/设备切换时的真实 store 清理由
    // `MatrixCryptoStateTracker`（按 userId+deviceId 判据）与 `resetLocalSessionState` 承担。
    const cleanupAndTerminate = async () => {
      try {
        await matrixWorkerHost.resetSearchIndex()
      } catch (err) {
        logger.warn(`登出时清理本地数据失败: ${err}`)
      } finally {
        matrixWorkerHost.terminate('logout')
      }
    }
    // P-12：必须等搜索索引重置完成再 terminate，否则 resetSearchIndex 会在 worker
    // 已终止之后继续发请求，抛出「worker 未启动，先调用 start()」并使 flush 报写入失败。
    await cleanupAndTerminate()
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

    try {
      await port.matrix.logout()
    } catch (err) {
      // token 已被服务端吊销时，/logout 自身也会返回 401；本地会话必须照常完成清理并回到登录页，
      // 否则应用会卡在「已无有效 token 但仍在主界面反复 401」的故障态（P-01）。
      logger.warn(`登出请求失败，继续清理本地会话: ${err}`)
    } finally {
      // D11：登出必须丢弃所有已登记/进行中的验证事务，避免下一次登录
      // 仍能从残留的 transactionId 里「取第一条」并操作旧请求。
      matrixVerificationService.reset()
    }

    if (isDesktop()) {
      port.global.setTrayMenuShow(false)
      // P-11：打开登录窗口前先停掉旧 client。否则登录窗口沿用的旧 token 仍会触发
      // sync/refresh 并持续 401，在登录页弹出复用失效凭证的红色重试横幅。
      try {
        await port.matrix.stopClient()
      } catch (err) {
        logger.warn(`登出时停止 Matrix client 失败: ${err}`)
      }
      try {
        await createWebviewWindow('登录', 'login', 420, 580, undefined, false, 420, 580)
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
