import type { MatrixEvent, Room, RoomMember } from 'matrix-js-sdk'
import { RoomTypeEnum } from '@/enums'
import type { RoomInfo } from '@/services/types'
import matrixClientService from '../MatrixClientService'
import matrixEventServiceLocal from '../MatrixEventService'
import { matrixReceiptService } from '../messaging/MatrixReceiptService'
import matrixSlidingSyncService from '../sync/MatrixSlidingSyncService'
import { matrixRoomCreationService } from './CreationService'

const ROOM_EVENTS = {
  Timeline: 'Room.timeline',
  Name: 'Room.name',
  Avatar: 'Room.avatar',
  Member: 'Room.member'
} as const

export interface RoomSession {
  roomId: string
  name: string
  avatar: string
  type: RoomTypeEnum
  unreadCount: number
  activeTime: number
}

export interface VisibleRoomSession extends RoomSession {
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
    const type = room.getJoinedMemberCount() === 2 ? RoomTypeEnum.SINGLE : RoomTypeEnum.GROUP
    const unreadCount = matrixReceiptService.getUnreadCount(room.roomId)
    const lastEvent = room.getLiveTimeline().getEvents().slice(-1)[0]
    const activeTime = lastEvent?.getTs?.() || 0

    return {
      roomId: room.roomId,
      name,
      avatar,
      type,
      unreadCount,
      activeTime
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
            if (event.getType() === 'm.room.message') {
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
