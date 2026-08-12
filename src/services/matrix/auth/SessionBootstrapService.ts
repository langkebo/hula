import { startPresenceHeartbeat } from '@/composables/user/usePresenceHeartbeat'
import { MsgEnum, OnlineEnum, SexEnum } from '@/enums'
import { resolveMatrixSessionEndpointConfig } from '@/services/backend/config'
import { useI18nGlobal } from '@/services/i18n'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { matrixWsBridge } from '@/services/matrix/MatrixWsBridge'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import type { RoomInfo, UserInfoType } from '@/services/types'
import type { MessageType } from '@/types/message'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { reportExtensionDegradationToUi } from '@/utils/extensionHealth'
import { createLogger } from '@/utils/Logger'
import { isDesktop } from '@/utils/PlatformConstants'
import { buildPresenceStorePatch } from '@/utils/presenceStatus'
import { toLocalpart } from '@/utils/userIdentity'
import type { SearchEventDoc, SearchRoomDoc } from '@/workers/matrixWorkerTypes'
import type { MatrixPostLoginBootstrapOptions, SessionRuntimeHost, SessionRuntimeState } from './sessionRuntimeInternal'

const logger = createLogger('SessionBootstrapService')

/**
 * Post-login bootstrap: ensure client ready, wait for sync, set up rooms / presence /
 * search index, and start background pipelines (WS bridge, worker host, emoji cache).
 *
 * The bootstrap is guarded by an IdempotencyGuard so concurrent or serial re-invocations
 * (e.g. login flow + useLoginFlow.init) share a single in-flight pipeline.
 */
export class SessionBootstrapService {
  constructor(
    private readonly host: SessionRuntimeHost,
    private readonly state: SessionRuntimeState
  ) {}

  /**
   * Ensure the MatrixClient is initialized and ready for use.
   * Unlike `bootstrapPostLoginState`, this only restores the session
   * (creates the client) without waiting for sync, presence, or search index.
   * Useful for standalone WebViews (e.g., security settings window).
   */
  async ensureClientReady(options?: MatrixPostLoginBootstrapOptions): Promise<void> {
    await this.ensureClientReadyForBootstrap(options)
  }

  /**
   * Bootstrap post-login state: sync, presence, search index, and UI.
   *
   * @throws {Error} if the user id is missing or any sub-step fails.
   */
  async bootstrapPostLoginState(options: MatrixPostLoginBootstrapOptions = {}): Promise<void> {
    const BOOTSTRAP_TIMEOUT_MS = 30_000
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined

    // bootstrapTask 完成时才标记 settled（超时/失败不标记，允许后续重试）
    // IdempotencyGuard 负责：settled 短路 + in-flight Promise 复用
    const bootstrapTask = () => {
      const task = this.doBootstrapPostLoginState(options)

      // 整体超时保护：防止单个步骤卡住导致登录流程永不返回
      const timeoutPromise = new Promise<void>((resolve) => {
        timeoutHandle = setTimeout(() => {
          logger.warn(`bootstrapPostLoginState 整体超时 ${BOOTSTRAP_TIMEOUT_MS}ms，强制完成（部分功能可能在后台继续）`)
          resolve()
        }, BOOTSTRAP_TIMEOUT_MS)
      })

      return Promise.race([task, timeoutPromise]).finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle)
        // 防止孤儿 Promise：若超时胜出，task 仍在后台运行
        task.catch((err) => {
          logger.warn('bootstrapPostLoginState 超时后后台任务失败（已忽略）:', err)
        })
      })
    }

    return this.state.bootstrapGuard.run(bootstrapTask)
  }

  /**
   * Restore the client if not yet created, using runtime or stored tokens.
   * Used by both `ensureClientReady` and `doBootstrapPostLoginState`.
   */
  private async ensureClientReadyForBootstrap(options: MatrixPostLoginBootstrapOptions = {}): Promise<void> {
    const port = this.host.port

    if (port.matrix.getClient()) {
      return
    }

    // 获取 uid——优先从运行时读取，若 Pinia store 未初始化（如独立 WebView），
    // 则从后端存储的 token 记录中获取。
    let uid = port.matrix.getUserId() ?? port.user.getUserInfo()?.uid ?? ''

    const runtimeAccessToken = port.matrix.getAccessToken()
    const runtimeRefreshToken = port.matrix.getRefreshToken()
    const storedTokens = runtimeAccessToken
      ? {
          token: runtimeAccessToken,
          refreshToken: runtimeRefreshToken ?? null
        }
      : await this.host.getStoredTokens()

    // 如果 uid 为空但后端返回了 uid，则使用后端 uid
    if (!uid && storedTokens.uid) {
      uid = storedTokens.uid
    }

    if (!uid) {
      return
    }

    if (!storedTokens.token) {
      throw new Error(useI18nGlobal().t('matrix_error.auth.access_token_missing'))
    }

    const userInfo = port.user.getUserInfo()
    const restoredClient =
      options.client || (userInfo?.client === 'PC' || userInfo?.client === 'MOBILE' ? userInfo.client : undefined)

    await this.host.restoreWithAccessToken({
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

  private async doBootstrapPostLoginState(options: MatrixPostLoginBootstrapOptions): Promise<void> {
    const port = this.host.port
    try {
      const uid = port.matrix.getUserId() ?? port.user.getUserInfo()?.uid ?? ''

      if (!uid) {
        throw new Error(useI18nGlobal().t('matrix_error.auth.user_id_missing_for_init'))
      }

      await this.ensureClientReadyForBootstrap(options)
      // 等待 client 真正就绪后再等 sync prepared。
      // ensureClientReadyForBootstrap 仅创建 client + loginWithToken，但 client 可能在异步
      // 初始化过程中；waitForClientReady 轮询确认 client 实例可用，避免 waitSyncPrepared
      // 等待一个永远不到的 sync 事件。
      await matrixClientService.waitForClientReady({ timeoutMs: 30_000 })
      await this.host.waitSyncPrepared()

      this.host.clearUserLocalStorage()
      this.host.clearMessageCache()

      port.room.resetState()
      await port.room.setupEventListeners()
      port.group.clearGroupDetails()
      await port.room.loadRooms()
      await port.chat.getSessionList(true)
      if (!port.global.getCurrentSessionRoomId() && port.chat.getSessionListValue().length > 0) {
        port.global.updateCurrentSessionRoomId(port.chat.getSessionListValue()[0].roomId)
      }

      const account: UserInfoType = {
        uid,
        name: this.host.resolveDisplayName(uid, options.displayName, options.account),
        account: toLocalpart(options.account || uid),
        email: '',
        avatar: AvatarUtils.getAvatarUrl(options.avatar),
        modifyNameChance: -1,
        sex: SexEnum.MAN,
        userStateId: '',
        avatarUpdateTime: 0,
        client: options.client || (isDesktop() ? 'PC' : 'MOBILE'),
        resume: '',
        homeserverUrl: port.matrix.getHomeserverUrl() || undefined,
        identityServerUrl: resolveMatrixSessionEndpointConfig().identityServerUrl || undefined
      }

      port.user.setUserInfo(account)
      port.loginHistory.addLoginHistory(account)

      await this.startPresencePipeline(uid)

      matrixWsBridge.start()

      void matrixWorkerHost.start().catch((err) => {
        logger.warn(`[login] MatrixWorkerHost 启动失败: ${err}`)
      })

      await this.bootstrapSearchIndex(uid).catch((err) => {
        logger.warn(`[login] 初始化 Worker 搜索索引失败: ${err}`)
      })

      void port.emoji.initEmojis().catch(() => {
        logger.warn('[login] 初始化表情失败')
      })

      void port.emoji.prefetchEmojiToLocal().catch(() => {
        logger.warn('[login] 预热表情缓存失败')
      })

      // O3: 启动就绪后检测扩展降级状态，通过 toast 向用户暴露
      reportExtensionDegradationToUi()
    } catch (err) {
      logger.error(`初始化登录状态失败: ${err}`)
      throw err
    }
  }

  private async startPresencePipeline(uid: string): Promise<void> {
    const port = this.host.port
    try {
      const profile = await port.user.fetchUserProfile(uid)
      if (profile) {
        const fields: Partial<Pick<UserInfoType, 'name' | 'avatar'>> = {}
        if (profile.displayName) fields.name = profile.displayName
        if (profile.avatarUrl) fields.avatar = profile.avatarUrl
        if (Object.keys(fields).length > 0) {
          port.user.updateProfileFields(fields)
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

    port.user.updateProfileFields({
      activeStatus: OnlineEnum.ONLINE,
      lastOptTime: Date.now()
    })

    // 捕获 onPresenceChange 返回的清理函数，登出时调用避免回调残留
    if (this.state.presenceChangeCleanup) {
      this.state.presenceChangeCleanup()
    }
    this.state.presenceChangeCleanup = matrixPresenceService.onPresenceChange((presence) => {
      const patch = buildPresenceStorePatch(presence)
      if (presence.user_id === uid) {
        port.user.updateProfileFields({
          activeStatus: patch.activeStatus,
          lastOptTime: patch.lastOptTime
        })
      }
      port.group.updateUserPresence(presence.user_id, {
        activeStatus: patch.activeStatus,
        lastOptTime: patch.lastOptTime
      })
      port.contact.updateContactPresence(presence.user_id, patch)
    })

    startPresenceHeartbeat()

    if (typeof window !== 'undefined' && !this.state.beforeUnloadRegistered) {
      window.addEventListener('beforeunload', this.state.onBeforeUnload)
      this.state.beforeUnloadRegistered = true
    }
  }

  private async bootstrapSearchIndex(_uid: string): Promise<void> {
    const port = this.host.port
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('[bootstrapSearchIndex] Matrix 客户端未初始化，跳过索引初始化')
      return
    }

    const allRooms = port.room.getRoomList()

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
      const roomMessages = port.room.getMessages(roomInfo.roomId) || []
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
}
