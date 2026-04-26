import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { EventEnum, TauriCommand } from '@/enums'
import { useWindow } from '@/hooks/useWindow'
import { switchUserDatabase } from '@/services/tauriCommand'
import { useConfigStore } from '@/stores/domains/settings/config'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useRoomStore } from '@/stores/domains/chat/room'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { useEmojiStore } from '@/stores/domains/chat/emoji'
import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend/config'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import { isDesktop, isMac } from '@/utils/PlatformConstants'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { SexEnum } from '@/enums'

const logger = createLogger('MatrixRuntimeSessionService')

export interface StoredMatrixTokens {
  token: string | null
  refreshToken?: string | null
}

export interface RestoreMatrixRuntimeSessionOptions {
  uid: string
  accessToken: string
  refreshToken?: string
  displayName?: string
  account?: string
  avatar?: string
  client?: 'PC' | 'MOBILE'
  persistTokens?: boolean
  persistUserInfo?: boolean
  switchDatabase?: boolean
  bootstrapAfterRestore?: boolean
}

export interface MatrixPostLoginBootstrapOptions {
  account?: string
  displayName?: string
  avatar?: string
  client?: 'PC' | 'MOBILE'
}

export interface MatrixPasswordLoginOptions extends MatrixPostLoginBootstrapOptions {
  username: string
  password: string
  homeserverUrl: string
  identityServerUrl?: string
  deviceName?: string
  persistTokens?: boolean
  persistUserInfo?: boolean
  switchDatabase?: boolean
}

export interface ResetMatrixRuntimeSessionOptions {
  preserveTokens?: boolean
}

export interface LogoutMatrixRuntimeSessionOptions extends ResetMatrixRuntimeSessionOptions {
  resetLocalState?: boolean
}

class MatrixRuntimeSessionService {
  private async ensureClientReadyForBootstrap(options: MatrixPostLoginBootstrapOptions = {}): Promise<void> {
    const matrixStore = useMatrixStore()
    const userStore = useUserStore()

    if (matrixStore.getClient()) {
      return
    }

    const uid = matrixStore.userId ?? userStore.userInfo?.uid ?? ''
    if (!uid) {
      return
    }

    const tokens = await this.getStoredTokens()
    if (!tokens.token) {
      throw new Error('缺少访问令牌，无法恢复登录会话')
    }

    const restoredClient =
      options.client ||
      (userStore.userInfo?.client === 'PC' || userStore.userInfo?.client === 'MOBILE'
        ? userStore.userInfo.client
        : undefined)

    await this.restoreWithAccessToken({
      uid,
      accessToken: tokens.token,
      refreshToken: tokens.refreshToken ?? undefined,
      displayName: options.displayName || userStore.userInfo?.name,
      account: options.account || userStore.userInfo?.account || userStore.userInfo?.email,
      avatar: options.avatar || userStore.userInfo?.avatar,
      client: restoredClient,
      persistTokens: false,
      persistUserInfo: false,
      bootstrapAfterRestore: false
    })
  }

  private resolveDisplayName(uid: string, displayName?: string, account?: string): string {
    return displayName || account || uid.split(':')[0] || uid
  }

  private clearUserLocalStorage(): void {
    const userScopedStoreKeys = ['chat', 'group', 'contacts', 'cached', 'sessionUnread']
    userScopedStoreKeys.forEach((key) => {
      localStorage.removeItem(key)
    })
    logger.debug('User localStorage has been cleared')
  }

  private clearMessageCache(): void {
    const groupStore = useGroupStore()
    for (const key of Object.keys(groupStore.membersMap)) {
      delete groupStore.membersMap[key]
    }
    logger.debug('Message cache has been cleared')
  }

  async getStoredTokens(): Promise<StoredMatrixTokens> {
    try {
      await ensureAppStateReady()
      return await invoke<StoredMatrixTokens>(TauriCommand.GET_USER_TOKENS)
    } catch (err) {
      logger.error(`获取存储令牌失败: ${err}`)
      return { token: null, refreshToken: null }
    }
  }

  async hasAuthenticatedSession(): Promise<boolean> {
    try {
      const matrixStore = useMatrixStore()
      if (matrixStore.isLoggedIn) {
        return true
      }

      if (matrixStore.isInitialized) {
        return false
      }

      const tokens = await this.getStoredTokens()
      return !!tokens.token
    } catch (err) {
      logger.error(`检查认证会话失败: ${err}`)
      return false
    }
  }

  async restoreWithAccessToken(options: RestoreMatrixRuntimeSessionOptions): Promise<void> {
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
        throw new Error('缺少用户ID，无法恢复登录会话')
      }

      if (!accessToken) {
        throw new Error('缺少访问令牌，无法恢复登录会话')
      }

      const matrixStore = useMatrixStore()
      const userStore = useUserStore()
      const { homeserverUrl, identityServerUrl } = resolveMatrixRuntimeEndpointConfig()

      await ensureAppStateReady()

      if (switchDatabase) {
        await switchUserDatabase(uid)
      }

      if (persistTokens) {
        await invoke(TauriCommand.UPDATE_TOKEN, {
          req: {
            uid,
            token: accessToken,
            refreshToken: refreshToken ?? ''
          }
        })
      }

      await matrixStore.initialize({
        homeserverUrl,
        identityServerUrl,
        accessToken,
        userId: uid,
        allowInsecureHttp: homeserverUrl.startsWith('http://')
      })

      const success = await matrixStore.loginWithToken(accessToken, uid)
      if (!success) {
        throw new Error('基于访问令牌恢复 Matrix 会话失败')
      }

      const resolvedDisplayName = this.resolveDisplayName(uid, displayName, account)
      userStore.initUserInfo(uid, resolvedDisplayName)

      if (persistUserInfo) {
        await invoke(TauriCommand.SAVE_USER_INFO, {
          userInfo: {
            uid
          }
        })
      }

      if (bootstrapAfterRestore) {
        await this.bootstrapPostLoginState({
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

  async loginWithPassword(options: MatrixPasswordLoginOptions): Promise<{ uid: string; accessToken: string }> {
    try {
      const {
        username,
        password,
        homeserverUrl,
        identityServerUrl,
        deviceName,
        account,
        displayName,
        avatar,
        client,
        persistTokens = true,
        persistUserInfo = true,
        switchDatabase = true
      } = options

      const matrixStore = useMatrixStore()

      await ensureAppStateReady()
      await matrixStore.initialize({
        homeserverUrl,
        identityServerUrl,
        allowInsecureHttp: homeserverUrl.startsWith('http://')
      })

      const success = await matrixStore.login(username, password, deviceName)
      if (!success) {
        throw new Error('登录失败，请检查账号密码')
      }

      const uid = matrixStore.userId
      const accessToken = matrixStore.accessToken
      if (!uid || !accessToken) {
        throw new Error('登录成功但会话信息不完整')
      }

      if (switchDatabase) {
        await switchUserDatabase(uid)
      }

      if (persistTokens) {
        await invoke(TauriCommand.UPDATE_TOKEN, {
          req: {
            uid,
            token: accessToken,
            refreshToken: ''
          }
        })
      }

      if (persistUserInfo) {
        await invoke(TauriCommand.SAVE_USER_INFO, {
          userInfo: {
            uid
          }
        })
      }

      await this.bootstrapPostLoginState({
        account: account || username,
        displayName,
        avatar,
        client
      })

      return {
        uid,
        accessToken
      }
    } catch (err) {
      logger.error(`密码登录失败: ${err}`)
      throw err
    }
  }

  async bootstrapPostLoginState(options: MatrixPostLoginBootstrapOptions = {}): Promise<void> {
    try {
      const configStore = useConfigStore()
      const userStore = useUserStore()
      const loginHistoriesStore = useLoginHistoriesStore()
      const matrixStore = useMatrixStore()
      const roomStore = useRoomStore()
      const groupStore = useGroupStore()
      const emojiStore = useEmojiStore()
      const uid = matrixStore.userId ?? userStore.userInfo?.uid ?? ''

      if (!uid) {
        throw new Error('缺少用户ID，无法初始化登录状态')
      }

      await this.ensureClientReadyForBootstrap(options)

      this.clearUserLocalStorage()
      this.clearMessageCache()

      roomStore.resetState()
      groupStore.groupDetails.length = 0
      await roomStore.loadRooms()

      const account = {
        uid,
        name: this.resolveDisplayName(uid, options.displayName, options.account),
        account: options.account || uid,
        email: '',
        avatar: AvatarUtils.getAvatarUrl(options.avatar),
        modifyNameChance: 0,
        sex: SexEnum.MAN,
        userStateId: '',
        avatarUpdateTime: 0,
        client: options.client || (isDesktop() ? 'PC' : 'MOBILE'),
        resume: ''
      }

      userStore.userInfo = account
      loginHistoriesStore.addLoginHistory(account)

      void emojiStore.initEmojis().catch(() => {
        logger.warn('[login] 初始化表情失败')
      })

      const cachedConfig = localStorage.getItem('config')
      if (cachedConfig) {
        configStore.config = JSON.parse(cachedConfig).config
      } else {
        await configStore.initConfig()
      }

      void emojiStore.prefetchEmojiToLocal().catch(() => {
        logger.warn('[login] 预热表情缓存失败')
      })
    } catch (err) {
      logger.error(`初始化登录状态失败: ${err}`)
      throw err
    }
  }

  async resetLocalSessionState(options: ResetMatrixRuntimeSessionOptions = {}): Promise<void> {
    try {
      const { preserveTokens = false } = options
      const globalStore = useGlobalStore()
      const settingStore = useSettingStore()
      const userStore = useUserStore()

      if (!preserveTokens) {
        localStorage.removeItem('user')
        localStorage.removeItem('TOKEN')
        localStorage.removeItem('REFRESH_TOKEN')
        await invoke(TauriCommand.REMOVE_TOKENS)
      }

      settingStore.closeAutoLogin()
      userStore.clearUser()
      globalStore.updateCurrentSessionRoomId('')

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

  async applyDesktopLoginState(): Promise<void> {
    try {
      if (!isDesktop()) {
        return
      }

      const globalStore = useGlobalStore()
      const { resizeWindow } = useWindow()

      globalStore.isTrayMenuShow = true
      await resizeWindow('tray', 130, 356)
    } catch (err) {
      logger.error(`应用桌面端登录状态失败: ${err}`)
    }
  }

  async openDesktopHomeWindow(): Promise<void> {
    try {
      if (!isDesktop()) {
        return
      }

      const { createWebviewWindow } = useWindow()
      const registerWindow = await WebviewWindow.getByLabel('register')
      if (registerWindow) {
        await registerWindow.close().catch((err) => {
          logger.warn('关闭注册窗口失败:', err)
        })
      }

      await createWebviewWindow('HuLa', 'home', 960, 720, 'login', true, 330, 480, undefined, false)
    } catch (err) {
      logger.error(`打开桌面端主窗口失败: ${err}`)
    }
  }

  async completeDesktopLoginTransition(): Promise<void> {
    try {
      await this.applyDesktopLoginState()
      await this.openDesktopHomeWindow()
    } catch (err) {
      logger.error(`完成桌面端登录过渡失败: ${err}`)
    }
  }

  async logoutCurrentSession(options: LogoutMatrixRuntimeSessionOptions = {}): Promise<void> {
    const { resetLocalState = true, preserveTokens = false } = options
    const matrixStore = useMatrixStore()
    const globalStore = useGlobalStore()
    const { resizeWindow, createWebviewWindow } = useWindow()

    if (resetLocalState) {
      await this.resetLocalSessionState({
        preserveTokens
      })
    } else {
      globalStore.updateCurrentSessionRoomId('')
    }

    await matrixStore.logout()

    if (isDesktop()) {
      globalStore.isTrayMenuShow = false
      try {
        await createWebviewWindow('登录', 'login', 320, 448, undefined, false, 320, 448)
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

export const matrixRuntimeSessionService = new MatrixRuntimeSessionService()
