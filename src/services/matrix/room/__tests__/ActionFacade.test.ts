import { beforeEach, describe, expect, it, vi } from 'vitest'

const { creationServiceMock, membershipServiceMock, accountDataServiceMock, roomOperationsMock } = vi.hoisted(() => ({
  creationServiceMock: {
    createRoom: vi.fn(),
    createGroupRoom: vi.fn()
  },
  membershipServiceMock: {
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    inviteUser: vi.fn(),
    kickUser: vi.fn(),
    banUser: vi.fn(),
    unbanUser: vi.fn(),
    forgetRoom: vi.fn(),
    knockRoom: vi.fn(),
    joinRoomByAlias: vi.fn()
  },
  accountDataServiceMock: {
    setRoomAccountData: vi.fn(),
    setReadLifetime: vi.fn()
  },
  roomOperationsMock: {
    createDirectRoom: vi.fn(),
    setDirectRoom: vi.fn(),
    setRoomName: vi.fn(),
    setRoomTopic: vi.fn(),
    setRoomAvatar: vi.fn(),
    setRoomVisibility: vi.fn(),
    getRoomVisibility: vi.fn(),
    setPushRule: vi.fn(),
    setAlias: vi.fn(),
    deleteAlias: vi.fn(),
    setPinnedEvents: vi.fn(),
    pinEvent: vi.fn(),
    unpinEvent: vi.fn(),
    setStickyEvents: vi.fn(),
    setTag: vi.fn(),
    removeTag: vi.fn(),
    setInviteBlocklist: vi.fn(),
    setInviteAllowlist: vi.fn(),
    upgradeRoom: vi.fn(),
    incrementUnread: vi.fn(),
    clearUnread: vi.fn()
  }
}))

vi.mock('../CreationService', () => ({
  matrixRoomCreationService: creationServiceMock
}))

vi.mock('../MembershipService', () => ({
  matrixRoomMembershipService: membershipServiceMock
}))

vi.mock('../AccountDataService', () => ({
  matrixRoomAccountDataService: accountDataServiceMock
}))

vi.mock('../RoomOperations', () => ({
  roomOperations: roomOperationsMock
}))

import { matrixRoomActionFacade } from '../ActionFacade'

describe('matrixRoomActionFacade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('CreationService 委托', () => {
    it('createRoom 委托并返回结果', async () => {
      const room = { roomId: '!new:e' } as never
      const opts = { name: 'test' } as never
      creationServiceMock.createRoom.mockResolvedValue(room)
      const result = await matrixRoomActionFacade.createRoom(opts)
      expect(creationServiceMock.createRoom).toHaveBeenCalledWith(opts)
      expect(result).toBe(room)
    })

    it('createGroupRoom 委托并返回结果', async () => {
      const room = { roomId: '!g:e' } as never
      const opts = { name: 'grp' } as never
      creationServiceMock.createGroupRoom.mockResolvedValue(room)
      const result = await matrixRoomActionFacade.createGroupRoom(opts)
      expect(creationServiceMock.createGroupRoom).toHaveBeenCalledWith(opts)
      expect(result).toBe(room)
    })

    it('createRoom 透传错误', async () => {
      creationServiceMock.createRoom.mockRejectedValue(new Error('bad'))
      await expect(matrixRoomActionFacade.createRoom({} as never)).rejects.toThrow('bad')
    })
  })

  describe('RoomOperations 委托', () => {
    it('createDirectRoom 委托', async () => {
      roomOperationsMock.createDirectRoom.mockResolvedValue('!dm:e')
      const result = await matrixRoomActionFacade.createDirectRoom('@u:e')
      expect(roomOperationsMock.createDirectRoom).toHaveBeenCalledWith('@u:e')
      expect(result).toBe('!dm:e')
    })

    it('setDirectRoom 委托', async () => {
      roomOperationsMock.setDirectRoom.mockResolvedValue(undefined)
      await matrixRoomActionFacade.setDirectRoom('@u:e', '!r:e')
      expect(roomOperationsMock.setDirectRoom).toHaveBeenCalledWith('@u:e', '!r:e')
    })

    it('setRoomName 委托', async () => {
      roomOperationsMock.setRoomName.mockResolvedValue(undefined)
      await matrixRoomActionFacade.setRoomName('!r:e', 'N')
      expect(roomOperationsMock.setRoomName).toHaveBeenCalledWith('!r:e', 'N')
    })

    it('setRoomTopic 委托', async () => {
      roomOperationsMock.setRoomTopic.mockResolvedValue(undefined)
      await matrixRoomActionFacade.setRoomTopic('!r:e', 'T')
      expect(roomOperationsMock.setRoomTopic).toHaveBeenCalledWith('!r:e', 'T')
    })

    it('setRoomAvatar 委托', async () => {
      roomOperationsMock.setRoomAvatar.mockResolvedValue(undefined)
      await matrixRoomActionFacade.setRoomAvatar('!r:e', 'mxc://x')
      expect(roomOperationsMock.setRoomAvatar).toHaveBeenCalledWith('!r:e', 'mxc://x')
    })

    it('setRoomVisibility 委托', async () => {
      roomOperationsMock.setRoomVisibility.mockResolvedValue(undefined)
      await matrixRoomActionFacade.setRoomVisibility('!r:e', 'public')
      expect(roomOperationsMock.setRoomVisibility).toHaveBeenCalledWith('!r:e', 'public')
    })

    it('getRoomVisibility 委托并返回结果', async () => {
      roomOperationsMock.getRoomVisibility.mockResolvedValue('private')
      const result = await matrixRoomActionFacade.getRoomVisibility('!r:e')
      expect(roomOperationsMock.getRoomVisibility).toHaveBeenCalledWith('!r:e')
      expect(result).toBe('private')
    })

    it('setPushRule 委托', async () => {
      roomOperationsMock.setPushRule.mockResolvedValue(undefined)
      await matrixRoomActionFacade.setPushRule('!r:e', true)
      expect(roomOperationsMock.setPushRule).toHaveBeenCalledWith('!r:e', true)
    })

    it('setRoomAlias 委托', async () => {
      roomOperationsMock.setAlias.mockResolvedValue(undefined)
      await matrixRoomActionFacade.setRoomAlias('!r:e', '#a:e')
      expect(roomOperationsMock.setAlias).toHaveBeenCalledWith('!r:e', '#a:e')
    })

    it('deleteRoomAlias 委托', async () => {
      roomOperationsMock.deleteAlias.mockResolvedValue(undefined)
      await matrixRoomActionFacade.deleteRoomAlias('#a:e')
      expect(roomOperationsMock.deleteAlias).toHaveBeenCalledWith('#a:e')
    })

    it('setPinnedEvents 委托', async () => {
      roomOperationsMock.setPinnedEvents.mockResolvedValue(undefined)
      await matrixRoomActionFacade.setPinnedEvents('!r:e', ['$1', '$2'])
      expect(roomOperationsMock.setPinnedEvents).toHaveBeenCalledWith('!r:e', ['$1', '$2'])
    })

    it('pinEvent 委托', async () => {
      roomOperationsMock.pinEvent.mockResolvedValue(undefined)
      await matrixRoomActionFacade.pinEvent('!r:e', '$e')
      expect(roomOperationsMock.pinEvent).toHaveBeenCalledWith('!r:e', '$e')
    })

    it('unpinEvent 委托', async () => {
      roomOperationsMock.unpinEvent.mockResolvedValue(undefined)
      await matrixRoomActionFacade.unpinEvent('!r:e', '$e')
      expect(roomOperationsMock.unpinEvent).toHaveBeenCalledWith('!r:e', '$e')
    })

    it('setStickyEvents 委托', async () => {
      roomOperationsMock.setStickyEvents.mockResolvedValue(undefined)
      const events = { sticky: ['$e'] } as never
      await matrixRoomActionFacade.setStickyEvents('!r:e', events)
      expect(roomOperationsMock.setStickyEvents).toHaveBeenCalledWith('!r:e', events)
    })

    it('setTag 委托（带 order）', async () => {
      roomOperationsMock.setTag.mockResolvedValue(undefined)
      await matrixRoomActionFacade.setTag('!r:e', 'm.favourite', 0.5)
      expect(roomOperationsMock.setTag).toHaveBeenCalledWith('!r:e', 'm.favourite', 0.5)
    })

    it('setTag 委托（无 order）', async () => {
      roomOperationsMock.setTag.mockResolvedValue(undefined)
      await matrixRoomActionFacade.setTag('!r:e', 'm.lowpriority')
      expect(roomOperationsMock.setTag).toHaveBeenCalledWith('!r:e', 'm.lowpriority', undefined)
    })

    it('removeTag 委托', async () => {
      roomOperationsMock.removeTag.mockResolvedValue(undefined)
      await matrixRoomActionFacade.removeTag('!r:e', 'm.favourite')
      expect(roomOperationsMock.removeTag).toHaveBeenCalledWith('!r:e', 'm.favourite')
    })

    it('setInviteBlocklist 委托', async () => {
      roomOperationsMock.setInviteBlocklist.mockResolvedValue(undefined)
      await matrixRoomActionFacade.setInviteBlocklist('!r:e', ['@a:e'])
      expect(roomOperationsMock.setInviteBlocklist).toHaveBeenCalledWith('!r:e', ['@a:e'])
    })

    it('setInviteAllowlist 委托', async () => {
      roomOperationsMock.setInviteAllowlist.mockResolvedValue(undefined)
      await matrixRoomActionFacade.setInviteAllowlist('!r:e', ['@a:e'])
      expect(roomOperationsMock.setInviteAllowlist).toHaveBeenCalledWith('!r:e', ['@a:e'])
    })

    it('upgradeRoom 委托并返回新房间 ID', async () => {
      roomOperationsMock.upgradeRoom.mockResolvedValue('!new:e')
      const result = await matrixRoomActionFacade.upgradeRoom('!r:e', '11')
      expect(roomOperationsMock.upgradeRoom).toHaveBeenCalledWith('!r:e', '11')
      expect(result).toBe('!new:e')
    })

    it('incrementUnread 委托（带 highlight）', async () => {
      roomOperationsMock.incrementUnread.mockResolvedValue(undefined)
      await matrixRoomActionFacade.incrementUnread('!r:e', true)
      expect(roomOperationsMock.incrementUnread).toHaveBeenCalledWith('!r:e', true)
    })

    it('incrementUnread 委托（无 highlight）', async () => {
      roomOperationsMock.incrementUnread.mockResolvedValue(undefined)
      await matrixRoomActionFacade.incrementUnread('!r:e')
      expect(roomOperationsMock.incrementUnread).toHaveBeenCalledWith('!r:e', undefined)
    })

    it('clearUnread 委托', async () => {
      roomOperationsMock.clearUnread.mockResolvedValue(undefined)
      await matrixRoomActionFacade.clearUnread('!r:e')
      expect(roomOperationsMock.clearUnread).toHaveBeenCalledWith('!r:e')
    })

    it('透传 roomOperations 错误', async () => {
      roomOperationsMock.setRoomName.mockRejectedValue(new Error('forbidden'))
      await expect(matrixRoomActionFacade.setRoomName('!r:e', 'x')).rejects.toThrow('forbidden')
    })
  })

  describe('MembershipService 委托', () => {
    it('joinRoom 委托并返回 Room', async () => {
      const room = { roomId: '!r:e' } as never
      membershipServiceMock.joinRoom.mockResolvedValue(room)
      const result = await matrixRoomActionFacade.joinRoom('!r:e')
      expect(membershipServiceMock.joinRoom).toHaveBeenCalledWith('!r:e')
      expect(result).toBe(room)
    })

    it('leaveRoom 委托', async () => {
      membershipServiceMock.leaveRoom.mockResolvedValue(undefined)
      await matrixRoomActionFacade.leaveRoom('!r:e')
      expect(membershipServiceMock.leaveRoom).toHaveBeenCalledWith('!r:e')
    })

    it('inviteUser 委托', async () => {
      membershipServiceMock.inviteUser.mockResolvedValue(undefined)
      await matrixRoomActionFacade.inviteUser('!r:e', '@u:e')
      expect(membershipServiceMock.inviteUser).toHaveBeenCalledWith('!r:e', '@u:e')
    })

    it('kickUser 委托（带 reason）', async () => {
      membershipServiceMock.kickUser.mockResolvedValue(undefined)
      await matrixRoomActionFacade.kickUser('!r:e', '@u:e', 'spam')
      expect(membershipServiceMock.kickUser).toHaveBeenCalledWith('!r:e', '@u:e', 'spam')
    })

    it('kickUser 委托（无 reason）', async () => {
      membershipServiceMock.kickUser.mockResolvedValue(undefined)
      await matrixRoomActionFacade.kickUser('!r:e', '@u:e')
      expect(membershipServiceMock.kickUser).toHaveBeenCalledWith('!r:e', '@u:e', undefined)
    })

    it('banUser 委托（带 reason）', async () => {
      membershipServiceMock.banUser.mockResolvedValue(undefined)
      await matrixRoomActionFacade.banUser('!r:e', '@u:e', 'abuse')
      expect(membershipServiceMock.banUser).toHaveBeenCalledWith('!r:e', '@u:e', 'abuse')
    })

    it('unbanUser 委托', async () => {
      membershipServiceMock.unbanUser.mockResolvedValue(undefined)
      await matrixRoomActionFacade.unbanUser('!r:e', '@u:e')
      expect(membershipServiceMock.unbanUser).toHaveBeenCalledWith('!r:e', '@u:e')
    })

    it('forgetRoom 委托', async () => {
      membershipServiceMock.forgetRoom.mockResolvedValue(undefined)
      await matrixRoomActionFacade.forgetRoom('!r:e')
      expect(membershipServiceMock.forgetRoom).toHaveBeenCalledWith('!r:e')
    })

    it('knockRoom 委托（带 reason 和 viaServers）', async () => {
      membershipServiceMock.knockRoom.mockResolvedValue({ room_id: '!r:e' })
      const result = await matrixRoomActionFacade.knockRoom('!r:e', 'plz', ['srv'])
      expect(membershipServiceMock.knockRoom).toHaveBeenCalledWith('!r:e', 'plz', ['srv'])
      expect(result).toEqual({ room_id: '!r:e' })
    })

    it('knockRoom 委托（无 reason/viaServers）', async () => {
      membershipServiceMock.knockRoom.mockResolvedValue({ room_id: '!r:e' })
      await matrixRoomActionFacade.knockRoom('!r:e')
      expect(membershipServiceMock.knockRoom).toHaveBeenCalledWith('!r:e', undefined, undefined)
    })

    it('joinRoomByAlias 委托', async () => {
      membershipServiceMock.joinRoomByAlias.mockResolvedValue({ room_id: '!r:e' })
      const result = await matrixRoomActionFacade.joinRoomByAlias('#a:e', ['srv'])
      expect(membershipServiceMock.joinRoomByAlias).toHaveBeenCalledWith('#a:e', ['srv'])
      expect(result).toEqual({ room_id: '!r:e' })
    })

    it('透传 membership 错误', async () => {
      membershipServiceMock.inviteUser.mockRejectedValue(new Error('nope'))
      await expect(matrixRoomActionFacade.inviteUser('!r:e', '@u:e')).rejects.toThrow('nope')
    })
  })

  describe('AccountDataService 委托', () => {
    it('setRoomAccountData 委托', async () => {
      accountDataServiceMock.setRoomAccountData.mockResolvedValue(undefined)
      const content = { foo: 1 } as never
      await matrixRoomActionFacade.setRoomAccountData('!r:e', 'm.x', content)
      expect(accountDataServiceMock.setRoomAccountData).toHaveBeenCalledWith('!r:e', 'm.x', content)
    })

    it('setReadLifetime 委托', async () => {
      accountDataServiceMock.setReadLifetime.mockResolvedValue(undefined)
      await matrixRoomActionFacade.setReadLifetime('!r:e', 5000)
      expect(accountDataServiceMock.setReadLifetime).toHaveBeenCalledWith('!r:e', 5000)
    })

    it('透传 accountData 错误', async () => {
      accountDataServiceMock.setReadLifetime.mockRejectedValue(new Error('bad'))
      await expect(matrixRoomActionFacade.setReadLifetime('!r:e', 1)).rejects.toThrow('bad')
    })
  })
})
