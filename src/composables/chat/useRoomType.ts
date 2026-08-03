import { computed } from 'vue'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { RoomTypeEnum } from '@/enums'

/**
 * 同步判断当前会话房间类型（DM/群聊）
 *
 * 优先级：
 * 1. m.direct account data（Matrix DM 标记，最可靠）
 * 2. globalStore.currentSession.type（session 列表派生值，可能因 m.direct 加载延迟而不准确）
 */
export function useRoomType() {
  const globalStore = useGlobalStore()

  /** 当前会话 roomId */
  const roomId = computed(() => globalStore.currentSessionRoomId)

  /** 通过 m.direct account data 同步判断当前房间是否为 DM */
  const isDirectMessage = computed(() => {
    const id = roomId.value
    if (!id) return false

    const client = matrixClientService.getClient()
    if (!client) return false

    // 1. 优先检查 m.direct account data
    const directAccount = client.getAccountData('m.direct')
    const directMap = directAccount?.getContent() as Record<string, { room_id: string }[]> | undefined
    if (directMap) {
      const isDm = Object.values(directMap).some((rooms) => rooms?.some((r) => r?.room_id === id))
      if (isDm) return true
    }

    // 2. 检查 Room 对象的 DM 标记（SDK 内部状态）
    const room = client.getRoom(id)
    if (room) {
      const dmInviter = room.getDMInviter()
      if (dmInviter) return true
    }

    return false
  })

  /** 当前房间是否为群聊（非 DM） */
  const isGroup = computed(() => {
    // DM 房间一定不是群聊
    if (isDirectMessage.value) return false
    // 回退到 session.type
    return globalStore.currentSession?.type === RoomTypeEnum.GROUP
  })

  return {
    roomId,
    isDirectMessage,
    isGroup
  }
}
