import { RoomTypeEnum } from '@/enums'
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
  setPresence(presence: 'online' | 'offline' | 'unavailable', statusMsg?: string): Promise<void>
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

  const applyPresenceToStores = async () => {
    const trackedUserIds = collectTrackedPresenceUserIds({
      currentUserId: userStore.userInfo?.uid,
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
      await presenceService.subscribeToPresence(nextSubscribedUserIds)
      nextSubscribedUserIds.forEach((userId) => subscribedPresenceUserIds.add(userId))
    }

    const presences = await presenceService.getBatchPresence(trackedUserIds)
    const now = Date.now()

    presences.forEach((presence) => {
      const patch = buildPresenceStorePatch(presence, now)
      contactStore.updateContactPresence(presence.user_id, patch)
      groupStore.updateUserPresence(presence.user_id, {
        activeStatus: patch.activeStatus,
        lastOptTime: patch.lastOptTime
      })
      if (userStore.userInfo && presence.user_id === userStore.userInfo.uid) {
        userStore.userInfo.activeStatus = patch.activeStatus
        userStore.userInfo.lastOptTime = patch.lastOptTime
      }
    })
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
   * 登录成功后的在线状态设置与监听器注册：
   * 等待客户端就绪 -> 设置 online -> 同步头像状态 -> 注册 presence 变更监听。
   */
  const handleLoginPresence = async () => {
    try {
      const clientService = await getMatrixClientService()
      await clientService.waitForClientReady({ timeoutMs: 5000 })
      const presenceService = await getMatrixPresenceService()
      // 初始 online 上报由 SessionBootstrapService.startPresencePipeline 统一负责，
      // 这里仅同步头像/成员状态并注册监听，避免 WS 重连等触发点重复上报 online。
      await syncAvatarPresence()
      if (!unsubscribePresenceListener) {
        unsubscribePresenceListener = presenceService.onPresenceChange((presence: PresenceInfo) => {
          const patch = buildPresenceStorePatch(presence)
          contactStore.updateContactPresence(presence.user_id, patch)
          groupStore.updateUserPresence(presence.user_id, {
            activeStatus: patch.activeStatus,
            lastOptTime: patch.lastOptTime
          })
          if (userStore.userInfo && presence.user_id === userStore.userInfo.uid) {
            userStore.userInfo.activeStatus = patch.activeStatus
            userStore.userInfo.lastOptTime = patch.lastOptTime
          }
        })
      }
    } catch (error) {
      logger.error('[Login] 设置在线状态失败:', error)
    }
  }

  const cleanup = () => {
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
    cleanup
  }
}
