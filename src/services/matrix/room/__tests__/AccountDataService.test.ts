import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { MatrixRoomAccountDataService } from '../AccountDataService'

const TEST_BASE_URL = 'https://matrix.example.com'

const server = setupMswServer(
  http.get(`${TEST_BASE_URL}/user/:userId/rooms/:roomId/account_data/:eventType`, () => {
    return HttpResponse.json({ foo: 1 })
  }),
  http.put(`${TEST_BASE_URL}/user/:userId/rooms/:roomId/account_data/:eventType`, async () => {
    return HttpResponse.json({})
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v1/rooms/:roomId/report/:eventId/scanner_info`, () => {
    return HttpResponse.json({ clean: true })
  }),
  http.put(`${TEST_BASE_URL}/rooms/:roomId/burn`, async () => {
    return HttpResponse.json({})
  }),
  http.get(`${TEST_BASE_URL}/_synapse/admin/v1/external_services`, () => {
    return HttpResponse.json({ services: [{ id: 'a' }] })
  }),
  http.get(`${TEST_BASE_URL}/_matrix/admin/v1/external_services`, () => {
    return new HttpResponse(null, { status: 500 })
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

  beforeEach(() => {
    vi.clearAllMocks()
    authedRequestImpl.mockImplementation(
      async (method: string, path: string, _queryParams?: unknown, body?: unknown) => {
        const url = `${TEST_BASE_URL}${path}`
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
    service = new MatrixRoomAccountDataService()
  })

  const makeClient = (userId: string) => ({
    getUserId: () => userId,
    http: {
      authedRequest: authedRequestImpl
    }
  })

  describe('getRoomAccountData', () => {
    it('throws when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)
      await expect(service.getRoomAccountData('!r', 'm.x')).rejects.toThrow('客户端未初始化')
    })

    it('GETs the user/rooms/account_data URL with triple-encoded params', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getRoomAccountData('!r:e', 'm.fully_read')).toEqual({ foo: 1 })
      expect(authedRequestImpl).toHaveBeenCalledWith(
        'GET',
        `/user/${encodeURIComponent('@me:e')}/rooms/${encodeURIComponent('!r:e')}/account_data/${encodeURIComponent('m.fully_read')}`
      )
    })

    it('swallows backend errors and returns null', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/user/:userId/rooms/:roomId/account_data/:eventType`, () => {
          return new HttpResponse(null, { status: 404 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getRoomAccountData('!r', 'x')).toBeNull()
    })
  })

  describe('setRoomAccountData', () => {
    it('PUTs the payload as-is', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      await service.setRoomAccountData('!r', 'm.x', { a: 1 })
      expect(authedRequestImpl).toHaveBeenCalledWith(
        'PUT',
        `/user/${encodeURIComponent('@me:e')}/rooms/${encodeURIComponent('!r')}/account_data/${encodeURIComponent('m.x')}`,
        undefined,
        { a: 1 }
      )
    })

    it('re-throws backend errors', async () => {
      server.use(
        http.put(`${TEST_BASE_URL}/user/:userId/rooms/:roomId/account_data/:eventType`, () => {
          return new HttpResponse(null, { status: 403 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      await expect(service.setRoomAccountData('!r', 'x', {})).rejects.toThrow('403')
    })
  })

  describe('getReportScannerInfo', () => {
    it('GETs the v1 scanner_info endpoint', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      expect(await service.getReportScannerInfo('!r', '$e')).toEqual({ clean: true })
      expect(authedRequestImpl).toHaveBeenCalledWith(
        'GET',
        `/_matrix/client/v1/rooms/${encodeURIComponent('!r')}/report/${encodeURIComponent('$e')}/scanner_info`
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
    it('PUTs burn config to /burn', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      await service.setReadLifetime('!r', 5000)
      expect(authedRequestImpl).toHaveBeenCalledWith('PUT', `/rooms/${encodeURIComponent('!r')}/burn`, undefined, {
        enabled: true,
        burn_after_ms: 5000
      })
    })

    it('re-throws backend errors', async () => {
      server.use(
        http.put(`${TEST_BASE_URL}/rooms/:roomId/burn`, () => {
          return new HttpResponse(null, { status: 403 })
        })
      )
      vi.mocked(matrixClientService.getClient).mockReturnValue(makeClient('@me:e') as never)
      await expect(service.setReadLifetime('!r', 1000)).rejects.toThrow('403')
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
