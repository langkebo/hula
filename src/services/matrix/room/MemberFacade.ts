import { roomOperations } from './RoomOperations'

interface MatrixRoomMemberFacade {
  setMemberDisplayName(roomId: string, displayName: string): Promise<void>
  getMemberDisplayName(roomId: string, userId: string): Promise<string | null>
  setMemberPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<void>
  setMemberAsAdmin(roomId: string, userId: string): Promise<void>
  removeMemberAsAdmin(roomId: string, userId: string): Promise<void>
}

export const matrixRoomMemberFacade: MatrixRoomMemberFacade = {
  setMemberDisplayName: (roomId, displayName) => roomOperations.setMemberDisplayName(roomId, displayName),
  getMemberDisplayName: (roomId, userId) => roomOperations.getMemberDisplayName(roomId, userId),
  setMemberPowerLevel: (roomId, userId, powerLevel) => roomOperations.setMemberPowerLevel(roomId, userId, powerLevel),
  setMemberAsAdmin: (roomId, userId) => roomOperations.setMemberAsAdmin(roomId, userId),
  removeMemberAsAdmin: (roomId, userId) => roomOperations.removeMemberAsAdmin(roomId, userId)
}
