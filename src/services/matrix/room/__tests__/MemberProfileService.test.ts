import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock() }
}))

const { MatrixRoomMemberProfileService } = await import('../MemberProfileService')

describe('MatrixRoomMemberProfileService', () => {
  let service: InstanceType<typeof MatrixRoomMemberProfileService>

  beforeEach(() => {
    service = new MatrixRoomMemberProfileService()
    getClientMock.mockReset()
  })

  describe('setMemberDisplayName', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.setMemberDisplayName('!r', 'Me')).rejects.toThrow('客户端未初始化')
    })

    it('throws when user is not logged in', async () => {
      getClientMock.mockReturnValueOnce({
        getUserId: () => null,
        getRoom: () => ({}),
        sendStateEvent: vi.fn()
      })
      await expect(service.setMemberDisplayName('!r', 'Me')).rejects.toThrow('用户未登录')
    })

    it('throws when room does not exist', async () => {
      getClientMock.mockReturnValueOnce({
        getUserId: () => '@me:e',
        getRoom: () => null,
        sendStateEvent: vi.fn()
      })
      await expect(service.setMemberDisplayName('!r', 'Me')).rejects.toThrow('房间不存在: !r')
    })

    it('preserves existing membership fields and overrides displayname', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      const room = {
        currentState: {
          getStateEvents: vi.fn(() => ({
            getContent: () => ({ avatar_url: 'mxc://e/a', membership: 'join', some_custom: 'x' })
          }))
        }
      }
      getClientMock.mockReturnValueOnce({
        getUserId: () => '@me:e',
        getRoom: () => room,
        sendStateEvent
      })
      await service.setMemberDisplayName('!r', 'New')
      expect(room.currentState.getStateEvents).toHaveBeenCalledWith('m.room.member', '@me:e')
      expect(sendStateEvent).toHaveBeenCalledWith(
        '!r',
        'm.room.member',
        {
          avatar_url: 'mxc://e/a',
          some_custom: 'x',
          displayname: 'New',
          membership: 'join'
        },
        '@me:e'
      )
    })

    it('tolerates missing state event content (treated as empty object)', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      const room = {
        currentState: {
          getStateEvents: vi.fn(() => null)
        }
      }
      getClientMock.mockReturnValueOnce({
        getUserId: () => '@me:e',
        getRoom: () => room,
        sendStateEvent
      })
      await service.setMemberDisplayName('!r', 'New')
      expect(sendStateEvent).toHaveBeenCalledWith(
        '!r',
        'm.room.member',
        { displayname: 'New', membership: 'join' },
        '@me:e'
      )
    })

    it('re-throws backend errors', async () => {
      const room = {
        currentState: { getStateEvents: vi.fn(() => ({ getContent: () => ({}) })) }
      }
      getClientMock.mockReturnValueOnce({
        getUserId: () => '@me:e',
        getRoom: () => room,
        sendStateEvent: vi.fn().mockRejectedValue(new Error('403'))
      })
      await expect(service.setMemberDisplayName('!r', 'x')).rejects.toThrow('403')
    })
  })

  describe('getMemberDisplayName', () => {
    it('returns null when client is not initialized (swallowed)', async () => {
      getClientMock.mockReturnValueOnce(null)
      expect(await service.getMemberDisplayName('!r', '@u:e')).toBeNull()
    })

    it('returns null when room is not in local cache', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      expect(await service.getMemberDisplayName('!r', '@u:e')).toBeNull()
    })

    it('returns null when member is absent', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => ({ getMember: () => null }) })
      expect(await service.getMemberDisplayName('!r', '@u:e')).toBeNull()
    })

    it('prefers rawDisplayName over name', async () => {
      getClientMock.mockReturnValueOnce({
        getRoom: () => ({ getMember: () => ({ rawDisplayName: 'Raw', name: 'Fallback' }) })
      })
      expect(await service.getMemberDisplayName('!r', '@u:e')).toBe('Raw')
    })

    it('falls back to name when rawDisplayName is empty', async () => {
      getClientMock.mockReturnValueOnce({
        getRoom: () => ({ getMember: () => ({ rawDisplayName: '', name: 'Fallback' }) })
      })
      expect(await service.getMemberDisplayName('!r', '@u:e')).toBe('Fallback')
    })
  })

  describe('setMemberPowerLevel', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.setMemberPowerLevel('!r', '@u:e', 50)).rejects.toThrow('客户端未初始化')
    })

    it('forwards to client.setUserPowerLevel(userId, roomId, level)', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setUserPowerLevel })
      await service.setMemberPowerLevel('!r', '@u:e', 50)
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 50)
    })

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({
        setUserPowerLevel: vi.fn().mockRejectedValue(new Error('403'))
      })
      await expect(service.setMemberPowerLevel('!r', '@u:e', 50)).rejects.toThrow('403')
    })
  })

  describe('setMemberAsAdmin / removeMemberAsAdmin', () => {
    it('setMemberAsAdmin sets power level to 100', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setUserPowerLevel })
      await service.setMemberAsAdmin('!r', '@u:e')
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 100)
    })

    it('removeMemberAsAdmin sets power level to 0', async () => {
      const setUserPowerLevel = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setUserPowerLevel })
      await service.removeMemberAsAdmin('!r', '@u:e')
      expect(setUserPowerLevel).toHaveBeenCalledWith('@u:e', '!r', 0)
    })

    it('setMemberAsAdmin re-throws underlying power-level errors', async () => {
      getClientMock.mockReturnValueOnce({
        setUserPowerLevel: vi.fn().mockRejectedValue(new Error('403'))
      })
      await expect(service.setMemberAsAdmin('!r', '@u:e')).rejects.toThrow('403')
    })
  })
})
