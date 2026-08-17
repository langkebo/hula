import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { MatrixRoomMetadataService } from '../MetadataService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getRoomTurnServerMock = vi.fn()
const getRoomSyncMock = vi.fn()
const getRoomPermissionsMock = vi.fn()

const makeRoomManager = () => ({
  getRoomCapabilities: vi.fn(() => Promise.resolve({ 'm.room_versions': { default: '11' } })),
  getRoomMetadata: vi.fn(() => Promise.resolve({ a: 1 }))
})

const makeRoomSummaryManager = () => ({
  getRoomTurnServer: getRoomTurnServerMock,
  getRoomSync: getRoomSyncMock,
  getRoomPermissions: getRoomPermissionsMock
})

const makeHttpClient = () => ({
  getRoomManager: makeRoomManager,
  getRoomSummaryManager: makeRoomSummaryManager
})

describe('MatrixRoomMetadataService', () => {
  let service: InstanceType<typeof MatrixRoomMetadataService>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    service = new MatrixRoomMetadataService()
  })

  describe('getRoomVersion', () => {
    it('throws when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      await expect(service.getRoomVersion('!r')).rejects.toThrow('客户端未初始化')
    })

    it('returns null when room is missing from local cache', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => null } as never)
      expect(await service.getRoomVersion('!r')).toBeNull()
    })

    it('reads room_version from m.room.create state event', async () => {
      const room = {
        currentState: {
          getStateEvents: vi.fn(() => ({ getContent: () => ({ room_version: '11' }) }))
        }
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => room } as never)
      expect(await service.getRoomVersion('!r')).toBe('11')
      expect(room.currentState.getStateEvents).toHaveBeenCalledWith('m.room.create', '')
    })

    it('returns null when state event lacks room_version', async () => {
      const room = {
        currentState: {
          getStateEvents: vi.fn(() => ({ getContent: () => ({}) }))
        }
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ getRoom: () => room } as never)
      expect(await service.getRoomVersion('!r')).toBeNull()
    })

    it('swallows errors and returns null', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoom: () => {
          throw new Error('boom')
        }
      } as never)
      expect(await service.getRoomVersion('!r')).toBeNull()
    })
  })

  describe('getRoomCapabilities', () => {
    it('uses SDK RoomManager and returns the payload', async () => {
      const roomManager = makeRoomManager()
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoomManager: () => roomManager
      } as never)
      expect(await service.getRoomCapabilities('!r:e')).toEqual({ 'm.room_versions': { default: '11' } })
      expect(roomManager.getRoomCapabilities).toHaveBeenCalledWith('!r:e')
    })

    it('swallows errors and returns {}', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoomManager: () => ({
          getRoomCapabilities: () => Promise.reject(new Error('boom'))
        })
      } as never)
      expect(await service.getRoomCapabilities('!r')).toEqual({})
    })
  })

  describe('getRoomMetadata / getRoomTurnServer / getRoomSync', () => {
    it('getRoomMetadata uses SDK RoomManager', async () => {
      const roomManager = makeRoomManager()
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoomManager: () => roomManager
      } as never)
      expect(await service.getRoomMetadata('!r')).toEqual({ a: 1 })
      expect(roomManager.getRoomMetadata).toHaveBeenCalledWith('!r')
    })

    it('getRoomTurnServer delegates to RoomSummaryManager', async () => {
      getRoomTurnServerMock.mockResolvedValue({ uris: ['turn:e'] })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomTurnServer('!r')).toEqual({ uris: ['turn:e'] })
      expect(getRoomTurnServerMock).toHaveBeenCalledWith('!r')
    })

    it('getRoomSync delegates to RoomSummaryManager', async () => {
      getRoomSyncMock.mockResolvedValue({ timeline: [] })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomSync('!r')).toEqual({ timeline: [] })
      expect(getRoomSyncMock).toHaveBeenCalledWith('!r')
    })

    it('all three swallow errors and return {}', async () => {
      getRoomTurnServerMock.mockRejectedValue(new Error('boom'))
      getRoomSyncMock.mockRejectedValue(new Error('boom'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomTurnServer('!r')).toEqual({})
      expect(await service.getRoomSync('!r')).toEqual({})
    })
  })

  describe('getRoomPermissions', () => {
    it('delegates to RoomSummaryManager and returns the payload', async () => {
      getRoomPermissionsMock.mockResolvedValue({ read: true })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomPermissions('!r')).toEqual({ read: true })
      expect(getRoomPermissionsMock).toHaveBeenCalledWith('!r')
    })

    it('swallows errors and returns {}', async () => {
      getRoomPermissionsMock.mockRejectedValue(new Error('boom'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomPermissions('!r')).toEqual({})
    })
  })
})
