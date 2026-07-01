import type { CreateGroupRoomOptions } from '@/services/matrix/room/CreationService'
import { matrixDirectMessageService } from '@/services/matrix/room/MatrixDirectMessageService'
import { matrixRoomService } from '@/services/matrix/room/MatrixRoomService'

export function useRoomActions() {
  const joinRoom = (roomIdOrAlias: string) => {
    return matrixRoomService.joinRoom(roomIdOrAlias)
  }

  const createGroupRoom = (options: CreateGroupRoomOptions) => {
    return matrixRoomService.createGroupRoom(options)
  }

  const getServerDomain = () => {
    return matrixRoomService.getServerDomain()
  }

  const inviteUser = (roomId: string, userId: string) => {
    return matrixRoomService.inviteUser(roomId, userId)
  }

  const leaveRoom = (roomId: string) => {
    return matrixRoomService.leaveRoom(roomId)
  }

  const removeMember = (roomId: string, userId: string) => {
    return matrixRoomService.kickUser(roomId, userId)
  }

  const createDirectMessage = (userId: string) => {
    return matrixDirectMessageService.createDm(userId)
  }

  const getOrCreateDirectMessage = (userId: string, encryption?: boolean) => {
    return matrixDirectMessageService.getOrCreateDmRoom(userId, encryption)
  }

  const getDirectRooms = () => {
    return matrixDirectMessageService.getDMRooms()
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
