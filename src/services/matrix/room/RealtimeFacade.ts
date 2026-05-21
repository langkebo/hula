import type { Room } from 'matrix-js-sdk'
import type { RoomTypeEnum } from '@/enums'
import type { RoomInfo } from '@/services/types'
import { matrixRoomRealtimeService, type VisibleRoomSession } from './RealtimeService'

export interface MatrixRoomRealtimeFacade {
  convertRoomToSession(room: Room): {
    roomId: string
    name: string
    avatar: string
    type: RoomTypeEnum
    unreadCount: number
    activeTime: number
  }
  onTimelineEvent(
    callback: (data: {
      roomId: string
      eventType: string
      roomInfo: RoomInfo
      message: import('@/stores/domains/chat/chat/types').MessageType | null
    }) => void
  ): void
  onRoomNameChange(callback: (roomId: string, name: string) => void): void
  onRoomAvatarChange(callback: (roomId: string, avatarUrl: string | null) => void): void
  onRoomMemberChange(callback: (roomId: string, roomInfo: RoomInfo) => void): void
  getRoomName(roomId: string): string | null
  getRoomAvatarUrl(roomId: string): string | null
  getVisibleRoomSessions(specialFriends: string[]): VisibleRoomSession[]
  getAllRoomInfos(): RoomInfo[]
}

export const matrixRoomRealtimeFacade: MatrixRoomRealtimeFacade = {
  convertRoomToSession(room) {
    return matrixRoomRealtimeService.convertRoomToSession(room)
  },

  onTimelineEvent(callback) {
    matrixRoomRealtimeService.onTimelineEvent(callback)
  },

  onRoomNameChange(callback) {
    matrixRoomRealtimeService.onRoomNameChange(callback)
  },

  onRoomAvatarChange(callback) {
    matrixRoomRealtimeService.onRoomAvatarChange(callback)
  },

  onRoomMemberChange(callback) {
    matrixRoomRealtimeService.onRoomMemberChange(callback)
  },

  getRoomName(roomId) {
    return matrixRoomRealtimeService.getRoomName(roomId)
  },

  getRoomAvatarUrl(roomId) {
    return matrixRoomRealtimeService.getRoomAvatarUrl(roomId)
  },

  getVisibleRoomSessions(specialFriends) {
    return matrixRoomRealtimeService.getVisibleRoomSessions(specialFriends)
  },

  getAllRoomInfos() {
    return matrixRoomRealtimeService.getAllRoomInfos()
  }
}
