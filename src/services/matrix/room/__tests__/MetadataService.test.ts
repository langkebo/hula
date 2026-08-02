import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { MatrixRoomMetadataService } from '../MetadataService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

const _server = setupMswServer(
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/capabilities`, () => {
    return HttpResponse.json({ 'm.room_versions': { default: '11' } })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/metadata`, () => {
    return HttpResponse.json({ a: 1 })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/turn_server`, () => {
    return HttpResponse.json({ uris: ['turn:e'] })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/sync`, () => {
    return HttpResponse.json({ timeline: [] })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/permissions`, () => {
    return HttpResponse.json({ read: true })
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeRoomManager = () => ({
  getRoomCapabilities: vi.fn(() => Promise.resolve({ 'm.room_versions': { default: '11' } })),
  getRoomMetadata: vi.fn(() => Promise.resolve({ a: 1 }))
})

const _makeHttpClient = () => ({
  http: {
    authedRequest: vi.fn()
  },
  getRoomManager: makeRoomManager
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

    it('getRoomTurnServer 委托 RoomSummaryManager', async () => {
      const roomSummaryManager = {
        getRoomTurnServer: vi.fn().mockResolvedValue({ uris: ['turn:e'] })
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoomSummaryManager: () => roomSummaryManager
      } as never)
      expect(await service.getRoomTurnServer('!r')).toEqual({ uris: ['turn:e'] })
      expect(roomSummaryManager.getRoomTurnServer).toHaveBeenCalledWith('!r')
    })

    it('getRoomSync 委托 RoomSummaryManager', async () => {
      const roomSummaryManager = {
        getRoomSync: vi.fn().mockResolvedValue({ timeline: [] })
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoomSummaryManager: () => roomSummaryManager
      } as never)
      expect(await service.getRoomSync('!r')).toEqual({ timeline: [] })
      expect(roomSummaryManager.getRoomSync).toHaveBeenCalledWith('!r')
    })

    it('getRoomTurnServer / getRoomSync 出错时降级为 {}', async () => {
      const roomSummaryManager = {
        getRoomTurnServer: vi.fn().mockRejectedValue(new Error('boom')),
        getRoomSync: vi.fn().mockRejectedValue(new Error('boom'))
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoomSummaryManager: () => roomSummaryManager
      } as never)
      expect(await service.getRoomTurnServer('!r')).toEqual({})
      expect(await service.getRoomSync('!r')).toEqual({})
    })
  })

  describe('getRoomPermissions', () => {
    it('getRoomPermissions 委托 RoomSummaryManager 并返回结果', async () => {
      const roomSummaryManager = {
        getRoomPermissions: vi.fn().mockResolvedValue({ read: true })
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoomSummaryManager: () => roomSummaryManager
      } as never)
      expect(await service.getRoomPermissions('!r')).toEqual({ read: true })
      expect(roomSummaryManager.getRoomPermissions).toHaveBeenCalledWith('!r')
    })

    it('swallows errors and returns {}', async () => {
      const roomSummaryManager = {
        getRoomPermissions: vi.fn().mockRejectedValue(new Error('boom'))
      }
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getRoomSummaryManager: () => roomSummaryManager
      } as never)
      expect(await service.getRoomPermissions('!r')).toEqual({})
    })
  })
})
