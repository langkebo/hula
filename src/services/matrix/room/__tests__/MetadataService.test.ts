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
const getRoomSpacesMock = vi.fn()
const getRoomExternalIdsMock = vi.fn()
const getRoomServiceTypesMock = vi.fn()
const getRoomEventUrlMock = vi.fn()

const makeRoomManager = () => ({
  getRoomCapabilities: vi.fn(() => Promise.resolve({ 'm.room_versions': { default: '11' } })),
  getRoomMetadata: vi.fn(() => Promise.resolve({ a: 1 }))
})

const makeRoomSummaryManager = () => ({
  getRoomTurnServer: getRoomTurnServerMock,
  getRoomSync: getRoomSyncMock,
  getRoomPermissions: getRoomPermissionsMock,
  getRoomSpaces: getRoomSpacesMock,
  eventOps: {
    getRoomExternalIds: getRoomExternalIdsMock,
    getRoomServiceTypes: getRoomServiceTypesMock
  },
  getRoomEventUrl: getRoomEventUrlMock
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

    it('getRoomTurnServer returns uris and ttl without credentials', async () => {
      getRoomTurnServerMock.mockResolvedValue({
        uris: ['turn:e?transport=udp'],
        username: 'user',
        password: 'secret',
        ttl: 86400
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomTurnServer('!r')).toEqual({
        status: 'ok',
        config: { uris: ['turn:e?transport=udp'], ttl: 86400 }
      })
      expect(getRoomTurnServerMock).toHaveBeenCalledWith('!r')
    })

    it('getRoomTurnServer drops invalid uris and returns empty when nothing remains', async () => {
      getRoomTurnServerMock.mockResolvedValue({ uris: ['turn:e', 1, null, '', 'turns:e'] })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomTurnServer('!r')).toEqual({
        status: 'ok',
        config: { uris: ['turn:e', 'turns:e'], ttl: null }
      })

      getRoomTurnServerMock.mockResolvedValue({ uris: [], ttl: 60 })
      expect(await service.getRoomTurnServer('!r')).toEqual({ status: 'empty' })

      getRoomTurnServerMock.mockResolvedValue({ ttl: 60 })
      expect(await service.getRoomTurnServer('!r')).toEqual({ status: 'empty' })
    })

    it('getRoomTurnServer classifies M_UNRECOGNIZED as unsupported', async () => {
      getRoomTurnServerMock.mockRejectedValue(Object.assign(new Error('not found'), { errcode: 'M_UNRECOGNIZED' }))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomTurnServer('!r')).toEqual({ status: 'unsupported' })
    })

    it('getRoomTurnServer classifies other failures as error', async () => {
      getRoomTurnServerMock.mockRejectedValue(Object.assign(new Error('forbidden'), { errcode: 'M_FORBIDDEN' }))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomTurnServer('!r')).toEqual({ status: 'error' })
    })

    it('getRoomTurnServer classifies an uninitialized client as error', async () => {
      vi.mocked(matrixClientService.getClient).mockImplementation(() => {
        throw new Error('客户端未初始化')
      })
      expect(await service.getRoomTurnServer('!r')).toEqual({ status: 'error' })
    })

    it('getRoomSync delegates to RoomSummaryManager', async () => {
      getRoomSyncMock.mockResolvedValue({ timeline: [] })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomSync('!r')).toEqual({ timeline: [] })
      expect(getRoomSyncMock).toHaveBeenCalledWith('!r')
    })

    it('getRoomSync swallows errors and returns {}', async () => {
      getRoomSyncMock.mockRejectedValue(new Error('boom'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomSync('!r')).toEqual({})
    })

    it('getRoomEventUrl 返回附件地址与媒体元信息', async () => {
      getRoomEventUrlMock.mockResolvedValue({
        url: 'https://cdn.example.com/a.png',
        mxc: 'mxc://hs/a',
        content_type: 'image/png',
        filesize: 1024
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)

      expect(await service.getRoomEventUrl('!r', '$e')).toEqual({
        status: 'ok',
        attachment: {
          url: 'https://cdn.example.com/a.png',
          mxc: 'mxc://hs/a',
          contentType: 'image/png',
          filesize: 1024
        }
      })
      expect(getRoomEventUrlMock).toHaveBeenCalledWith('!r', '$e')
    })

    it('getRoomEventUrl 无 url 无 mxc 归 empty，M_UNRECOGNIZED 归 unsupported', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)

      getRoomEventUrlMock.mockResolvedValue({ content_type: 'image/png' })
      expect(await service.getRoomEventUrl('!r', '$e')).toEqual({ status: 'empty' })

      getRoomEventUrlMock.mockRejectedValue(
        Object.assign(new Error('M_UNRECOGNIZED: unsupported'), { errcode: 'M_UNRECOGNIZED' })
      )
      expect(await service.getRoomEventUrl('!r', '$e')).toEqual({ status: 'unsupported' })

      getRoomEventUrlMock.mockRejectedValue(new Error('boom'))
      expect(await service.getRoomEventUrl('!r', '$e')).toEqual({ status: 'error' })
    })
  })

  describe('getRoomPermissions', () => {
    it('normalizes the permission snapshot', async () => {
      const payload = {
        room_id: '!r:e',
        power_level: 50,
        can_send: true,
        can_invite: false,
        can_kick: true,
        can_ban: false,
        can_redact: true
      }
      getRoomPermissionsMock.mockResolvedValue(payload)
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomPermissions('!r:e')).toEqual({
        status: 'ok',
        permissions: {
          roomId: '!r:e',
          powerLevel: 50,
          canSend: true,
          canInvite: false,
          canKick: true,
          canBan: false,
          canRedact: true,
          raw: payload
        }
      })
      expect(getRoomPermissionsMock).toHaveBeenCalledWith('!r:e')
    })

    it('keeps missing booleans as null instead of faking false', async () => {
      getRoomPermissionsMock.mockResolvedValue({ room_id: '!r:e', can_send: true })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      const outcome = await service.getRoomPermissions('!r:e')
      expect(outcome).toEqual({
        status: 'ok',
        permissions: {
          roomId: '!r:e',
          powerLevel: null,
          canSend: true,
          canInvite: null,
          canKick: null,
          canBan: null,
          canRedact: null,
          raw: { room_id: '!r:e', can_send: true }
        }
      })
    })

    it('falls back to the requested room id and returns empty for an unknown payload', async () => {
      getRoomPermissionsMock.mockResolvedValue({})
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomPermissions('!r:e')).toEqual({ status: 'empty' })
    })

    it('classifies M_UNRECOGNIZED as unsupported', async () => {
      getRoomPermissionsMock.mockRejectedValue(Object.assign(new Error('not found'), { errcode: 'M_UNRECOGNIZED' }))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomPermissions('!r:e')).toEqual({ status: 'unsupported' })
    })

    it('classifies other failures as error', async () => {
      getRoomPermissionsMock.mockRejectedValue(Object.assign(new Error('boom'), { errcode: 'M_FORBIDDEN' }))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomPermissions('!r:e')).toEqual({ status: 'error' })
    })

    it('classifies an uninitialized client as error', async () => {
      vi.mocked(matrixClientService.getClient).mockImplementation(() => {
        throw new Error('客户端未初始化')
      })
      expect(await service.getRoomPermissions('!r:e')).toEqual({ status: 'error' })
    })
  })

  describe('getRoomSpaces', () => {
    it('normalizes the space memberships', async () => {
      getRoomSpacesMock.mockResolvedValue([
        {
          room_id: '!s:e',
          name: '产品空间',
          canonical_alias: '#product:e',
          avatar_url: 'mxc://e/a',
          topic: '产品'
        }
      ])
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomSpaces('!r:e')).toEqual({
        status: 'ok',
        spaces: [
          {
            roomId: '!s:e',
            name: '产品空间',
            canonicalAlias: '#product:e',
            avatarUrl: 'mxc://e/a',
            topic: '产品'
          }
        ]
      })
      expect(getRoomSpacesMock).toHaveBeenCalledWith('!r:e')
    })

    it('drops entries without room_id and fills missing text fields with empty strings', async () => {
      getRoomSpacesMock.mockResolvedValue([{ name: 'no id' }, null, 'x', { room_id: '!s2:e' }])
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomSpaces('!r:e')).toEqual({
        status: 'ok',
        spaces: [{ roomId: '!s2:e', name: '', canonicalAlias: '', avatarUrl: '', topic: '' }]
      })
    })

    it('returns empty when the room belongs to no space', async () => {
      getRoomSpacesMock.mockResolvedValue([])
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomSpaces('!r:e')).toEqual({ status: 'empty' })
    })

    it('classifies M_UNRECOGNIZED as unsupported', async () => {
      getRoomSpacesMock.mockRejectedValue(Object.assign(new Error('not found'), { errcode: 'M_UNRECOGNIZED' }))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomSpaces('!r:e')).toEqual({ status: 'unsupported' })
    })

    it('classifies other failures as error', async () => {
      getRoomSpacesMock.mockRejectedValue(Object.assign(new Error('boom'), { errcode: 'M_FORBIDDEN' }))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomSpaces('!r:e')).toEqual({ status: 'error' })
    })

    it('classifies an uninitialized client as error', async () => {
      vi.mocked(matrixClientService.getClient).mockImplementation(() => {
        throw new Error('客户端未初始化')
      })
      expect(await service.getRoomSpaces('!r:e')).toEqual({ status: 'error' })
    })
  })

  describe('getRoomExternalIds', () => {
    it('unwraps the backend external_ids envelope', async () => {
      getRoomExternalIdsMock.mockResolvedValue({
        room_id: '!r:e',
        external_ids: [{ type: 'room_alias', value: '#alias:e' }]
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomExternalIds('!r:e')).toEqual([{ type: 'room_alias', value: '#alias:e' }])
      expect(getRoomExternalIdsMock).toHaveBeenCalledWith('!r:e')
    })

    it('accepts the SDK-declared provider/external_id shape', async () => {
      getRoomExternalIdsMock.mockResolvedValue([{ provider: 'room_alias', external_id: '#alias:e' }])
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomExternalIds('!r:e')).toEqual([{ type: 'room_alias', value: '#alias:e' }])
    })

    it('drops malformed entries and returns [] when the payload is empty', async () => {
      getRoomExternalIdsMock.mockResolvedValue({ room_id: '!r:e', external_ids: [{ type: 'room_alias' }, null, 'x'] })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomExternalIds('!r:e')).toEqual([])

      getRoomExternalIdsMock.mockResolvedValue({ room_id: '!r:e' })
      expect(await service.getRoomExternalIds('!r:e')).toEqual([])
    })

    it('returns [] when the endpoint is missing or the request fails', async () => {
      getRoomExternalIdsMock.mockRejectedValue(Object.assign(new Error('not found'), { errcode: 'M_UNRECOGNIZED' }))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomExternalIds('!r:e')).toEqual([])
    })

    it('returns [] when the client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockImplementation(() => {
        throw new Error('客户端未初始化')
      })
      expect(await service.getRoomExternalIds('!r:e')).toEqual([])
    })
  })

  describe('getRoomServiceTypes', () => {
    it('returns the deduped service types', async () => {
      getRoomServiceTypesMock.mockResolvedValue({ service_types: ['messaging', 'encryption', 'messaging'] })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomServiceTypes('!r:e')).toEqual({
        status: 'ok',
        serviceTypes: ['messaging', 'encryption']
      })
      expect(getRoomServiceTypesMock).toHaveBeenCalledWith('!r:e')
    })

    it('drops non-string entries', async () => {
      getRoomServiceTypesMock.mockResolvedValue({ service_types: ['messaging', 1, null, '', 'directory'] })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomServiceTypes('!r:e')).toEqual({
        status: 'ok',
        serviceTypes: ['messaging', 'directory']
      })
    })

    it('returns empty when the server answers without service types', async () => {
      getRoomServiceTypesMock.mockResolvedValue({ service_types: [] })
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomServiceTypes('!r:e')).toEqual({ status: 'empty' })
    })

    it('classifies M_UNRECOGNIZED as unsupported', async () => {
      getRoomServiceTypesMock.mockRejectedValue(Object.assign(new Error('not found'), { errcode: 'M_UNRECOGNIZED' }))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomServiceTypes('!r:e')).toEqual({ status: 'unsupported' })
    })

    it('classifies other failures as error', async () => {
      getRoomServiceTypesMock.mockRejectedValue(Object.assign(new Error('forbidden'), { errcode: 'M_FORBIDDEN' }))
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomServiceTypes('!r:e')).toEqual({ status: 'error' })
    })

    it('classifies an uninitialized client as error', async () => {
      vi.mocked(matrixClientService.getClient).mockImplementation(() => {
        throw new Error('客户端未初始化')
      })
      expect(await service.getRoomServiceTypes('!r:e')).toEqual({ status: 'error' })
    })
  })
})
