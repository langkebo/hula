import { watch } from 'vue'
import { RoomTypeEnum } from '@/enums'
import type { PresenceInfo } from '@/services/matrix/user/MatrixPresenceService'
import type { useSessionStore } from '@/stores/domains/chat/chat/session'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import type { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { buildPresenceStorePatch, collectTrackedPresenceUserIds } from '@/utils/presenceStatus'

interface ClientServiceDeps {
  getClient(): unknown | null
}

interface PresenceServiceDeps {
  subscribeToPresence(userIds: string[], unsubscribeUserIds?: string[]): Promise<{ presences: PresenceInfo[] }>
  getBatchPresence(userIds: string[]): Promise<PresenceInfo[]>
  onPresenceChange(handler: (info: PresenceInfo) => void): () => void
}

const logger = createLogger('PresenceSync')

export function usePresenceSync(deps: {
  getMatrixClientService: () => Promise<ClientServiceDeps>
  getMatrixPresenceService: () => Promise<PresenceServiceDeps>
  globalStore: ReturnType<typeof useGlobalStore>
  sessionStore: ReturnType<typeof useSessionStore>
}) {
  const userStore = useUserStore()
  const contactStore = useContactStore()
  const groupStore = useGroupStore()

  const subscribedPresenceUserIds = new Set<string>()
  let isPresenceSyncInFlight = false
  let hasPendingPresenceSync = false
  let unsubscribePresenceListener: (() => void) | null = null

  const refreshActiveGroupMembers = async () => {
    const tasks: Promise<unknown>[] = []
    try {
      const isCurrentGroup = deps.globalStore.currentSession?.type === RoomTypeEnum.GROUP
      const activeRoomId =
        (isCurrentGroup && deps.globalStore.currentSessionRoomId) ||
        deps.sessionStore.sessionList.find((item) => item.type === RoomTypeEnum.GROUP)?.roomId

      if (activeRoomId) {
        tasks.push(groupStore.getGroupUserList(activeRoomId, true))
      }
      await Promise.allSettled(tasks)
      await syncAvatarPresence()
    } catch (error) {
      logger.error('刷新群成员失败:', error)
    }
  }

  const applyPresenceToStores = async () => {
    const trackedUserIds = collectTrackedPresenceUserIds({
      currentUserId: userStore.userInfo?.uid,
      contacts: contactStore.contactsList,
      members: groupStore.allUserInfo
    })

    if (!trackedUserIds.length) return

    const clientService = await deps.getMatrixClientService()
    if (!clientService.getClient()) return

    const presenceService = await deps.getMatrixPresenceService()
    const nextSubscribedUserIds = trackedUserIds.filter((userId) => !subscribedPresenceUserIds.has(userId))
    if (nextSubscribedUserIds.length) {
      await presenceService.subscribeToPresence(nextSubscribedUserIds)
      nextSubscribedUserIds.forEach((userId) => subscribedPresenceUserIds.add(userId))
    }

    const presences = await presenceService.getBatchPresence(trackedUserIds)
    const now = Date.now()

    presences.forEach((presence: PresenceInfo) => {
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

  let stopPresenceWatch: (() => void) | null = null

  const startPresenceWatch = () => {
    stopPresenceWatch = watch(
      () =>
        collectTrackedPresenceUserIds({
          currentUserId: userStore.userInfo?.uid,
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
    if (stopPresenceWatch) {
      stopPresenceWatch()
      stopPresenceWatch = null
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
    startPresenceWatch,
    cleanup,
    getSubscribedPresenceUserIds: () => subscribedPresenceUserIds,
    getUnsubscribePresenceListener: () => unsubscribePresenceListener,
    setUnsubscribePresenceListener: (fn: (() => void) | null) => {
      unsubscribePresenceListener = fn
    }
  }
}
