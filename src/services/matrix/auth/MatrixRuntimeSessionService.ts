import { emit } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useWindow } from '@/composables/common/useWindow'
import { startPresenceHeartbeat, stopPresenceHeartbeat } from '@/composables/user/usePresenceHeartbeat'
import { EventEnum, MsgEnum, OnlineEnum, SexEnum, TauriCommand } from '@/enums'
import {
  clearMatrixSessionEndpointConfig,
  resolveMatrixSessionEndpointConfig,
  saveMatrixSessionEndpointConfig
} from '@/services/backend/config'
import { useI18nGlobal } from '@/services/i18n'
import type { MatrixClientConfig } from '@/services/matrix/MatrixClientService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { matrixWsBridge } from '@/services/matrix/MatrixWsBridge'
import { patchMatrixSessionSnapshot } from '@/services/matrix/matrixSessionState'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import { switchUserDatabase } from '@/services/tauriCommand'
import type { RoomInfo, UserInfoType } from '@/services/types'
import type { MessageType } from '@/types/message'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { isDesktop, isMac } from '@/utils/PlatformConstants'
import { buildPresenceStorePatch } from '@/utils/presenceStatus'
import { invokeWithErrorHandler, invokeWithResult } from '@/utils/TauriInvokeHandler'
import { toLocalpart } from '@/utils/userIdentity'
import type { SearchEventDoc, SearchRoomDoc } from '@/workers/matrixWorkerTypes'

const logger = createLogger('MatrixRuntimeSessionService')

interface StoredMatrixTokens {
  token: string | null
  refreshToken?: string | null
}

interface RestoreMatrixRuntimeSessionOptions {
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

interface MatrixPostLoginBootstrapOptions {
  account?: string
  displayName?: string
  avatar?: string
  client?: 'PC' | 'MOBILE'
}

interface MatrixPasswordLoginOptions extends MatrixPostLoginBootstrapOptions {
  username: string
  password: string
  homeserverUrl: string
  identityServerUrl?: string
  deviceName?: string
  persistTokens?: boolean
  persistUserInfo?: boolean
  switchDatabase?: boolean
}

interface MatrixSsoLoginOptions extends MatrixPostLoginBootstrapOptions {
  loginToken: string
  persistTokens?: boolean
  persistUserInfo?: boolean
  switchDatabase?: boolean
}

interface ResetMatrixRuntimeSessionOptions {
  preserveTokens?: boolean
}

interface LogoutMatrixRuntimeSessionOptions extends ResetMatrixRuntimeSessionOptions {
  resetLocalState?: boolean
}

export interface PresenceUpdate {
  activeStatus: OnlineEnum
  lastOptTime: number
}

export interface SessionStorePort {
  matrix: {
    getClient(): unknown
    getUserId(): string | null | undefined
    isLoggedIn(): boolean
    isInitialized(): boolean
    getLastError(): string | undefined
    getAccessToken(): string | undefined
    getRefreshToken(): string | undefined
    getHomeserverUrl(): string | undefined
    initialize(config: MatrixClientConfig): Promise<void>
    login(username: string, password: string, deviceName?: string): Promise<boolean>
    completeSSOLogin(loginToken: string): Promise<boolean>
    loginWithToken(accessToken: string, userId: string, refreshToken?: string): Promise<boolean>
    logout(): Promise<void>
  }
  user: {
    getUserInfo(): UserInfoType | undefined
    initUserInfo(uid: string, displayName: string): void
    setUserInfo(info: UserInfoType): void
    clearUser(): void
    fetchUserProfile(uid: string): Promise<{ displayName?: string; avatarUrl?: string } | null>
    updateProfileFields(fields: Partial<Pick<UserInfoType, 'name' | 'avatar' | 'activeStatus' | 'lastOptTime'>>): void
  }
  room: {
    getRoomList(): RoomInfo[]
    getMessages(roomId: string): MessageType[]
    resetState(): void
    setupEventListeners(): Promise<void>
    loadRooms(): Promise<boolean>
  }
  chat: {
    getSessionList(refresh: boolean): Promise<void>
    getSessionListValue(): Array<{ roomId: string }>
  }
  group: {
    clearGroupDetails(): void
    clearMembersMap(): void
    updateUserPresence(userId: string, presence: PresenceUpdate): void
  }
  contact: {
    updateContactPresence(userId: string, patch: PresenceUpdate & { presence?: string; statusMessage?: string }): void
  }
  global: {
    getCurrentSessionRoomId(): string | undefined
    updateCurrentSessionRoomId(roomId: string): void
    setTrayMenuShow(show: boolean): void
  }
  loginHistory: {
    addLoginHistory(account: UserInfoType): void
  }
  emoji: {
    initEmojis(): Promise<void>
    prefetchEmojiToLocal(): Promise<void>
  }
  setting: {
    closeAutoLogin(): void
  }
}

class MatrixRuntimeSessionService {
  constructor(private readonly port: SessionStorePort) {}

  private getCurrentClientDeviceId(): string | null {
    const client = this.port.matrix.getClient() as { getDeviceId?: () => string | null } | null
    return client?.getDeviceId?.() ?? null
  }

  private async ensureClientReadyForBootstrap(options: MatrixPostLoginBootstrapOptions = {}): Promise<void> {
    if (this.port.matrix.getClient()) {
      return
    }

    const uid = this.port.matrix.getUserId() ?? this.port.user.getUserInfo()?.uid ?? ''
    if (!uid) {
      return
    }

    const runtimeAccessToken = this.port.matrix.getAccessToken()
    const runtimeRefreshToken = this.port.matrix.getRefreshToken()
    const storedTokens = runtimeAccessToken
      ? {
          token: runtimeAccessToken,
          refreshToken: runtimeRefreshToken ?? null
        }
      : await this.getStoredTokens()

    if (!storedTokens.token) {
      throw new Error(useI18nGlobal().t('matrix_error.auth.access_token_missing'))
    }

    const userInfo = this.port.user.getUserInfo()
    const restoredClient =
      options.client || (userInfo?.client === 'PC' || userInfo?.client === 'MOBILE' ? userInfo.client : undefined)

    await this.restoreWithAccessToken({
      uid,
      accessToken: storedTokens.token,
      refreshToken: storedTokens.refreshToken ?? undefined,
      displayName: options.displayName || userInfo?.name,
      account: options.account || userInfo?.account || userInfo?.email,
      avatar: options.avatar || userInfo?.avatar,
      client: restoredClient,
      persistTokens: false,
      persistUserInfo: false,
      switchDatabase: false,
      bootstrapAfterRestore: false
    })
  }

  private resolveDisplayName(uid: string, displayName?: string, account?: string): string {
    return displayName || account || toLocalpart(uid) || uid
  }

  private clearUserLocalStorage(): void {
    const userScopedStoreKeys = ['chat', 'group', 'contacts', 'cached', 'sessionUnread']
    userScopedStoreKeys.forEach((key) => {
      localStorage.removeItem(key)
    })
    logger.debug('User localStorage has been cleared')
  }

  private clearMessageCache(): void {
    this.port.group.clearMembersMap()
    logger.debug('Message cache has been cleared')
  }

  /**
   * Retrieve stored tokens from the Tauri backend.
   *
   * @throws Never throws (returns null tokens on error).
   */
  async getStoredTokens(): Promise<StoredMatrixTokens> {
    // 浏览器/E2E 环境：从 Pinia store（localStorage 持久化）读取 token
    if (!hasTauriRuntime()) {
      const token = this.port.matrix.getAccessToken()
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

  async hasAuthenticatedSession(): Promise<boolean> {
    try {
      if (this.port.matrix.isLoggedIn()) {
        return true
      }

      if (this.port.matrix.isInitialized()) {
        return false
      }

      const tokens = await this.getStoredTokens()
      return !!tokens.token
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

      await this.port.matrix.initialize({
        homeserverUrl,
        identityServerUrl,
        accessToken,
        userId: uid,
        allowInsecureHttp: homeserverUrl.startsWith('http://')
      })

      const success = await this.port.matrix.loginWithToken(accessToken, uid, refreshToken)
      if (!success) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.session_restore_failed'))
      }
      patchMatrixSessionSnapshot({
        userId: uid,
        deviceId: this.getCurrentClientDeviceId(),
        accessToken,
        homeserverUrl
      })

      const resolvedDisplayName = this.resolveDisplayName(uid, displayName, account)
      this.port.user.initUserInfo(uid, resolvedDisplayName)

      if (persistUserInfo && hasTauriRuntime()) {
        await invokeWithErrorHandler(TauriCommand.SAVE_USER_INFO, {
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

  /**
   * Authenticate with password credentials and bootstrap the session.
   *
   * @throws {Error} if login fails or session info is incomplete.
   */
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

      await ensureAppStateReady()
      saveMatrixSessionEndpointConfig({ homeserverUrl, identityServerUrl: identityServerUrl || '' })
      await this.port.matrix.initialize({
        homeserverUrl,
        identityServerUrl,
        allowInsecureHttp: homeserverUrl.startsWith('http://')
      })

      const success = await this.port.matrix.login(username, password, deviceName)
      if (!success) {
        throw new Error(
          this.port.matrix.getLastError() || useI18nGlobal().t('matrix_error.auth.login_failed_check_network')
        )
      }

      const uid = this.port.matrix.getUserId()
      const accessToken = this.port.matrix.getAccessToken()
      if (!uid || !accessToken) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.session_info_incomplete'))
      }

      const refreshToken = this.port.matrix.getRefreshToken() ?? ''
      patchMatrixSessionSnapshot({
        userId: uid,
        deviceId: this.getCurrentClientDeviceId(),
        accessToken,
        homeserverUrl
      })

      if (switchDatabase) {
        await switchUserDatabase(uid)
      }

      if (persistTokens && hasTauriRuntime()) {
        await invokeWithErrorHandler(TauriCommand.UPDATE_TOKEN, {
          req: {
            uid,
            token: accessToken,
            refreshToken
          }
        })
      }

      if (persistUserInfo && hasTauriRuntime()) {
        await invokeWithErrorHandler(TauriCommand.SAVE_USER_INFO, {
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

  /**
   * Authenticate with an SSO login token and bootstrap the session.
   *
   * @throws {Error} if loginToken is empty.
   * @throws {Error} if SSO login fails or session info is incomplete.
   */
  async loginWithSsoToken(options: MatrixSsoLoginOptions): Promise<{ uid: string; accessToken: string }> {
    try {
      const {
        loginToken,
        account,
        displayName,
        avatar,
        client,
        persistTokens = true,
        persistUserInfo = true,
        switchDatabase = true
      } = options

      if (!loginToken) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.sso_token_missing'))
      }

      const { homeserverUrl, identityServerUrl } = resolveMatrixSessionEndpointConfig()

      await ensureAppStateReady()
      await this.port.matrix.initialize({
        homeserverUrl,
        identityServerUrl,
        allowInsecureHttp: homeserverUrl.startsWith('http://')
      })

      const success = await this.port.matrix.completeSSOLogin(loginToken)
      if (!success) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.sso_login_failed'))
      }

      const uid = this.port.matrix.getUserId()
      const accessToken = this.port.matrix.getAccessToken()
      if (!uid || !accessToken) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.sso_session_incomplete'))
      }

      const refreshToken = this.port.matrix.getRefreshToken() ?? ''
      patchMatrixSessionSnapshot({
        userId: uid,
        deviceId: this.getCurrentClientDeviceId(),
        accessToken,
        homeserverUrl
      })

      if (switchDatabase) {
        await switchUserDatabase(uid)
      }

      if (persistTokens && hasTauriRuntime()) {
        await invokeWithErrorHandler(TauriCommand.UPDATE_TOKEN, {
          req: {
            uid,
            token: accessToken,
            refreshToken
          }
        })
      }

      if (persistUserInfo && hasTauriRuntime()) {
        await invokeWithErrorHandler(TauriCommand.SAVE_USER_INFO, {
          userInfo: {
            uid
          }
        })
      }

      await this.bootstrapPostLoginState({
        account,
        displayName,
        avatar,
        client
      })

      return {
        uid,
        accessToken
      }
    } catch (err) {
      logger.error(`SSO 登录失败: ${err}`)
      throw err
    }
  }

  private waitSyncPrepared(timeoutMs = 8000): Promise<void> {
    return new Promise((resolve) => {
      let settled = false
      const off = (data: unknown) => {
        const state = (data as { state?: string })?.state
        if (state === 'PREPARED' || state === 'SYNCING') {
          if (settled) return
          settled = true
          matrixClientService.off('sync', off as never)
          logger.info(`waitSyncPrepared: sync 状态 ${state}，继续 bootstrap`)
          resolve()
        }
      }
      // 注意：不能通过 getConnectionState() 提前返回，因为 login()/loginWithToken()
      // 会在 startClient() 之前就把 connectionState 设为 'CONNECTED'，
      // 这并不代表 sync 真正进入 PREPARED/SYNCING 状态。
      // 必须等待 SDK 的 sync 事件确认 sync 已就绪，否则后续 loadRooms/getSessionList
      // 会在 sync 未完成时执行，导致空数据或卡住。
      matrixClientService.on('sync', off as never)
      setTimeout(() => {
        if (settled) return
        settled = true
        matrixClientService.off('sync', off as never)
        logger.warn(`waitSyncPrepared 超时 ${timeoutMs}ms，使用当前状态继续 bootstrap`)
        resolve()
      }, timeoutMs)
    })
  }

  private async startPresencePipeline(uid: string): Promise<void> {
    try {
      const profile = await this.port.user.fetchUserProfile(uid)
      if (profile) {
        const fields: Partial<Pick<UserInfoType, 'name' | 'avatar'>> = {}
        if (profile.displayName) fields.name = profile.displayName
        if (profile.avatarUrl) fields.avatar = profile.avatarUrl
        if (Object.keys(fields).length > 0) {
          this.port.user.updateProfileFields(fields)
        }
      }
    } catch (err) {
      logger.warn(`fetchUserProfile 失败，使用本地 displayName: ${err}`)
    }

    try {
      // 确保 client 就绪后再设置 presence，避免登录时序竞态导致 "客户端未初始化"
      await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
      await matrixPresenceService.setPresence('online')
    } catch (err) {
      logger.warn(`setPresence(online) 失败：${err}`)
    }

    this.port.user.updateProfileFields({
      activeStatus: OnlineEnum.ONLINE,
      lastOptTime: Date.now()
    })

    matrixPresenceService.onPresenceChange((presence) => {
      const patch = buildPresenceStorePatch(presence)
      if (presence.user_id === uid) {
        this.port.user.updateProfileFields({
          activeStatus: patch.activeStatus,
          lastOptTime: patch.lastOptTime
        })
      }
      this.port.group.updateUserPresence(presence.user_id, {
        activeStatus: patch.activeStatus,
        lastOptTime: patch.lastOptTime
      })
      this.port.contact.updateContactPresence(presence.user_id, patch)
    })

    startPresenceHeartbeat()

    if (typeof window !== 'undefined' && !this.beforeUnloadRegistered) {
      window.addEventListener('beforeunload', this.onBeforeUnload)
      this.beforeUnloadRegistered = true
    }
  }

  private async bootstrapSearchIndex(_uid: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[bootstrapSearchIndex] Matrix 客户端未初始化，跳过索引初始化')
      return
    }

    const allRooms = this.port.room.getRoomList()

    const searchRoomDocs: SearchRoomDoc[] = allRooms.map((roomInfo: RoomInfo) => {
      const room = client.getRoom(roomInfo.roomId)
      return {
        roomId: roomInfo.roomId,
        name: roomInfo.name,
        avatarUrl: roomInfo.avatarUrl || undefined,
        memberCount: roomInfo.detail?.joinedCount || room?.getJoinedMembers().length || undefined
      }
    })

    if (searchRoomDocs.length > 0) {
      await matrixWorkerHost.bootstrapSearchRooms(searchRoomDocs)
      logger.info(`[bootstrapSearchIndex] 批量灌入 ${searchRoomDocs.length} 个房间到 Worker 搜索索引`)
    }

    const searchEventDocs: SearchEventDoc[] = []
    for (const roomInfo of allRooms) {
      const roomMessages = this.port.room.getMessages(roomInfo.roomId) || []
      const roomEvents = roomMessages
        .filter((msg: MessageType) => msg.message.type === MsgEnum.TEXT && typeof msg.message.body === 'string')
        .map((msg: MessageType) => ({
          eventId: msg.message.id,
          roomId: msg.message.roomId,
          sender: msg.fromUser?.uid ?? '',
          timestamp: msg.message.sendTime,
          msgtype: 'm.text',
          body: msg.message.body as unknown as string
        }))
      searchEventDocs.push(...roomEvents)
    }

    if (searchEventDocs.length > 0) {
      await matrixWorkerHost.bootstrapSearchEvents(searchEventDocs)
      logger.info(`[bootstrapSearchIndex] 批量灌入 ${searchEventDocs.length} 条消息到 Worker 搜索索引`)
    }
  }

  private beforeUnloadRegistered = false
  private readonly onBeforeUnload = () => {
    void matrixPresenceService.setPresence('unavailable').catch((err) => {
      logger.warn('Set presence to unavailable failed:', err)
    })
  }

  /**
   * Bootstrap post-login state: sync, presence, search index, and UI.
   *
   * @throws {Error} if the user id is missing or any sub-step fails.
   */
  async bootstrapPostLoginState(options: MatrixPostLoginBootstrapOptions = {}): Promise<void> {
    const BOOTSTRAP_TIMEOUT_MS = 30_000
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined

    const bootstrapTask = this.doBootstrapPostLoginState(options)

    // 整体超时保护：防止单个步骤（如 worker 请求、sync 等待）卡住导致登录流程永不返回
    const timeoutPromise = new Promise<void>((resolve) => {
      timeoutHandle = setTimeout(() => {
        logger.warn(`bootstrapPostLoginState 整体超时 ${BOOTSTRAP_TIMEOUT_MS}ms，强制完成（部分功能可能在后台继续）`)
        resolve()
      }, BOOTSTRAP_TIMEOUT_MS)
    })

    try {
      await Promise.race([bootstrapTask, timeoutPromise])
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
    }
  }

  private async doBootstrapPostLoginState(options: MatrixPostLoginBootstrapOptions): Promise<void> {
    try {
      const uid = this.port.matrix.getUserId() ?? this.port.user.getUserInfo()?.uid ?? ''

      if (!uid) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.user_id_missing_for_init'))
      }

      await this.ensureClientReadyForBootstrap(options)
      await this.waitSyncPrepared()

      this.clearUserLocalStorage()
      this.clearMessageCache()

      this.port.room.resetState()
      await this.port.room.setupEventListeners()
      this.port.group.clearGroupDetails()
      await this.port.room.loadRooms()
      await this.port.chat.getSessionList(true)
      if (!this.port.global.getCurrentSessionRoomId() && this.port.chat.getSessionListValue().length > 0) {
        this.port.global.updateCurrentSessionRoomId(this.port.chat.getSessionListValue()[0].roomId)
      }

      const account: UserInfoType = {
        uid,
        name: this.resolveDisplayName(uid, options.displayName, options.account),
        account: toLocalpart(options.account || uid),
        email: '',
        avatar: AvatarUtils.getAvatarUrl(options.avatar),
        modifyNameChance: 0,
        sex: SexEnum.MAN,
        userStateId: '',
        avatarUpdateTime: 0,
        client: options.client || (isDesktop() ? 'PC' : 'MOBILE'),
        resume: '',
        homeserverUrl: this.port.matrix.getHomeserverUrl() || undefined,
        identityServerUrl: resolveMatrixSessionEndpointConfig().identityServerUrl || undefined
      }

      this.port.user.setUserInfo(account)
      this.port.loginHistory.addLoginHistory(account)

      await this.startPresencePipeline(uid)

      matrixWsBridge.start()

      void matrixWorkerHost.start().catch((err) => {
        logger.warn(`[login] MatrixWorkerHost 启动失败: ${err}`)
      })

      await this.bootstrapSearchIndex(uid).catch((err) => {
        logger.warn(`[login] 初始化 Worker 搜索索引失败: ${err}`)
      })

      void this.port.emoji.initEmojis().catch(() => {
        logger.warn('[login] 初始化表情失败')
      })

      void this.port.emoji.prefetchEmojiToLocal().catch(() => {
        logger.warn('[login] 预热表情缓存失败')
      })
    } catch (err) {
      logger.error(`初始化登录状态失败: ${err}`)
      throw err
    }
  }

  /**
   * Reset the local runtime session state without server interaction.
   *
   * @throws {Error} if token removal or state cleanup fails.
   */
  async resetLocalSessionState(options: ResetMatrixRuntimeSessionOptions = {}): Promise<void> {
    try {
      const { preserveTokens = false } = options

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

      this.port.setting.closeAutoLogin()
      this.port.user.clearUser()
      this.port.global.updateCurrentSessionRoomId('')

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
      if (!isDesktop() || !hasTauriRuntime()) {
        return
      }

      const { resizeWindow } = useWindow()

      this.port.global.setTrayMenuShow(true)
      await resizeWindow('tray', 130, 356)
    } catch (err) {
      logger.error(`应用桌面端登录状态失败: ${err}`)
    }
  }

  async openDesktopHomeWindow(): Promise<void> {
    try {
      if (!isDesktop() || !hasTauriRuntime()) {
        return
      }

      const { createWebviewWindow } = useWindow()
      const registerWindow = await WebviewWindow.getByLabel('register')
      if (registerWindow) {
        await registerWindow.close().catch((err) => {
          logger.warn('关闭注册窗口失败:', err)
        })
      }

      // Step 2.3：窗口最小宽度 1024px，配合响应式断点（wide≥1440 / normal 1024-1439 / shrink<1024）
      await createWebviewWindow('Tjg', 'home', 1280, 800, 'login', true, 1024, 600, undefined, false)
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

  /**
   * Log out the current session: stop presence, clear state, and optionally reset all local data.
   *
   * @throws {Error} if resetLocalSessionState or the underlying logout request fails.
   */
  async logoutCurrentSession(options: LogoutMatrixRuntimeSessionOptions = {}): Promise<void> {
    const { resetLocalState = true, preserveTokens = false } = options
    const { resizeWindow, createWebviewWindow } = useWindow()

    stopPresenceHeartbeat()
    matrixWsBridge.stop()

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
    if (typeof window !== 'undefined' && this.beforeUnloadRegistered) {
      window.removeEventListener('beforeunload', this.onBeforeUnload)
      this.beforeUnloadRegistered = false
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
      this.port.global.updateCurrentSessionRoomId('')
    }

    await this.port.matrix.logout()

    if (isDesktop()) {
      this.port.global.setTrayMenuShow(false)
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

export { MatrixRuntimeSessionService }
