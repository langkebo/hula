import { computed, type Ref } from 'vue'
import { RoomTypeEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import type { FriendItem } from '@/services/types'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGlobalStore } from '@/stores/domains/widget/global'

/**
 * 聊天底部栏覆盖层状态管理
 * 管理单聊会话准备中、非好友、只读房间等覆盖层状态
 */
export function useFooterOverlays(detailId: Ref<string>) {
  const globalStore = useGlobalStore()
  const contactStore = useContactStore()

  const isSingleChat = computed(() => {
    return globalStore.currentSession?.type === RoomTypeEnum.SINGLE
  })

  const isSessionTargetPending = computed(() => {
    return isSingleChat.value && !detailId.value
  })

  /** 是否是好友关系 */
  const isFriend = computed(() => {
    if (!isSingleChat.value) return true
    const target = detailId.value
    if (!target) return true
    return contactStore.contactsList.some((contact: FriendItem) => contact.uid === target)
  })

  const isRoomReadonly = computed(() => {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) return false
    const room = matrixClientService.getRoom(roomId)
    if (!room) return false
    const tombstoneEvent = room.currentState.getStateEvents('m.room.tombstone', '')
    if (tombstoneEvent) return true
    const membership = room.getMyMembership?.()
    if (membership !== 'join') return true
    return false
  })

  return {
    isSingleChat,
    isSessionTargetPending,
    isFriend,
    isRoomReadonly
  }
}
