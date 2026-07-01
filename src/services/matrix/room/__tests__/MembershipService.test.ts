import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
const clientJoinRoomMock = vi.fn()
const clientLeaveRoomMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: () => getClientMock(),
    joinRoom: (...args: unknown[]) => clientJoinRoomMock(...args),
    leaveRoom: (...args: unknown[]) => clientLeaveRoomMock(...args)
  }
}))

const { MatrixRoomMembershipService } = await import('../MembershipService')

describe('MatrixRoomMembershipService', () => {
  let service: InstanceType<typeof MatrixRoomMembershipService>

  beforeEach(() => {
    service = new MatrixRoomMembershipService()
    getClientMock.mockReset()
    clientJoinRoomMock.mockReset()
    clientLeaveRoomMock.mockReset()
  })

  describe('joinRoom / leaveRoom', () => {
    it('joinRoom forwards to matrixClientService.joinRoom', async () => {
      clientJoinRoomMock.mockResolvedValueOnce({ roomId: '!r' })
      const out = await service.joinRoom('!r')
      expect(clientJoinRoomMock).toHaveBeenCalledWith('!r')
      expect(out).toEqual({ roomId: '!r' })
    })

    it('joinRoom re-throws backend errors', async () => {
      clientJoinRoomMock.mockRejectedValueOnce(new Error('403'))
      await expect(service.joinRoom('!r')).rejects.toThrow('403')
    })

    it('leaveRoom forwards to matrixClientService.leaveRoom', async () => {
      clientLeaveRoomMock.mockResolvedValueOnce(undefined)
      await service.leaveRoom('!r')
      expect(clientLeaveRoomMock).toHaveBeenCalledWith('!r')
    })

    it('leaveRoom re-throws backend errors', async () => {
      clientLeaveRoomMock.mockRejectedValueOnce(new Error('500'))
      await expect(service.leaveRoom('!r')).rejects.toThrow('500')
    })
  })

  describe('inviteUser', () => {
    it('throws (no prefix) when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.inviteUser('!r', '@u:e')).rejects.toThrow('客户端未初始化')
    })

    it('calls client.invite with roomId and userId', async () => {
      const invite = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ invite })
      await service.inviteUser('!r', '@u:e')
      expect(invite).toHaveBeenCalledWith('!r', '@u:e')
    })

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({ invite: vi.fn().mockRejectedValue(new Error('403')) })
      await expect(service.inviteUser('!r', '@u:e')).rejects.toThrow('403')
    })
  })

  describe('kickUser / banUser / unbanUser', () => {
    it('kickUser forwards reason argument', async () => {
      const kick = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ kick })
      await service.kickUser('!r', '@u:e', 'spam')
      expect(kick).toHaveBeenCalledWith('!r', '@u:e', 'spam')
    })

    it('kickUser throws (no prefix) when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.kickUser('!r', '@u:e')).rejects.toThrow('客户端未初始化')
    })

    it('banUser forwards reason argument', async () => {
      const ban = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ ban })
      await service.banUser('!r', '@u:e', 'abuse')
      expect(ban).toHaveBeenCalledWith('!r', '@u:e', 'abuse')
    })

    it('banUser re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({ ban: vi.fn().mockRejectedValue(new Error('403')) })
      await expect(service.banUser('!r', '@u:e')).rejects.toThrow('403')
    })

    it('unbanUser forwards to client.unban', async () => {
      const unban = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ unban })
      await service.unbanUser('!r', '@u:e')
      expect(unban).toHaveBeenCalledWith('!r', '@u:e')
    })

    it('unbanUser throws (no prefix) when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.unbanUser('!r', '@u:e')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('forgetRoom / knockRoom', () => {
    it('forgetRoom throws ([MatrixRoom] prefix) when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.forgetRoom('!r')).rejects.toThrow('[MatrixRoom] 客户端未初始化')
    })

    it('forgetRoom forwards to client.forget', async () => {
      const forget = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ forget })
      await service.forgetRoom('!r')
      expect(forget).toHaveBeenCalledWith('!r')
    })

    it('knockRoom forwards viaServers + reason to client.http.authedRequest', async () => {
      const authedRequest = vi.fn().mockResolvedValue({ room_id: '!r' })
      getClientMock.mockReturnValueOnce({ http: { authedRequest } })
      const out = await service.knockRoom('!r', 'please', ['matrix.test'])
      expect(authedRequest).toHaveBeenCalledWith('POST', expect.stringContaining('/knock/'), undefined, {
        room_id_or_alias: '!r',
        reason: 'please',
        via: ['matrix.test']
      })
      expect(out).toEqual({ room_id: '!r' })
    })

    it('knockRoom re-throws backend errors', async () => {
      const authedRequest = vi.fn().mockRejectedValue(new Error('403'))
      getClientMock.mockReturnValueOnce({ http: { authedRequest } })
      await expect(service.knockRoom('!r')).rejects.toThrow('403')
    })
  })
})
