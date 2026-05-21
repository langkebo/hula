import { matrixRoomMemberProfileService } from './MemberProfileService'

export interface MatrixRoomMemberFacade {
  setMemberDisplayName(roomId: string, displayName: string): Promise<void>
  getMemberDisplayName(roomId: string, userId: string): Promise<string | null>
  setMemberPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<void>
  setMemberAsAdmin(roomId: string, userId: string): Promise<void>
  removeMemberAsAdmin(roomId: string, userId: string): Promise<void>
}

export const matrixRoomMemberFacade: MatrixRoomMemberFacade = {
  async setMemberDisplayName(roomId, displayName) {
    return matrixRoomMemberProfileService.setMemberDisplayName(roomId, displayName)
  },

  async getMemberDisplayName(roomId, userId) {
    return matrixRoomMemberProfileService.getMemberDisplayName(roomId, userId)
  },

  async setMemberPowerLevel(roomId, userId, powerLevel) {
    return matrixRoomMemberProfileService.setMemberPowerLevel(roomId, userId, powerLevel)
  },

  async setMemberAsAdmin(roomId, userId) {
    return matrixRoomMemberProfileService.setMemberAsAdmin(roomId, userId)
  },

  async removeMemberAsAdmin(roomId, userId) {
    return matrixRoomMemberProfileService.removeMemberAsAdmin(roomId, userId)
  }
}
