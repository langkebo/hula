import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock() }
}))

const { MatrixRoomLifecycleService } = await import('../LifecycleService')

describe('MatrixRoomLifecycleService', () => {
  let service: InstanceType<typeof MatrixRoomLifecycleService>

  beforeEach(() => {
    service = new MatrixRoomLifecycleService()
    getClientMock.mockReset()
  })

  describe('getServerDomain', () => {
    it('throws (no prefix) when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.getServerDomain()).rejects.toThrow('客户端未初始化')
    })

    it('returns client.getDomain() when available', async () => {
      getClientMock.mockReturnValueOnce({ getDomain: () => 'example.org' })
      expect(await service.getServerDomain()).toBe('example.org')
    })

    it('falls back to matrix.org when domain is empty', async () => {
      getClientMock.mockReturnValueOnce({ getDomain: () => '' })
      expect(await service.getServerDomain()).toBe('matrix.org')
    })

    it('falls back to matrix.org when domain is null/undefined', async () => {
      getClientMock.mockReturnValueOnce({ getDomain: () => null })
      expect(await service.getServerDomain()).toBe('matrix.org')
    })
  })

  describe('upgradeRoom', () => {
    it('throws ([MatrixRoom] prefix) when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.upgradeRoom('!r', '11')).rejects.toThrow('[MatrixRoom] 客户端未初始化')
    })

    it('forwards to client.upgradeRoom and returns the new room id', async () => {
      const upgradeRoom = vi.fn().mockResolvedValue('!new:e')
      getClientMock.mockReturnValueOnce({ upgradeRoom })
      expect(await service.upgradeRoom('!old:e', '11')).toBe('!new:e')
      expect(upgradeRoom).toHaveBeenCalledWith('!old:e', '11')
    })

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({
        upgradeRoom: vi.fn().mockRejectedValue(new Error('403'))
      })
      await expect(service.upgradeRoom('!r', '11')).rejects.toThrow('403')
    })
  })

  describe('incrementUnread', () => {
    it('resolves silently when room exists', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => ({ roomId: '!r' }) })
      await expect(service.incrementUnread('!r')).resolves.toBeUndefined()
    })

    it('swallows "room not found" errors (counter is advisory only)', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      await expect(service.incrementUnread('!r')).resolves.toBeUndefined()
    })

    it('swallows "client not initialized" errors', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.incrementUnread('!r')).resolves.toBeUndefined()
    })

    it('accepts highlight=true without throwing', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => ({ roomId: '!r' }) })
      await expect(service.incrementUnread('!r', true)).resolves.toBeUndefined()
    })
  })

  describe('clearUnread', () => {
    it('resolves silently when room exists', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => ({ roomId: '!r' }) })
      await expect(service.clearUnread('!r')).resolves.toBeUndefined()
    })

    it('swallows "room not found" errors', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      await expect(service.clearUnread('!r')).resolves.toBeUndefined()
    })

    it('swallows "client not initialized" errors', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.clearUnread('!r')).resolves.toBeUndefined()
    })
  })
})
