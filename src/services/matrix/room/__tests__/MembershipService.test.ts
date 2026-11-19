// fixture-literal-ok-file: 本文件的 mock 全是**内部桩**（matrixClientService.getClient / joinRoom 等），结构由本仓定义，与后端 wire 响应无关。
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { MatrixRoomMembershipService } from '../MembershipService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

setupMswServer(
  http.post(`${TEST_BASE_URL}${PREFIX_V3}/knock/:roomId`, () => {
    return HttpResponse.json({ room_id: '!r' })
  }),
  http.post(`${TEST_BASE_URL}${PREFIX_V3}/join/:alias`, () => {
    return HttpResponse.json({ room_id: '!joined:e' })
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const authedRequestImpl = vi.fn()

describe('MatrixRoomMembershipService', () => {
  let service: InstanceType<typeof MatrixRoomMembershipService>

  beforeEach(() => {
    vi.clearAllMocks()
    authedRequestImpl.mockImplementation(
      async (method: string, path: string, queryParams?: unknown, body?: unknown) => {
        const prefixedPath = path.startsWith('/_') ? path : `${PREFIX_V3}${path}`
        const url = new URL(`${TEST_BASE_URL}${prefixedPath}`)
        if (queryParams && typeof queryParams === 'object') {
          for (const [key, value] of Object.entries(queryParams as Record<string, string>)) {
            url.searchParams.set(key, value)
          }
        }
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token'
        }
        const response = await fetch(url.toString(), {
          method,
          headers,
          ...(body ? { body: JSON.stringify(body) } : {})
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.json()
      }
    )
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    vi.spyOn(matrixClientService, 'joinRoom')
    vi.spyOn(matrixClientService, 'leaveRoom')
    service = new MatrixRoomMembershipService()
  })

  describe('joinRoom / leaveRoom', () => {
    it('joinRoom forwards to matrixClientService.joinRoom', async () => {
      vi.mocked(matrixClientService.joinRoom).mockResolvedValueOnce({ roomId: '!r' } as never)
      const out = await service.joinRoom('!r')
      expect(matrixClientService.joinRoom).toHaveBeenCalledWith('!r')
      expect(out).toEqual({ roomId: '!r' })
    })

    it('joinRoom re-throws backend errors', async () => {
      vi.mocked(matrixClientService.joinRoom).mockRejectedValueOnce(new Error('403'))
      await expect(service.joinRoom('!r')).rejects.toThrow('403')
    })

    it('leaveRoom forwards to matrixClientService.leaveRoom', async () => {
      vi.mocked(matrixClientService.leaveRoom).mockResolvedValueOnce(undefined as never)
      await service.leaveRoom('!r')
      expect(matrixClientService.leaveRoom).toHaveBeenCalledWith('!r')
    })

    it('leaveRoom re-throws backend errors', async () => {
      vi.mocked(matrixClientService.leaveRoom).mockRejectedValueOnce(new Error('500'))
      await expect(service.leaveRoom('!r')).rejects.toThrow('500')
    })
  })

  describe('inviteUser', () => {
    it('throws (no prefix) when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce(null)
      await expect(service.inviteUser('!r', '@u:e')).rejects.toThrow('客户端未初始化')
    })

    it('calls client.invite with roomId and userId', async () => {
      const invite = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({ invite } as never)
      await service.inviteUser('!r', '@u:e')
      expect(invite).toHaveBeenCalledWith('!r', '@u:e')
    })

    it('re-throws backend errors', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({
        invite: vi.fn().mockRejectedValue(new Error('403'))
      } as never)
      await expect(service.inviteUser('!r', '@u:e')).rejects.toThrow('403')
    })
  })

  describe('kickUser / banUser / unbanUser', () => {
    it('kickUser forwards reason argument', async () => {
      const kick = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({ kick } as never)
      await service.kickUser('!r', '@u:e', 'spam')
      expect(kick).toHaveBeenCalledWith('!r', '@u:e', 'spam')
    })

    it('kickUser throws (no prefix) when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce(null)
      await expect(service.kickUser('!r', '@u:e')).rejects.toThrow('客户端未初始化')
    })

    it('banUser forwards reason argument', async () => {
      const ban = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({ ban } as never)
      await service.banUser('!r', '@u:e', 'abuse')
      expect(ban).toHaveBeenCalledWith('!r', '@u:e', 'abuse')
    })

    it('banUser re-throws backend errors', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({
        ban: vi.fn().mockRejectedValue(new Error('403'))
      } as never)
      await expect(service.banUser('!r', '@u:e')).rejects.toThrow('403')
    })

    it('unbanUser forwards to client.unban', async () => {
      const unban = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({ unban } as never)
      await service.unbanUser('!r', '@u:e')
      expect(unban).toHaveBeenCalledWith('!r', '@u:e')
    })

    it('unbanUser throws (no prefix) when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce(null)
      await expect(service.unbanUser('!r', '@u:e')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('forgetRoom / knockRoom', () => {
    it('forgetRoom throws ([MatrixRoom] prefix) when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce(null)
      await expect(service.forgetRoom('!r')).rejects.toThrow('[MatrixRoom] 客户端未初始化')
    })

    it('forgetRoom forwards to client.forget', async () => {
      const forget = vi.fn().mockResolvedValue(undefined)
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({ forget } as never)
      await service.forgetRoom('!r')
      expect(forget).toHaveBeenCalledWith('!r')
    })

    it('knockRoom forwards viaServers + reason to client.knockRoom', async () => {
      const knockRoom = vi.fn().mockResolvedValue({ room_id: '!r' })
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({ knockRoom } as never)
      const out = await service.knockRoom('!r', 'please', ['matrix.test'])
      expect(knockRoom).toHaveBeenCalledWith('!r', { reason: 'please', viaServers: ['matrix.test'] })
      expect(out).toEqual({ room_id: '!r' })
    })

    it('knockRoom re-throws backend errors', async () => {
      const knockRoom = vi.fn().mockRejectedValue(new Error('403'))
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({ knockRoom } as never)
      await expect(service.knockRoom('!r')).rejects.toThrow('403')
    })
  })

  describe('getMembershipEvents', () => {
    const mockMemberManager = (getMembershipEvents: ReturnType<typeof vi.fn>) => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoomMemberManager: () => ({ getMembershipEvents })
      } as never)
    }

    it('normalizes events and passes the limit through', async () => {
      const getMembershipEvents = vi.fn().mockResolvedValue({
        events: [
          {
            event_id: '$e1',
            type: 'm.room.member',
            sender: '@a:e',
            state_key: '@b:e',
            content: { membership: 'join', displayname: 'B' },
            origin_server_ts: 1700000000000
          },
          {
            event_id: '$e2',
            type: 'm.room.member',
            sender: '@a:e',
            state_key: '@c:e',
            content: { membership: 'invite' },
            origin_server_ts: 1700000001000
          }
        ]
      })
      mockMemberManager(getMembershipEvents)

      expect(await service.getMembershipEvents('!r:e', 50)).toEqual({
        status: 'ok',
        events: [
          {
            eventId: '$e1',
            sender: '@a:e',
            userId: '@b:e',
            membership: 'join',
            timestamp: 1700000000000
          },
          {
            eventId: '$e2',
            sender: '@a:e',
            userId: '@c:e',
            membership: 'invite',
            timestamp: 1700000001000
          }
        ]
      })
      expect(getMembershipEvents).toHaveBeenCalledWith('!r:e', { limit: 50 })
    })

    it('clamps the limit to 1..1000 and defaults to 100', async () => {
      const getMembershipEvents = vi.fn().mockResolvedValue({ events: [] })
      mockMemberManager(getMembershipEvents)

      await service.getMembershipEvents('!r:e', 0)
      await service.getMembershipEvents('!r:e', 5000)
      await service.getMembershipEvents('!r:e')

      expect(getMembershipEvents.mock.calls.map(([, params]) => params)).toEqual([
        { limit: 1 },
        { limit: 1000 },
        { limit: 100 }
      ])
    })

    it('drops malformed entries and returns empty when nothing is left', async () => {
      const getMembershipEvents = vi.fn().mockResolvedValue({
        events: [{ event_id: '$e1' }, null, 'x', { state_key: '@b:e', content: {} }]
      })
      mockMemberManager(getMembershipEvents)
      expect(await service.getMembershipEvents('!r:e')).toEqual({ status: 'empty' })
    })

    it('classifies M_UNRECOGNIZED as unsupported', async () => {
      const getMembershipEvents = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('not found'), { errcode: 'M_UNRECOGNIZED' }))
      mockMemberManager(getMembershipEvents)
      expect(await service.getMembershipEvents('!r:e')).toEqual({ status: 'unsupported' })
    })

    it('classifies other failures as error', async () => {
      const getMembershipEvents = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('forbidden'), { errcode: 'M_FORBIDDEN' }))
      mockMemberManager(getMembershipEvents)
      expect(await service.getMembershipEvents('!r:e')).toEqual({ status: 'error' })
    })

    it('classifies an uninitialized client as error', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce(null)
      expect(await service.getMembershipEvents('!r:e')).toEqual({ status: 'error' })
    })
  })

  describe('getRecentMemberChanges', () => {
    const mockRecentMembers = (getRoomMembersRecent: ReturnType<typeof vi.fn>) => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoomSummaryManager: () => ({ members: { getRoomMembersRecent } })
      } as never)
    }

    it('normalizes chunk entries and passes the limit through', async () => {
      const getRoomMembersRecent = vi.fn().mockResolvedValue({
        room_id: '!r:e',
        chunk: [
          {
            user_id: '@b:e',
            display_name: 'B',
            avatar_url: 'mxc://e/b',
            membership: 'join',
            event_id: '$e1',
            sender: '@b:e',
            origin_server_ts: 1700000000000
          },
          { user_id: '@c:e', membership: 'leave', origin_server_ts: 1700000001000 }
        ],
        total: 2
      })
      mockRecentMembers(getRoomMembersRecent)

      expect(await service.getRecentMemberChanges('!r:e', 5)).toEqual({
        status: 'ok',
        changes: [
          {
            userId: '@b:e',
            displayName: 'B',
            avatarUrl: 'mxc://e/b',
            membership: 'join',
            eventId: '$e1',
            sender: '@b:e',
            timestamp: 1700000000000
          },
          {
            userId: '@c:e',
            displayName: '',
            avatarUrl: '',
            membership: 'leave',
            eventId: '',
            sender: '',
            timestamp: 1700000001000
          }
        ]
      })
      expect(getRoomMembersRecent).toHaveBeenCalledWith('!r:e', { limit: 5 })
    })

    it('clamps the limit to 1..50 with a default of 8', async () => {
      const getRoomMembersRecent = vi.fn().mockResolvedValue({ chunk: [{ user_id: '@b:e', membership: 'join' }] })
      mockRecentMembers(getRoomMembersRecent)

      await service.getRecentMemberChanges('!r:e', 0)
      await service.getRecentMemberChanges('!r:e', 500)
      await service.getRecentMemberChanges('!r:e')

      expect(getRoomMembersRecent.mock.calls.map(([, options]) => options)).toEqual([
        { limit: 1 },
        { limit: 50 },
        { limit: 8 }
      ])
    })

    it('drops malformed entries and treats a missing chunk as empty', async () => {
      const getRoomMembersRecent = vi.fn().mockResolvedValue({
        chunk: [{ user_id: '@b:e' }, null, 'x', { membership: 'join' }]
      })
      mockRecentMembers(getRoomMembersRecent)
      expect(await service.getRecentMemberChanges('!r:e')).toEqual({ status: 'empty' })

      getRoomMembersRecent.mockResolvedValueOnce({ room_id: '!r:e' })
      expect(await service.getRecentMemberChanges('!r:e')).toEqual({ status: 'empty' })
    })

    it('classifies M_UNRECOGNIZED as unsupported', async () => {
      const getRoomMembersRecent = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('not found'), { errcode: 'M_UNRECOGNIZED' }))
      mockRecentMembers(getRoomMembersRecent)
      expect(await service.getRecentMemberChanges('!r:e')).toEqual({ status: 'unsupported' })
    })

    it('classifies other failures as error', async () => {
      const getRoomMembersRecent = vi
        .fn()
        .mockRejectedValue(Object.assign(new Error('forbidden'), { errcode: 'M_FORBIDDEN' }))
      mockRecentMembers(getRoomMembersRecent)
      expect(await service.getRecentMemberChanges('!r:e')).toEqual({ status: 'error' })
    })

    it('classifies an uninitialized client as error', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce(null)
      expect(await service.getRecentMemberChanges('!r:e')).toEqual({ status: 'error' })
    })
  })
})
