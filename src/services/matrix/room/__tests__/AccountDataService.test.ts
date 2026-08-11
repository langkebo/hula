import type { MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { MATRIX_PATHS } from '../../paths'
import { MatrixRoomAccountDataService } from '../AccountDataService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

type AccountDataManagerInstance = ReturnType<NonNullable<MatrixClient['getAccountDataManager']>>

const server = setupMswServer(
  http.get(`${TEST_BASE_URL}/_matrix/client/v1/rooms/:roomId/report/:eventId/scanner_info`, () => {
    return HttpResponse.json({ clean: true })
  }),
  http.put(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/burn`, async () => {
    return HttpResponse.json({})
  }),
  http.get(`${TEST_BASE_URL}/_synapse/admin/v1/external_services`, () => {
    return HttpResponse.json({ services: [{ id: 'a' }] })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/admin/v1/external_services`, () => {
    return new HttpResponse(null, { status: 500 })
  }),
  // FT-089: sign/verify/message_queue/encrypted_events
  http.put(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/sign/:eventId`, () => {
    return HttpResponse.json({ signature: 'sig', signed_by: '@me:e' })
  }),
  http.post(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/verify/:eventId`, () => {
    return HttpResponse.json({ valid: true, verifier: '@me:e' })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/message_queue`, () => {
    return HttpResponse.json({ queue: [{ event_id: '$e:1', type: 'm.room.message' }] })
  }),
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/encrypted_events`, () => {
    return HttpResponse.json({ events: [{ event_id: '$e:1' }] })
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const authedRequestImpl = vi.fn()

describe('MatrixRoomAccountDataService', () => {
  let service: InstanceType<typeof MatrixRoomAccountDataService>
  let accountDataMgr: {
    getRoomAccountDataFromServer: ReturnType<typeof vi.fn>
    setRoomAccountData: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.clearAllMocks()
    authedRequestImpl.mockImplementation(
      async (method: string, path: string, _queryParams?: unknown, body?: unknown, opts?: { prefix?: string }) => {
        const defaultPrefix = path.startsWith('/_') ? '' : PREFIX_V3
        const prefix = opts?.prefix ?? defaultPrefix
        const url = `${TEST_BASE_URL}${prefix}${path}`
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
    accountDataMgr = {
      getRoomAccountDataFromServer: vi.fn(),
      setRoomAccountData: vi.fn()
    }
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    service = new MatrixRoomAccountDataService()
  })

  const makeClient = (userId: string) => ({
    getUserId: () => userId,
    http: {
      authedRequest: authedRequestImpl
    },
    getAccountDataManager: () => accountDataMgr as unknown as AccountDataManagerInstance
  })

  describe('getRoomAccountData via AccountDataManager', () => {
    it('throws when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      await expect(service.getRoomAccountData('!r', 'm.x')).rejects.toThrow('客户端未初始化')
    })

    it('calls getRoomAccountDataFromServer and returns event content', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      const eventContent = { foo: 1 }
      // AccountDataManager.getRoomAccountDataFromServer wraps the response in a MatrixEvent
      accountDataMgr.getRoomAccountDataFromServer.mockResolvedValue({
        getContent: () => eventContent
      })
      expect(await service.getRoomAccountData('!r:e', 'm.fully_read')).toEqual({ foo: 1 })
      expect(accountDataMgr.getRoomAccountDataFromServer).toHaveBeenCalledWith('!r:e', 'm.fully_read')
    })

    it('returns null when manager returns undefined (data not found)', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      accountDataMgr.getRoomAccountDataFromServer.mockResolvedValue(undefined)
      expect(await service.getRoomAccountData('!r:e', 'm.x')).toBeNull()
    })

    it('swallows backend errors and returns null', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      accountDataMgr.getRoomAccountDataFromServer.mockRejectedValue(new Error('HTTP 404'))
      expect(await service.getRoomAccountData('!r', 'x')).toBeNull()
    })
  })

  describe('setRoomAccountData via AccountDataManager', () => {
    it('calls setRoomAccountData with roomId/eventType/content', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      accountDataMgr.setRoomAccountData.mockResolvedValue(undefined)
      await service.setRoomAccountData('!r', 'm.x', { a: 1 })
      expect(accountDataMgr.setRoomAccountData).toHaveBeenCalledWith('!r', 'm.x', { a: 1 })
    })

    it('re-throws backend errors', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      accountDataMgr.setRoomAccountData.mockRejectedValue(new Error('HTTP 403'))
      await expect(service.setRoomAccountData('!r', 'x', {})).rejects.toThrow('403')
    })
  })

  describe('getReportScannerInfo', () => {
    it('GETs the v1 scanner_info endpoint', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getReportScannerInfo('!r', '$e')).toEqual({ clean: true })
      expect(authedRequestImpl).toHaveBeenCalledWith(
        'GET',
        `/rooms/${encodeURIComponent('!r')}/report/${encodeURIComponent('$e')}/scanner_info`,
        undefined,
        undefined,
        { prefix: '/_matrix/client/v1' }
      )
    })

    it('swallows backend errors and returns null', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_matrix/client/v1/rooms/:roomId/report/:eventId/scanner_info`, () => {
          return new HttpResponse(null, { status: 404 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getReportScannerInfo('!r', '$e')).toBeNull()
    })
  })

  describe('setReadLifetime', () => {
    it('PUTs burn config to BURN.ROOM_BURN(roomId)（FT-089: 使用 L3 常量）', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      await service.setReadLifetime('!r', 5000)
      expect(authedRequestImpl).toHaveBeenCalledWith('PUT', MATRIX_PATHS.BURN.ROOM_BURN('!r'), undefined, {
        enabled: true,
        burn_after_ms: 5000
      })
    })

    it('re-throws backend errors', async () => {
      server.use(
        http.put(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/burn`, () => {
          return new HttpResponse(null, { status: 403 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      await expect(service.setReadLifetime('!r', 1000)).rejects.toThrow('403')
    })
  })

  // FT-089: 4 个新方法的行为测试 — 验证 path 严格等于 L3 常量值
  describe('signEvent', () => {
    it('PUTs to ROOM.SIGN_EVENT(roomId, eventId)（FT-089）', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      const result = await service.signEvent('!r:e', '$ev:1')
      expect(result).toEqual({ signature: 'sig', signed_by: '@me:e' })
      expect(authedRequestImpl).toHaveBeenCalledWith('PUT', MATRIX_PATHS.ROOM.SIGN_EVENT('!r:e', '$ev:1'))
    })

    it('re-throws backend errors', async () => {
      server.use(
        http.put(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/sign/:eventId`, () => {
          return new HttpResponse(null, { status: 403 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      await expect(service.signEvent('!r:e', '$ev:1')).rejects.toThrow('403')
    })
  })

  describe('verifyEvent', () => {
    it('POSTs to ROOM.VERIFY_EVENT(roomId, eventId)（FT-089）', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      const result = await service.verifyEvent('!r:e', '$ev:1')
      expect(result).toEqual({ valid: true, verifier: '@me:e' })
      expect(authedRequestImpl).toHaveBeenCalledWith('POST', MATRIX_PATHS.ROOM.VERIFY_EVENT('!r:e', '$ev:1'))
    })

    it('re-throws backend errors', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/verify/:eventId`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      await expect(service.verifyEvent('!r:e', '$ev:1')).rejects.toThrow('500')
    })
  })

  describe('getMessageQueue', () => {
    it('GETs ROOM.MESSAGE_QUEUE(roomId)（FT-089）', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      const result = await service.getMessageQueue('!r:e')
      expect(result.queue).toEqual([{ event_id: '$e:1', type: 'm.room.message' }])
      expect(authedRequestImpl).toHaveBeenCalledWith('GET', MATRIX_PATHS.ROOM.MESSAGE_QUEUE('!r:e'))
    })

    it('swallows backend errors and returns {}', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/message_queue`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getMessageQueue('!r:e')).toEqual({})
    })
  })

  describe('getEncryptedEvents', () => {
    it('GETs ROOM.ENCRYPTED_EVENTS(roomId)（FT-089）', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      const result = await service.getEncryptedEvents('!r:e')
      expect(result.events).toEqual([{ event_id: '$e:1' }])
      expect(authedRequestImpl).toHaveBeenCalledWith('GET', MATRIX_PATHS.ROOM.ENCRYPTED_EVENTS('!r:e'))
    })

    it('swallows backend errors and returns {}', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}${PREFIX_V3}/rooms/:roomId/encrypted_events`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getEncryptedEvents('!r:e')).toEqual({})
    })
  })

  describe('getExternalServices', () => {
    it('unwraps `services` array from the response', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getExternalServices()).toEqual([{ id: 'a' }])
      expect(authedRequestImpl).toHaveBeenCalledWith('GET', '/_synapse/admin/v1/external_services')
    })

    it('returns [] when backend omits `services`', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_synapse/admin/v1/external_services`, () => {
          return HttpResponse.json({})
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getExternalServices()).toEqual([])
    })

    it('swallows backend errors and returns []', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_synapse/admin/v1/external_services`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getExternalServices()).toEqual([])
    })
  })
})
