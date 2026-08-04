import { computed } from 'vue'
import { RoomTypeEnum } from '@/enums'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { isDirectMessageRoom } from '@/services/matrix/room/roomTypeUtils'
import { useGlobalStore } from '@/stores/domains/widget/global'

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
    return isDirectMessageRoom(client, id)
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
