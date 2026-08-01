import { beforeEach, describe, expect, it, vi } from 'vitest'

const { roomOperationsMock } = vi.hoisted(() => ({
  roomOperationsMock: {
    setMemberDisplayName: vi.fn(),
    getMemberDisplayName: vi.fn(),
    setMemberPowerLevel: vi.fn(),
    setMemberAsAdmin: vi.fn(),
    removeMemberAsAdmin: vi.fn()
  }
}))

vi.mock('../RoomOperations', () => ({
  roomOperations: roomOperationsMock
}))

import { matrixRoomMemberFacade } from '../MemberFacade'

describe('matrixRoomMemberFacade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setMemberDisplayName', () => {
    it('委托给 roomOperations.setMemberDisplayName', async () => {
      roomOperationsMock.setMemberDisplayName.mockResolvedValue(undefined)
      await matrixRoomMemberFacade.setMemberDisplayName('!r:e', 'Alice')
      expect(roomOperationsMock.setMemberDisplayName).toHaveBeenCalledWith('!r:e', 'Alice')
    })

    it('透传错误', async () => {
      roomOperationsMock.setMemberDisplayName.mockRejectedValue(new Error('forbidden'))
      await expect(matrixRoomMemberFacade.setMemberDisplayName('!r:e', 'x')).rejects.toThrow('forbidden')
    })
  })

  describe('getMemberDisplayName', () => {
    it('委托并返回结果', async () => {
      roomOperationsMock.getMemberDisplayName.mockResolvedValue('Bob')
      const result = await matrixRoomMemberFacade.getMemberDisplayName('!r:e', '@b:e')
      expect(roomOperationsMock.getMemberDisplayName).toHaveBeenCalledWith('!r:e', '@b:e')
      expect(result).toBe('Bob')
    })

    it('返回 null 当底层返回 null', async () => {
      roomOperationsMock.getMemberDisplayName.mockResolvedValue(null)
      const result = await matrixRoomMemberFacade.getMemberDisplayName('!r:e', '@b:e')
      expect(result).toBeNull()
    })
  })

  describe('setMemberPowerLevel', () => {
    it('委托并传递 powerLevel 参数', async () => {
      roomOperationsMock.setMemberPowerLevel.mockResolvedValue(undefined)
      await matrixRoomMemberFacade.setMemberPowerLevel('!r:e', '@u:e', 100)
      expect(roomOperationsMock.setMemberPowerLevel).toHaveBeenCalledWith('!r:e', '@u:e', 100)
    })

    it('支持 powerLevel=0', async () => {
      roomOperationsMock.setMemberPowerLevel.mockResolvedValue(undefined)
      await matrixRoomMemberFacade.setMemberPowerLevel('!r:e', '@u:e', 0)
      expect(roomOperationsMock.setMemberPowerLevel).toHaveBeenCalledWith('!r:e', '@u:e', 0)
    })
  })

  describe('setMemberAsAdmin', () => {
    it('委托给 roomOperations.setMemberAsAdmin', async () => {
      roomOperationsMock.setMemberAsAdmin.mockResolvedValue(undefined)
      await matrixRoomMemberFacade.setMemberAsAdmin('!r:e', '@u:e')
      expect(roomOperationsMock.setMemberAsAdmin).toHaveBeenCalledWith('!r:e', '@u:e')
    })
  })

  describe('removeMemberAsAdmin', () => {
    it('委托给 roomOperations.removeMemberAsAdmin', async () => {
      roomOperationsMock.removeMemberAsAdmin.mockResolvedValue(undefined)
      await matrixRoomMemberFacade.removeMemberAsAdmin('!r:e', '@u:e')
      expect(roomOperationsMock.removeMemberAsAdmin).toHaveBeenCalledWith('!r:e', '@u:e')
    })

    it('透传错误', async () => {
      roomOperationsMock.removeMemberAsAdmin.mockRejectedValue(new Error('nope'))
      await expect(matrixRoomMemberFacade.removeMemberAsAdmin('!r:e', '@u:e')).rejects.toThrow('nope')
    })
  })
})
