import { shallowRef } from 'vue'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixRoomQueryFacade } from '@/services/matrix/room/QueryFacade'
import { Direction, EventType } from '@/services/matrix/sdk'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import type { ContactInvite } from './types'

const logger = createLogger('ContactStore.Invites')

/**
 * 群邀请模块：扫描 invite 状态的房间生成待处理邀请，并同步群未读数。
 */
export function createContactInvites() {
  const globalStore = useGlobalStore()

  const pendingInvites = shallowRef<ContactInvite[]>([])

  async function loadPendingInvites(): Promise<void> {
    const currentUserId = matrixClientService.getUserId()
    if (!currentUserId) {
      return
    }

    try {
      const rooms = await matrixRoomQueryFacade.getRooms()
      const invites: ContactInvite[] = []

      for (const room of rooms) {
        const membership = (room as { getMyMembership?: () => string | undefined }).getMyMembership?.()
        if (membership === 'invite') {
          const inviteState = room.getLiveTimeline()?.getState(Direction.Forward)
          const inviteFrom = inviteState?.getStateEvents(EventType.RoomMember, currentUserId)?.getSender()

          invites.push({
            roomId: room.roomId,
            fromUserId: inviteFrom || 'unknown',
            fromDisplayName: room.name || inviteFrom?.split(':')[0] || 'Unknown',
            timestamp: Date.now(),
            isGroup: !room.isSpaceRoom() && room.getJoinedMembers().length > 2
          })
        }
      }

      pendingInvites.value = invites
      globalStore.setGroupUnreadCount(invites.filter((i) => i.isGroup).length)
    } catch (err) {
      logger.error(`[ContactStore] 加载邀请列表失败: ${err}`)
    }
  }

  return {
    pendingInvites,
    loadPendingInvites
  }
}
