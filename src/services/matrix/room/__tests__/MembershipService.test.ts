import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { MatrixRoomMembershipService } from '../MembershipService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

const server = setupMswServer(
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
          body: body ? JSON.stringify(body) : undefined
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

    it('knockRoom 委托 RoomManager.knockRoom 并透传 reason/viaServers', async () => {
      const knockRoom = vi.fn().mockResolvedValue({ room_id: '!r' })
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({
        getRoomManager: () => ({ knockRoom })
      } as never)
      const out = await service.knockRoom('!r', 'please', ['matrix.test'])
      expect(knockRoom).toHaveBeenCalledWith('!r', { reason: 'please', viaServers: ['matrix.test'] })
      expect(out).toEqual({ room_id: '!r' })
    })

    it('knockRoom re-throws backend errors', async () => {
      const knockRoom = vi.fn().mockRejectedValue(new Error('403'))
      vi.mocked(matrixClientService.getClient).mockReturnValueOnce({
        getRoomManager: () => ({ knockRoom })
      } as never)
      await expect(service.knockRoom('!r')).rejects.toThrow('403')
    })
  })
})
