import { emit } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { EventEnum, MsgEnum, OnlineEnum, SexEnum, TauriCommand } from '@/enums'
import { startPresenceHeartbeat, stopPresenceHeartbeat } from '@/hooks/usePresenceHeartbeat'
import { useWindow } from '@/hooks/useWindow'
import {
  clearMatrixSessionEndpointConfig,
  resolveMatrixSessionEndpointConfig,
  saveMatrixSessionEndpointConfig
} from '@/services/backend/config'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { matrixWsBridge } from '@/services/matrix/MatrixWsBridge'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import { switchUserDatabase } from '@/services/tauriCommand'
import type { RoomInfo } from '@/services/types'
import { useChatStore } from '@/stores/domains/chat/chat'
import type { MessageType } from '@/stores/domains/chat/chat/types'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useEmojiStore } from '@/stores/domains/chat/emoji'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useRoomStore } from '@/stores/domains/chat/room'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { isDesktop, isMac } from '@/utils/PlatformConstants'
import { buildPresenceStorePatch } from '@/utils/presenceStatus'
import { invokeWithErrorHandler, invokeWithResult } from '@/utils/TauriInvokeHandler'
import { toLocalpart } from '@/utils/userIdentity'
import type { SearchEventDoc, SearchRoomDoc } from '@/workers/matrixWorkerTypes'

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

export interface MatrixSsoLoginOptions extends MatrixPostLoginBootstrapOptions {
  loginToken: string
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
    const groupStore = useGroupStore()
    for (const key of Object.keys(groupStore.membersMap)) {
      delete groupStore.membersMap[key]
    }
    logger.debug('Message cache has been cleared')
  }

  async getStoredTokens(): Promise<StoredMatrixTokens> {
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
      const { homeserverUrl, identityServerUrl } = resolveMatrixSessionEndpointConfig()

      await ensureAppStateReady()

      if (switchDatabase) {
        await switchUserDatabase(uid)
      }

      if (persistTokens) {
        await invokeWithErrorHandler(TauriCommand.UPDATE_TOKEN, {
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
      saveMatrixSessionEndpointConfig({ homeserverUrl, identityServerUrl: identityServerUrl || '' })
      await matrixStore.initialize({
        homeserverUrl,
        identityServerUrl,
        allowInsecureHttp: homeserverUrl.startsWith('http://')
      })

      const success = await matrixStore.login(username, password, deviceName)
      if (!success) {
        throw new Error(matrixStore.lastError || '登录失败，请检查网络连接或服务器配置')
      }

      const uid = matrixStore.userId
      const accessToken = matrixStore.accessToken
      if (!uid || !accessToken) {
        throw new Error('登录成功但会话信息不完整')
      }

      const refreshToken = (matrixStore as unknown as { refreshToken?: string }).refreshToken ?? ''

      if (switchDatabase) {
        await switchUserDatabase(uid)
      }

      if (persistTokens) {
        await invokeWithErrorHandler(TauriCommand.UPDATE_TOKEN, {
          req: {
            uid,
            token: accessToken,
            refreshToken
          }
        })
      }

      if (persistUserInfo) {
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
        throw new Error('缺少 SSO 登录令牌')
      }

      const matrixStore = useMatrixStore()
      const { homeserverUrl, identityServerUrl } = resolveMatrixSessionEndpointConfig()

      await ensureAppStateReady()
      await matrixStore.initialize({
        homeserverUrl,
        identityServerUrl,
        allowInsecureHttp: homeserverUrl.startsWith('http://')
      })

      const success = await matrixStore.completeSSOLogin(loginToken)
      if (!success) {
        throw new Error('SSO 登录失败，请稍后重试')
      }

      const uid = matrixStore.userId
      const accessToken = matrixStore.accessToken
      if (!uid || !accessToken) {
        throw new Error('SSO 登录成功但会话信息不完整')
      }

      const refreshToken = (matrixStore as unknown as { refreshToken?: string }).refreshToken ?? ''

      if (switchDatabase) {
        await switchUserDatabase(uid)
      }

      if (persistTokens) {
        await invokeWithErrorHandler(TauriCommand.UPDATE_TOKEN, {
          req: {
            uid,
            token: accessToken,
            refreshToken
          }
        })
      }

      if (persistUserInfo) {
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

  /**
   * 等待 SlidingSync 进入 PREPARED / SYNCING 状态。避免登录后立即调用 `loadRooms`
   * 时 `client.getRooms()` 还是空数组，导致 UI 永远显示「暂无会话」。
   */
  private waitSyncPrepared(timeoutMs = 8000): Promise<void> {
    return new Promise((resolve) => {
      let settled = false
      const off = (data: unknown) => {
        const state = (data as { state?: string })?.state
        if (state === 'PREPARED' || state === 'SYNCING') {
          if (settled) return
          settled = true
          matrixClientService.off('sync', off as never)
          resolve()
        }
      }
      // 当前 sync 状态可能已经是 PREPARED；先检查一次
      const current = matrixClientService.getConnectionState()
      if (current === 'CONNECTED') {
        resolve()
        return
      }
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

  /**
   * 在登录成功 / token 恢复成功后调用：
   *   1. 拉取真实的 Matrix /profile（修正 displayname / avatar）
   *   2. 主动 setPresence('online')
   *   3. 注册 User.presence 监听，把变化写回 user / contact / group 三个 store
   *   4. 启动 4 分钟一次的 presence 心跳
   *   5. 注册 beforeunload，关闭窗口前 setPresence('unavailable')
   */
  private async startPresencePipeline(uid: string): Promise<void> {
    const userStore = useUserStore()
    const groupStore = useGroupStore()
    const contactStore = useContactStore()

    try {
      const profile = await userStore.fetchUserProfile(uid)
      if (profile && userStore.userInfo) {
        if (profile.displayName) userStore.userInfo.name = profile.displayName
        if (profile.avatarUrl) userStore.userInfo.avatar = profile.avatarUrl
      }
    } catch (err) {
      logger.warn(`fetchUserProfile 失败，使用本地 displayName: ${err}`)
    }

    try {
      await matrixPresenceService.setPresence('online')
    } catch (err) {
      logger.warn(`setPresence(online) 失败：${err}`)
    }

    if (userStore.userInfo) {
      userStore.userInfo.activeStatus = OnlineEnum.ONLINE
      userStore.userInfo.lastOptTime = Date.now()
    }

    matrixPresenceService.onPresenceChange((presence) => {
      const patch = buildPresenceStorePatch(presence)
      if (presence.user_id === uid && userStore.userInfo) {
        userStore.userInfo.activeStatus = patch.activeStatus
        userStore.userInfo.lastOptTime = patch.lastOptTime
      }
      if (typeof groupStore.updateUserPresence === 'function') {
        groupStore.updateUserPresence(presence.user_id, {
          activeStatus: patch.activeStatus,
          lastOptTime: patch.lastOptTime
        })
      }
      if (typeof contactStore.updateContactPresence === 'function') {
        contactStore.updateContactPresence(presence.user_id, patch)
      }
    })

    startPresenceHeartbeat()

    if (typeof window !== 'undefined' && !this.beforeUnloadRegistered) {
      window.addEventListener('beforeunload', this.onBeforeUnload)
      this.beforeUnloadRegistered = true
    }
  }

  /**
   * 初始化 Worker 搜索索引，批量灌入房间信息和已加载的消息
   * @param uid 当前用户ID
   */
  private async bootstrapSearchIndex(_uid: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[bootstrapSearchIndex] Matrix 客户端未初始化，跳过索引初始化')
      return
    }

    const roomStore = useRoomStore()
    const allRooms = roomStore.roomList

    const searchRoomDocs: SearchRoomDoc[] = allRooms.map((roomInfo: RoomInfo) => {
      // 从 RoomInfo 提取 SearchRoomDoc 所需信息
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
      const roomMessages = roomStore.messages.get(roomInfo.roomId) || []
      const roomEvents = roomMessages
        .filter((msg: MessageType) => msg.message.type === MsgEnum.TEXT && typeof msg.message.body === 'string')
        .map((msg: MessageType) => ({
          eventId: msg.message.id,
          roomId: msg.message.roomId,
          sender: msg.fromUser.uid,
          timestamp: msg.message.sendTime,
          msgtype: 'm.text', // Only indexing text messages for now
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
    // 不能 await，浏览器在 beforeunload 内只允许同步发请求；
    // SDK 的 setPresence 会发起 PUT，浏览器会尽力发出。
    void matrixPresenceService.setPresence('unavailable').catch(() => {})
  }

  async bootstrapPostLoginState(options: MatrixPostLoginBootstrapOptions = {}): Promise<void> {
    try {
      const chatStore = useChatStore()
      const globalStore = useGlobalStore()
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
      // 等待 sync 真正 PREPARED，再加载房间，避免 UI 显示「暂无会话」
      await this.waitSyncPrepared()

      this.clearUserLocalStorage()
      this.clearMessageCache()

      roomStore.resetState()
      await roomStore.setupEventListeners()
      groupStore.groupDetails.length = 0
      await roomStore.loadRooms()
      await chatStore.getSessionList(true)
      if (!globalStore.currentSessionRoomId && chatStore.sessionList.length > 0) {
        globalStore.updateCurrentSessionRoomId(chatStore.sessionList[0].roomId)
      }

      const account = {
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
        homeserverUrl: matrixStore.homeserverUrl || undefined,
        identityServerUrl: resolveMatrixSessionEndpointConfig().identityServerUrl || undefined
      }

      userStore.userInfo = account
      loginHistoriesStore.addLoginHistory(account)

      // 拉 profile / 上报 presence / 启动心跳
      await this.startPresencePipeline(uid)

      // 把 Matrix 事件桥接成既有 useMitt + WsResponseMessageType.* 信号，
      // 让 App.vue 中遗留的监听器（TOKEN_EXPIRED、MSG_RECALL、ROOM_INFO_CHANGE）
      // 在没有 WS 通道时仍然能收到等价事件。
      matrixWsBridge.start()

      // 预热 Matrix Worker 宿主：当前仅用于 ping/心跳骨架，后续会逐步把
      // 重活迁进 worker。失败不应阻塞登录流程，仅记录日志。
      void matrixWorkerHost.start().catch((err) => {
        logger.warn(`[login] MatrixWorkerHost 启动失败: ${err}`)
      })

      // 初始化 Worker 搜索索引
      await this.bootstrapSearchIndex(uid).catch((err) => {
        logger.warn(`[login] 初始化 Worker 搜索索引失败: ${err}`)
      })

      void emojiStore.initEmojis().catch(() => {
        logger.warn('[login] 初始化表情失败')
      })

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
        await invokeWithErrorHandler(TauriCommand.REMOVE_TOKENS)
      }
      clearMatrixSessionEndpointConfig()

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

    // 登出前先把心跳停掉，并把状态告诉服务端，避免被对端继续看到「在线」
    stopPresenceHeartbeat()
    matrixWsBridge.stop()

    // 清理搜索索引持久化数据并终止 Worker
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
