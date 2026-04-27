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

const { MatrixRoomMetadataService } = await import('../MetadataService')

const makeHttpClient = (impl: (method: string, url: string, qp?: unknown, body?: unknown) => unknown) => ({
  http: {
    authedRequest: vi.fn((method: string, url: string, qp?: unknown, body?: unknown) => impl(method, url, qp, body))
  }
})

describe('MatrixRoomMetadataService', () => {
  let service: InstanceType<typeof MatrixRoomMetadataService>

  beforeEach(() => {
    service = new MatrixRoomMetadataService()
    getClientMock.mockReset()
  })

  describe('getRoomVersion', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.getRoomVersion('!r')).rejects.toThrow('[MatrixRoom] 客户端未初始化')
    })

    it('returns null when room is missing from local cache', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      expect(await service.getRoomVersion('!r')).toBeNull()
    })

    it('reads room_version from m.room.create state event', async () => {
      const room = {
        currentState: {
          getStateEvents: vi.fn(() => ({ getContent: () => ({ room_version: '11' }) }))
        }
      }
      getClientMock.mockReturnValueOnce({ getRoom: () => room })
      expect(await service.getRoomVersion('!r')).toBe('11')
      expect(room.currentState.getStateEvents).toHaveBeenCalledWith('m.room.create', '')
    })

    it('returns null when state event lacks room_version', async () => {
      const room = {
        currentState: {
          getStateEvents: vi.fn(() => ({ getContent: () => ({}) }))
        }
      }
      getClientMock.mockReturnValueOnce({ getRoom: () => room })
      expect(await service.getRoomVersion('!r')).toBeNull()
    })

    it('swallows errors and returns null', async () => {
      getClientMock.mockReturnValueOnce({
        getRoom: () => {
          throw new Error('boom')
        }
      })
      expect(await service.getRoomVersion('!r')).toBeNull()
    })
  })

  describe('getRoomCapabilities', () => {
    it('GETs /capabilities and returns the payload', async () => {
      const client = makeHttpClient(() => ({ 'm.room_versions': { default: '11' } }))
      getClientMock.mockReturnValueOnce(client)
      expect(await service.getRoomCapabilities('!r:e')).toEqual({ 'm.room_versions': { default: '11' } })
      expect(client.http.authedRequest).toHaveBeenCalledWith(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent('!r:e')}/capabilities`
      )
    })

    it('swallows errors and returns {}', async () => {
      getClientMock.mockReturnValueOnce(
        makeHttpClient(() => {
          throw new Error('500')
        })
      )
      expect(await service.getRoomCapabilities('!r')).toEqual({})
    })
  })

  describe('getRoomMetadata / getRoomTurnServer / getRoomSync', () => {
    it('getRoomMetadata hits /metadata', async () => {
      const client = makeHttpClient(() => ({ a: 1 }))
      getClientMock.mockReturnValueOnce(client)
      expect(await service.getRoomMetadata('!r')).toEqual({ a: 1 })
      expect(client.http.authedRequest).toHaveBeenCalledWith(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent('!r')}/metadata`
      )
    })

    it('getRoomTurnServer hits /turn_server', async () => {
      const client = makeHttpClient(() => ({ uris: ['turn:e'] }))
      getClientMock.mockReturnValueOnce(client)
      expect(await service.getRoomTurnServer('!r')).toEqual({ uris: ['turn:e'] })
      expect(client.http.authedRequest).toHaveBeenCalledWith(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent('!r')}/turn_server`
      )
    })

    it('getRoomSync hits /sync', async () => {
      const client = makeHttpClient(() => ({ timeline: [] }))
      getClientMock.mockReturnValueOnce(client)
      expect(await service.getRoomSync('!r')).toEqual({ timeline: [] })
      expect(client.http.authedRequest).toHaveBeenCalledWith(
        'GET',
        `/_matrix/client/v3/rooms/${encodeURIComponent('!r')}/sync`
      )
    })

    it('all three swallow errors and return {}', async () => {
      const failing = () => {
        throw new Error('500')
      }
      getClientMock.mockReturnValueOnce(makeHttpClient(failing))
      expect(await service.getRoomMetadata('!r')).toEqual({})
      getClientMock.mockReturnValueOnce(makeHttpClient(failing))
      expect(await service.getRoomTurnServer('!r')).toEqual({})
      getClientMock.mockReturnValueOnce(makeHttpClient(failing))
      expect(await service.getRoomSync('!r')).toEqual({})
    })

    it('all three throw when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.getRoomMetadata('!r')).rejects.toThrow('[MatrixRoom] 客户端未初始化')
      getClientMock.mockReturnValueOnce(null)
      await expect(service.getRoomTurnServer('!r')).rejects.toThrow('[MatrixRoom] 客户端未初始化')
      getClientMock.mockReturnValueOnce(null)
      await expect(service.getRoomSync('!r')).rejects.toThrow('[MatrixRoom] 客户端未初始化')
    })
  })
})
