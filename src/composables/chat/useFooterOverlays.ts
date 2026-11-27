import { computed, onMounted, onUnmounted, type Ref, ref, watch } from 'vue'
import { RoomTypeEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { ClientEvent, type MatrixClient, type Room, RoomEvent } from '@/services/matrix/sdk'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGlobalStore } from '@/stores/domains/widget/global'

/**
 * 聊天底部栏覆盖层状态管理
 * 管理单聊会话准备中、非好友、只读房间等覆盖层状态
 */
export function useFooterOverlays(detailId: Ref<string>) {
  const globalStore = useGlobalStore()
  const contactStore = useContactStore()

  // SDK 的房间成员关系不是响应式数据，直接读取会让 computed 缓存陈旧值
  // （典型场景：私聊房间处于 invite，接受邀请加入后仍显示“只读”）。
  // 这里维护一份响应式快照，并订阅 SDK 的成员关系变化与房间新增事件来刷新。
  const myMembership = ref<string | null>(null)
  let subscribedClient: MatrixClient | null = null

  const syncMembership = () => {
    const roomId = globalStore.currentSessionRoomId
    const room = roomId ? matrixClientService.getRoom(roomId) : null
    myMembership.value = room?.getMyMembership?.() ?? null
  }

  const handleMembershipChange = (room: Room) => {
    if (room?.roomId === globalStore.currentSessionRoomId) {
      syncMembership()
    }
  }

  const handleRoomAdded = () => {
    syncMembership()
  }

  const detachSdkListeners = () => {
    if (!subscribedClient) return
    subscribedClient.off(RoomEvent.MyMembership, handleMembershipChange)
    subscribedClient.off(ClientEvent.Room, handleRoomAdded)
    subscribedClient = null
  }

  const attachSdkListeners = () => {
    syncMembership()
    const client = matrixClientService.getClient()
    if (!client || client === subscribedClient) return
    detachSdkListeners()
    subscribedClient = client
    client.on(RoomEvent.MyMembership, handleMembershipChange)
    client.on(ClientEvent.Room, handleRoomAdded)
  }

  onMounted(attachSdkListeners)
  watch(() => globalStore.currentSessionRoomId, attachSdkListeners)
  onUnmounted(detachSdkListeners)

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
    return contactStore.contactsList.some((contact) => contact.userId === target)
  })

  const isRoomReadonly = computed(() => {
    const roomId = globalStore.currentSessionRoomId
    if (!roomId) return false
    const room = matrixClientService.getRoom(roomId)
    if (!room) return false
    const tombstoneEvent = room.currentState.getStateEvents('m.room.tombstone', '')
    if (tombstoneEvent) return true
    return myMembership.value !== 'join'
  })

  return {
    isSingleChat,
    isSessionTargetPending,
    isFriend,
    isRoomReadonly
  }
}
