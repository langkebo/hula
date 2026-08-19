import type { MatrixEvent, Room, RoomMember } from 'matrix-js-sdk'
import { RoomTypeEnum } from '@/enums'
import type { RoomInfo } from '@/services/types'
import matrixClientService from '../MatrixClientService'
import matrixEventServiceLocal from '../MatrixEventService'
import { matrixReceiptService } from '../messaging/MatrixReceiptService'
import matrixSlidingSyncService from '../sync/MatrixSlidingSyncService'
import { matrixRoomCreationService } from './CreationService'
import { findDmCounterpart, isDirectMessageRoomFromRoom } from './roomTypeUtils'

const ROOM_EVENTS = {
  Timeline: 'Room.timeline',
  Name: 'Room.name',
  Avatar: 'Room.avatar',
  Member: 'Room.member'
} as const

/**
 * 实时位置共享（beacon）中可渲染为独立 BEACON 气泡的事件类型，含 MSC3672 不稳定前缀。
 * 实时时间线需将这些事件 dispatch 到 convertEventToMessage，
 * 否则会被当作普通事件丢弃（message 为 null）而无法渲染。
 * m.beacon（位置更新）不在此列：它通过 m.relates_to 关联到 beacon_info，
 * 不单独成气泡（Blocker 3）。
 */
const BEACON_EVENT_TYPES = new Set<string>(['m.beacon_info', 'org.matrix.msc3672.beacon_info'])

interface RoomSession {
  roomId: string
  name: string
  avatar: string
  type: RoomTypeEnum
  unreadCount: number
  activeTime: number
  /** DM 对方用户 MXID（单聊时填充，供下游按 counterpart 去重；历史重复 DM 房间靠它合并） */
  detailId?: string
  account?: string
}

interface VisibleRoomSession extends RoomSession {
  isFavorite: boolean
}

/**
 * Realtime / view-layer domain service.
 *
 * Groups two concerns that share live-client reads:
 * - SDK event subscription wrappers (`onTimelineEvent` / `onRoomNameChange` / `onRoomAvatarChange` / `onRoomMemberChange`)
 * - Room → view-model projections for list UIs (`convertRoomToSession` / `getVisibleRoomSessions` / `getAllRoomInfos` / `getRoomName` / `getRoomAvatarUrl`)
 *
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomRealtimeService {
  convertRoomToSession(room: Room): RoomSession {
    const name = room.name || 'Unknown Room'
    const avatar = room.getMxcAvatarUrl() || ''
    // 判断是否为单聊：优先检查 m.direct account data（DM 标记），
    // 回退到 getJoinedMemberCount() === 2（成员数判断）
    const client = matrixClientService.getClient()
    const isDm = isDirectMessageRoomFromRoom(client, room)
    const type = isDm || room.getJoinedMemberCount() === 2 ? RoomTypeEnum.SINGLE : RoomTypeEnum.GROUP
    const unreadCount = matrixReceiptService.getUnreadCount(room.roomId)
    const lastEvent = room.getLiveTimeline().getEvents().slice(-1)[0]
    const activeTime = lastEvent?.getTs?.() || 0

    // 单聊补 counterpart：从房间成员中解析「除自己外的另一名成员」作为 detailId/account。
    // 与 MatrixSessionService.buildSessionFromRoom 一致——缺失该字段时，下游按 detailId
    // 的会话去重会退回空值，导致同一联系人的多个历史 DM 房间在会话列表重复出现。
    // 用 findDmCounterpart：优先 join 成员，回退 invite/任意成员，且不会误取自己。
    let detailId: string | undefined
    if (type === RoomTypeEnum.SINGLE && client) {
      try {
        const selfId = client.getUserId?.()
        // selfId 未知时无法可靠区分自己/对方，宁可留空（下游按 roomId 兜底），
        // 也不能误把「自己」当 counterpart，否则所有 DM 会被合并成一条。
        if (selfId) {
          detailId = findDmCounterpart(room, selfId)
        }
      } catch {
        detailId = undefined
      }
    }

    return {
      roomId: room.roomId,
      name,
      avatar,
      type,
      unreadCount,
      activeTime,
      ...(detailId ? { detailId, account: detailId } : {})
    }
  }

  onTimelineEvent(
    callback: (data: {
      roomId: string
      eventType: string
      roomInfo: RoomInfo
      message: import('@/stores/domains/chat/chat/types').MessageType | null
    }) => void
  ): void {
    const client = matrixClientService.getClient()
    if (!client) return

    const emitTimelineEvent = (event: MatrixEvent, room: Room): void => {
      const eventType = event.getType()
      const roomInfo = matrixRoomCreationService.convertRoomToRoomInfo(room)
      let message: import('@/stores/domains/chat/chat/types').MessageType | null = null

      if (eventType === 'm.room.message') {
        message = matrixEventServiceLocal.convertEventToMessage(event, room)
      } else if (eventType === 'm.room.encrypted') {
        message = matrixEventServiceLocal.convertEventToMessageType(event)
      } else if (BEACON_EVENT_TYPES.has(eventType)) {
        message = matrixEventServiceLocal.convertEventToMessage(event, room)
      }

      callback({
        roomId: room.roomId,
        eventType,
        roomInfo,
        message
      })
    }

    client.on(ROOM_EVENTS.Timeline, (event: MatrixEvent, room: Room | undefined) => {
      if (!room) return
      emitTimelineEvent(event, room)

      if (event.getType() === 'm.room.encrypted') {
        for (const delay of [250, 1000, 3000]) {
          setTimeout(() => {
            if (event.getType() === 'm.room.message' || BEACON_EVENT_TYPES.has(event.getType())) {
              emitTimelineEvent(event, room)
            }
          }, delay)
        }
      }
    })
  }

  onRoomNameChange(callback: (roomId: string, name: string) => void): void {
    const client = matrixClientService.getClient()
    if (!client) return

    client.on(ROOM_EVENTS.Name, (room: Room) => {
      callback(room.roomId, room.name)
    })
  }

  onRoomAvatarChange(callback: (roomId: string, avatarUrl: string | null) => void): void {
    const client = matrixClientService.getClient()
    if (!client) return

    client.on(ROOM_EVENTS.Avatar, (room: Room) => {
      callback(room.roomId, room.getMxcAvatarUrl?.() ?? null)
    })
  }

  onRoomMemberChange(callback: (roomId: string, roomInfo: RoomInfo) => void): void {
    const client = matrixClientService.getClient()
    if (!client) return

    client.on(ROOM_EVENTS.Member, (_event: MatrixEvent, member: RoomMember) => {
      const roomId = member.roomId
      const room = client.getRoom(roomId)
      if (room) {
        const roomInfo = matrixRoomCreationService.convertRoomToRoomInfo(room)
        callback(roomId, roomInfo)
      }
    })
  }

  getRoomName(roomId: string): string | null {
    const client = matrixClientService.getClient()
    if (!client) return null
    const room = client.getRoom(roomId)
    return room?.name ?? null
  }

  getRoomAvatarUrl(roomId: string): string | null {
    const client = matrixClientService.getClient()
    if (!client) return null
    const room = client.getRoom(roomId)
    return room?.getMxcAvatarUrl?.() ?? null
  }

  getVisibleRoomSessions(specialFriends: string[]): VisibleRoomSession[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const currentUserId = client.getUserId()
    const rooms = client.getVisibleRooms()

    return rooms.map((room) => {
      const session = this.convertRoomToSession(room)
      const otherMember = room.getJoinedMembers().find((m) => m.userId !== currentUserId)
      const isFavorite = !!(otherMember && specialFriends.includes(otherMember.userId))

      return {
        ...session,
        isFavorite
      }
    })
  }

  getAllRoomInfos(): RoomInfo[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    const roomInfos = client.getRooms().map((room) => matrixRoomCreationService.convertRoomToRoomInfo(room))
    matrixSlidingSyncService.applySlidingSyncUnreadCounts(roomInfos)
    return roomInfos
  }
}

export const matrixRoomRealtimeService = new MatrixRoomRealtimeService()
