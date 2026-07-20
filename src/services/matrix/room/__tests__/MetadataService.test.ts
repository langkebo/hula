import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { MatrixRoomMetadataService } from '../MetadataService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

const server = setupMswServer(
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

const authedRequestImpl = vi.fn()

const makeHttpClient = () => ({
  http: {
    authedRequest: authedRequestImpl
  }
})

describe('MatrixRoomMetadataService', () => {
  let service: InstanceType<typeof MatrixRoomMetadataService>

  beforeEach(() => {
    vi.clearAllMocks()
    authedRequestImpl.mockImplementation(
      async (method: string, path: string, _queryParams?: unknown, body?: unknown) => {
        const prefixedPath = path.startsWith('/_matrix') ? path : `${PREFIX_V3}${path}`
        const url = `${TEST_BASE_URL}${prefixedPath}`
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token'
        }
        const response = await fetch(url, {
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
    it('GETs /capabilities and returns the payload', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomCapabilities('!r:e')).toEqual({ 'm.room_versions': { default: '11' } })
      expect(authedRequestImpl).toHaveBeenCalledWith('GET', `/rooms/${encodeURIComponent('!r:e')}/capabilities`)
    })

    it('swallows errors and returns {}', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/capabilities`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomCapabilities('!r')).toEqual({})
    })
  })

  describe('getRoomMetadata / getRoomTurnServer / getRoomSync', () => {
    it('getRoomMetadata hits /metadata', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomMetadata('!r')).toEqual({ a: 1 })
      expect(authedRequestImpl).toHaveBeenCalledWith('GET', `/rooms/${encodeURIComponent('!r')}/metadata`)
    })

    it('getRoomTurnServer hits /turn_server', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomTurnServer('!r')).toEqual({ uris: ['turn:e'] })
      expect(authedRequestImpl).toHaveBeenCalledWith('GET', `/rooms/${encodeURIComponent('!r')}/turn_server`)
    })

    it('getRoomSync hits /sync', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeHttpClient() as never)
      expect(await service.getRoomSync('!r')).toEqual({ timeline: [] })
      expect(authedRequestImpl).toHaveBeenCalledWith('GET', `/rooms/${encodeURIComponent('!r')}/sync`)
    })

    it('all three swallow errors and return {}', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/metadata`, () => {
          return new HttpResponse(null, { status: 500 })
        }),
        http.get(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/turn_server`, () => {
          return new HttpResponse(null, { status: 500 })
        }),
        http.get(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/sync`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      vi.mocked(matrixClientService.getClient)
        .mockReturnValueOnce(makeHttpClient() as never)
        .mockReturnValueOnce(makeHttpClient() as never)
        .mockReturnValueOnce(makeHttpClient() as never)
      expect(await service.getRoomMetadata('!r')).toEqual({})
      expect(await service.getRoomTurnServer('!r')).toEqual({})
      expect(await service.getRoomSync('!r')).toEqual({})
    })

    it('all three throw when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      await expect(service.getRoomMetadata('!r')).rejects.toThrow('客户端未初始化')
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      await expect(service.getRoomTurnServer('!r')).rejects.toThrow('客户端未初始化')
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      await expect(service.getRoomSync('!r')).rejects.toThrow('客户端未初始化')
    })
  })
})
