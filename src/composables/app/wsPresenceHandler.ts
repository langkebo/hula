import { watch } from 'vue'
import { type OnlineEnum, RoomTypeEnum } from '@/enums'
import type { PresenceInfo } from '@/services/matrix/user/MatrixPresenceService'
import type { useChatStore } from '@/stores/domains/chat/chat'
import type { useContactStore } from '@/stores/domains/chat/contacts'
import type { useGroupStore } from '@/stores/domains/chat/group'
import type { useUserStore } from '@/stores/domains/user/user'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { buildPresenceStorePatch, collectTrackedPresenceUserIds } from '@/utils/presenceStatus'

const logger = createLogger('WsPresenceHandler')

interface ClientServiceDeps {
  getClient(): unknown
  waitForClientReady(opts?: { timeoutMs?: number; intervalMs?: number }): Promise<unknown>
}

interface PresenceServiceDeps {
  onPresenceChange(handler: (info: PresenceInfo) => void): () => void
  subscribeToPresence(userIds: string[]): Promise<unknown>
  getBatchPresence(userIds: string[]): Promise<PresenceInfo[]>
}

interface PresenceHandlerDeps {
  userStore: ReturnType<typeof useUserStore>
  contactStore: ReturnType<typeof useContactStore>
  groupStore: ReturnType<typeof useGroupStore>
  chatStore: ReturnType<typeof useChatStore>
  globalStore: ReturnType<typeof useGlobalStore>
}

/**
 * Presence 相关逻辑：维护 Matrix 客户端/在线状态服务的懒加载缓存，
 * 同步联系人/群成员的在线状态到对应 store，并在登录成功时设置 online 状态与监听器。
 */
export function createPresenceHandler(deps: PresenceHandlerDeps) {
  const { userStore, contactStore, groupStore, chatStore, globalStore } = deps

  let clientServiceCache: ClientServiceDeps | undefined
  const getMatrixClientService = async (): Promise<ClientServiceDeps> => {
    if (!clientServiceCache) {
      const { matrixClientService } = await import('@/services/matrix/MatrixClientService')
      clientServiceCache = matrixClientService as ClientServiceDeps
    }
    return clientServiceCache
  }

  let presenceServiceCache: PresenceServiceDeps | undefined
  const getMatrixPresenceService = async (): Promise<PresenceServiceDeps> => {
    if (!presenceServiceCache) {
      const { matrixPresenceService } = await import('@/services/matrix/user/MatrixPresenceService')
      presenceServiceCache = matrixPresenceService as PresenceServiceDeps
    }
    return presenceServiceCache
  }

  const subscribedPresenceUserIds = new Set<string>()
  let isPresenceSyncInFlight = false
  let hasPendingPresenceSync = false
  let unsubscribePresenceListener: (() => void) | null = null
  let stopTrackedUsersWatch: (() => void) | null = null

  /**
   * WS 上下线事件、批量刷新与 SDK presence 实时变更统一经由此处写 store，
   * 避免同一用户被多条链路重复写入，或静默少写字段（见 UI 优化方案 §5.2）。
   * 本文件是 contact/group store presence 字段的唯一写入点，服务层不得绕过。
   */
  const writePresenceToStores = (
    userId: string,
    patch: {
      activeStatus: OnlineEnum
      lastOptTime: number
      presence?: PresenceInfo['presence']
      statusMessage?: string | undefined
    },
    options: { syncPresenceFields: boolean }
  ) => {
    // WS 上下线事件不携带 presence/statusMessage，显式声明本次不覆盖这两项，
    // 而非静默少写，避免好友列表枚举值与状态文案不一致。
    const contactPatch = options.syncPresenceFields
      ? {
          activeStatus: patch.activeStatus,
          lastOptTime: patch.lastOptTime,
          presence: patch.presence,
          ...(patch.statusMessage === undefined ? {} : { statusMessage: patch.statusMessage })
        }
      : { activeStatus: patch.activeStatus, lastOptTime: patch.lastOptTime }

    contactStore.updateContactPresence(userId, contactPatch)
    groupStore.updateUserPresence(userId, { activeStatus: patch.activeStatus, lastOptTime: patch.lastOptTime })
    if (userStore.userInfo && userId === userStore.userInfo.uid) {
      userStore.userInfo.activeStatus = patch.activeStatus
      userStore.userInfo.lastOptTime = patch.lastOptTime
    }
  }

  const applyPresencePatch = (presence: PresenceInfo, now?: number) => {
    writePresenceToStores(presence.user_id, buildPresenceStorePatch(presence, now), {
      syncPresenceFields: true
    })
  }

  /**
   * WS 上下线事件入口：仅同步 activeStatus 与 lastOptTime，四字段契约中
   * presence/statusMessage 由 {@link applyPresencePatch} 的批量/实时链路负责。
   */
  const applyPresenceStatus = (userId: string, activeStatus: OnlineEnum, lastOptTime: number) => {
    if (!userId) return
    writePresenceToStores(userId, { activeStatus, lastOptTime }, { syncPresenceFields: false })
  }

  const applyPresenceToStores = async () => {
    const trackedUserIds = collectTrackedPresenceUserIds({
      currentUserId: userStore.userInfo?.uid ?? null,
      contacts: contactStore.contactsList,
      members: groupStore.allUserInfo
    })

    if (!trackedUserIds.length) {
      return
    }

    const clientService = await getMatrixClientService()
    if (!clientService.getClient()) {
      return
    }

    const presenceService = await getMatrixPresenceService()
    const nextSubscribedUserIds = trackedUserIds.filter((userId) => !subscribedPresenceUserIds.has(userId))
    if (nextSubscribedUserIds.length) {
      try {
        await presenceService.subscribeToPresence(nextSubscribedUserIds)
        nextSubscribedUserIds.forEach((userId) => subscribedPresenceUserIds.add(userId))
      } catch (error) {
        // 订阅失败不得阻断批量查询：订阅集合只在成功后写入，失败用户下一轮自然重试
        logger.warn('presence 订阅失败，继续批量查询:', error)
      }
    }

    const presences = await presenceService.getBatchPresence(trackedUserIds)
    const now = Date.now()

    presences.forEach((presence) => applyPresencePatch(presence, now))
  }

  const syncAvatarPresence = async () => {
    if (isPresenceSyncInFlight) {
      hasPendingPresenceSync = true
      return
    }

    isPresenceSyncInFlight = true
    try {
      await applyPresenceToStores()
    } catch (error) {
      logger.error('同步头像在线状态失败:', error)
    } finally {
      isPresenceSyncInFlight = false
      if (hasPendingPresenceSync) {
        hasPendingPresenceSync = false
        await syncAvatarPresence()
      }
    }
  }

  const refreshActiveGroupMembers = async () => {
    const tasks: Promise<unknown>[] = []
    try {
      const isCurrentGroup = globalStore.currentSession?.type === RoomTypeEnum.GROUP
      const activeRoomId =
        (isCurrentGroup && globalStore.currentSessionRoomId) ||
        chatStore.sessionList.find((item) => item.type === RoomTypeEnum.GROUP)?.roomId

      if (activeRoomId) {
        tasks.push(groupStore.getGroupUserList(activeRoomId, true))
      }
      await Promise.allSettled(tasks)
      await syncAvatarPresence()
    } catch (error) {
      logger.error('刷新群成员失败:', error)
    }
  }

  /**
   * 注册 SDK presence 实时变更监听（唯一写 store 的实时链路）。
   * 登录成功事件与 app 挂载都会调用，重复调用保持单订阅。
   */
  const ensurePresenceListener = async () => {
    if (unsubscribePresenceListener) return
    const presenceService = await getMatrixPresenceService()
    if (unsubscribePresenceListener) return
    unsubscribePresenceListener = presenceService.onPresenceChange((presence: PresenceInfo) => {
      applyPresencePatch(presence)
    })
  }

  /**
   * 登录成功后的在线状态同步：等待客户端就绪 -> 同步头像/成员状态 -> 确保实时监听已注册。
   */
  const handleLoginPresence = async () => {
    try {
      const clientService = await getMatrixClientService()
      await clientService.waitForClientReady({ timeoutMs: 5000 })
      // 初始 online 上报由 SessionBootstrapService.startPresencePipeline 统一负责，
      // 这里仅同步头像/成员状态并注册监听，避免 WS 重连等触发点重复上报 online。
      await syncAvatarPresence()
      await ensurePresenceListener()
    } catch (error) {
      logger.error('[Login] 设置在线状态失败:', error)
    }
  }

  /** 监听关注用户集合变化并触发批量刷新（同一时刻只保留一个 watcher） */
  const startPresenceWatch = () => {
    if (stopTrackedUsersWatch) return
    void ensurePresenceListener().catch((error) => {
      logger.warn('presence 实时监听注册失败:', error)
    })
    stopTrackedUsersWatch = watch(
      () =>
        collectTrackedPresenceUserIds({
          currentUserId: userStore.userInfo?.uid ?? null,
          contacts: contactStore.contactsList,
          members: groupStore.allUserInfo
        }).join('|'),
      () => {
        void syncAvatarPresence()
      },
      { immediate: true, flush: 'post' }
    )
  }

  const cleanup = () => {
    if (stopTrackedUsersWatch) {
      stopTrackedUsersWatch()
      stopTrackedUsersWatch = null
    }
    subscribedPresenceUserIds.clear()
    if (unsubscribePresenceListener) {
      unsubscribePresenceListener()
      unsubscribePresenceListener = null
    }
  }

  return {
    syncAvatarPresence,
    refreshActiveGroupMembers,
    handleLoginPresence,
    startPresenceWatch,
    applyPresenceStatus,
    getSubscribedPresenceUserIds: () => subscribedPresenceUserIds,
    cleanup
  }
}
