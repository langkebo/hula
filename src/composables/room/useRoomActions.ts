import type { CreateGroupRoomOptions } from '@/services/matrix/room/CreationService'
import { matrixRoomService } from '@/services/matrix/room/MatrixRoomService'
import { roomNavigationService } from '@/services/matrix/room/RoomNavigationService'

export function useRoomActions() {
  const joinRoom = (roomIdOrAlias: string) => {
    return matrixRoomService.joinRoom(roomIdOrAlias)
  }

  const createGroupRoom = (options: CreateGroupRoomOptions) => {
    return roomNavigationService.createGroupRoom(options)
  }

  const getServerDomain = () => {
    return roomNavigationService.getServerDomain()
  }

  const inviteUser = (roomId: string, userId: string) => {
    return matrixRoomService.inviteUser(roomId, userId)
  }

  const leaveRoom = (roomId: string) => {
    return roomNavigationService.leaveRoom(roomId)
  }

  const removeMember = (roomId: string, userId: string) => {
    return roomNavigationService.removeMember(roomId, userId)
  }

  const createDirectMessage = (userId: string) => {
    return roomNavigationService.createDirectMessage(userId)
  }

  const getOrCreateDirectMessage = (userId: string, encryption?: boolean) => {
    return roomNavigationService.getOrCreateDirectMessage(userId, encryption)
  }

  const getDirectRooms = () => {
    return roomNavigationService.getDirectRooms()
  }

  return {
    joinRoom,
    createGroupRoom,
    getServerDomain,
    inviteUser,
    leaveRoom,
    removeMember,
    createDirectMessage,
    getOrCreateDirectMessage,
    getDirectRooms
  }
}
