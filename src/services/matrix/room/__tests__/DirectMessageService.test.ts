import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('matrix-js-sdk', () => ({
  Preset: { TrustedPrivateChat: 'trusted_private_chat' },
  Visibility: { Private: 'private', Public: 'public' }
}))

const getClientMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock() }
}))

const enqueueMock = vi.fn()
vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: (...args: any[]) => enqueueMock(...args)
  }
}))

const { MatrixRoomDirectMessageService } = await import('../DirectMessageService')

describe('MatrixRoomDirectMessageService', () => {
  let service: InstanceType<typeof MatrixRoomDirectMessageService>

  beforeEach(() => {
    service = new MatrixRoomDirectMessageService()
    getClientMock.mockReset()
  })

  describe('createDirectRoom', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.createDirectRoom('@u:e')).rejects.toThrow('客户端未初始化')
    })

    it('creates a trusted_private_chat with is_direct + invite + Visibility.Private', async () => {
      const createRoom = vi.fn().mockResolvedValue({ room_id: '!new:e' })
      getClientMock.mockReturnValueOnce({ createRoom })
      const id = await service.createDirectRoom('@u:e')
      expect(id).toBe('!new:e')
      expect(createRoom).toHaveBeenCalledWith({
        is_direct: true,
        invite: ['@u:e'],
        preset: 'trusted_private_chat',
        visibility: 'private'
      })
    })

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({ createRoom: vi.fn().mockRejectedValue(new Error('403')) })
      await expect(service.createDirectRoom('@u:e')).rejects.toThrow('403')
    })

    it('enqueues DM creation when offline', async () => {
      vi.stubGlobal('navigator', { onLine: false })
      const id = await service.createDirectRoom('@u:e')
      expect(enqueueMock).toHaveBeenCalledWith('dm_creation', expect.any(String), { userId: '@u:e' })
      expect(id).toContain('!pending-dm-')
      vi.stubGlobal('navigator', { onLine: true })
    })
  })

  describe('getDirectRooms', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.getDirectRooms()).rejects.toThrow('客户端未初始化')
    })

    it('returns empty Map when m.direct account data is missing', async () => {
      getClientMock.mockReturnValueOnce({ getAccountData: () => null })
      expect(await service.getDirectRooms()).toEqual(new Map())
    })

    it('parses m.direct content into a Map<userId, roomIds[]>', async () => {
      const content = { '@a:e': ['!r1', '!r2'], '@b:e': ['!r3'] }
      getClientMock.mockReturnValueOnce({
        getAccountData: () => ({ getContent: () => content })
      })
      const result = await service.getDirectRooms()
      expect(result.get('@a:e')).toEqual(['!r1', '!r2'])
      expect(result.get('@b:e')).toEqual(['!r3'])
    })

    it('filters out non-string roomId entries and skips non-array values', async () => {
      const content = { '@a:e': ['!r1', 42, null, '!r2'], '@b:e': 'not-array' }
      getClientMock.mockReturnValueOnce({
        getAccountData: () => ({ getContent: () => content })
      })
      const result = await service.getDirectRooms()
      expect(result.get('@a:e')).toEqual(['!r1', '!r2'])
      expect(result.has('@b:e')).toBe(false)
    })

    it('throwOnError=true re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({
        getAccountData: () => {
          throw new Error('500')
        }
      })
      await expect(service.getDirectRooms(true)).rejects.toThrow('500')
    })

    it('throwOnError=false swallows backend errors and returns an empty Map', async () => {
      getClientMock.mockReturnValueOnce({
        getAccountData: () => {
          throw new Error('500')
        }
      })
      expect(await service.getDirectRooms(false)).toEqual(new Map())
    })
  })

  describe('setDirectRoom', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.setDirectRoom('@u:e', '!r')).rejects.toThrow('客户端未初始化')
    })

    it('appends a new roomId to the user entry and writes m.direct back', async () => {
      const setAccountData = vi.fn().mockResolvedValue(undefined)
      const getAccountData = vi.fn(() => ({ getContent: () => ({ '@u:e': ['!old'] }) }))
      // Two getClient() hits: one for setDirectRoom's own guard, one inside getDirectRooms
      getClientMock.mockReturnValue({ getAccountData, setAccountData })
      await service.setDirectRoom('@u:e', '!new')
      expect(setAccountData).toHaveBeenCalledWith('m.direct', { '@u:e': ['!old', '!new'] })
    })

    it('does not rewrite account data when roomId is already tracked', async () => {
      const setAccountData = vi.fn()
      const getAccountData = vi.fn(() => ({ getContent: () => ({ '@u:e': ['!old'] }) }))
      getClientMock.mockReturnValue({ getAccountData, setAccountData })
      await service.setDirectRoom('@u:e', '!old')
      expect(setAccountData).not.toHaveBeenCalled()
    })

    it('creates a fresh user entry if the user had no DM rooms yet', async () => {
      const setAccountData = vi.fn().mockResolvedValue(undefined)
      const getAccountData = vi.fn(() => ({ getContent: () => ({}) }))
      getClientMock.mockReturnValue({ getAccountData, setAccountData })
      await service.setDirectRoom('@u:e', '!new')
      expect(setAccountData).toHaveBeenCalledWith('m.direct', { '@u:e': ['!new'] })
    })

    it('re-throws backend errors from setAccountData', async () => {
      const getAccountData = vi.fn(() => ({ getContent: () => ({}) }))
      getClientMock.mockReturnValue({
        getAccountData,
        setAccountData: vi.fn().mockRejectedValue(new Error('403'))
      })
      await expect(service.setDirectRoom('@u:e', '!new')).rejects.toThrow('403')
    })
  })
})
