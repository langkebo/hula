import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { MatrixRoomAccountDataService } from '../AccountDataService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

const server = setupMswServer(
  http.get(`${TEST_BASE_URL}${PREFIX_V3}/user/:userId/rooms/:roomId/account_data/:eventType`, () => {
    return HttpResponse.json({ foo: 1 })
  }),
  http.put(`${TEST_BASE_URL}${PREFIX_V3}/user/:userId/rooms/:roomId/account_data/:eventType`, async () => {
    return HttpResponse.json({})
  }),
  http.get(`${TEST_BASE_URL}/_matrix/client/v1/rooms/:roomId/report/:eventId/scanner_info`, () => {
    return HttpResponse.json({ clean: true })
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
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    service = new MatrixRoomAccountDataService()
  })

  const makeClient = (userId: string, managers: Record<string, Record<string, unknown>> = {}) => ({
    getUserId: () => userId,
    http: {
      authedRequest: authedRequestImpl
    },
    getAccountDataManager: () => ({
      getRoomAccountDataFromServer: vi.fn().mockImplementation(async (roomId: string, eventType: string) => {
        // Simulate the SDK behavior: make an HTTP request and return a MatrixEvent-like object
        const path = `/user/${encodeURIComponent(userId)}/rooms/${encodeURIComponent(roomId)}/account_data/${encodeURIComponent(eventType)}`
        const response = await authedRequestImpl('GET', path)
        return {
          getContent: () => response
        }
      }),
      setRoomAccountData: vi.fn().mockImplementation(async (roomId: string, eventType: string, content: unknown) => {
        const path = `/user/${encodeURIComponent(userId)}/rooms/${encodeURIComponent(roomId)}/account_data/${encodeURIComponent(eventType)}`
        return authedRequestImpl('PUT', path, undefined, content)
      })
    }),
    getBurnAfterReadManager: () => managers.burnAfterRead ?? {},
    getExternalServiceManager: () => managers.externalService ?? {},
    getRoomSummaryManager: () => managers.roomSummary ?? {}
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
        http.get(`${TEST_BASE_URL}${PREFIX_V3}/user/:userId/rooms/:roomId/account_data/:eventType`, () => {
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
        http.put(`${TEST_BASE_URL}${PREFIX_V3}/user/:userId/rooms/:roomId/account_data/:eventType`, () => {
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
    it('enables burn via BurnAfterReadManager', async () => {
      const enableBurn = vi.fn().mockResolvedValue({ enabled: true, burn_after_ms: 5000 })
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        makeClient('@me:e', { burnAfterRead: { enableBurn } }) as never
      )
      await service.setReadLifetime('!r', 5000)
      expect(enableBurn).toHaveBeenCalledWith('!r', 5000)
    })

    it('re-throws manager errors', async () => {
      const enableBurn = vi.fn().mockRejectedValue(new Error('manager error'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        makeClient('@me:e', { burnAfterRead: { enableBurn } }) as never
      )
      await expect(service.setReadLifetime('!r', 1000)).rejects.toThrow('manager error')
    })
  })

  describe('getExternalServices', () => {
    it('lists services via ExternalServiceManager (synapse_admin first)', async () => {
      const listServices = vi.fn().mockResolvedValue({ services: [{ id: 'a' }] })
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        makeClient('@me:e', { externalService: { listServices } }) as never
      )
      expect(await service.getExternalServices()).toEqual([{ id: 'a' }])
      expect(listServices).toHaveBeenCalledWith('synapse_admin')
    })

    it('falls back to matrix_admin when synapse_admin fails', async () => {
      const listServices = vi
        .fn()
        .mockRejectedValueOnce(new Error('synapse admin unavailable'))
        .mockResolvedValueOnce({ services: [{ id: 'b' }] })
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        makeClient('@me:e', { externalService: { listServices } }) as never
      )
      expect(await service.getExternalServices()).toEqual([{ id: 'b' }])
      expect(listServices).toHaveBeenNthCalledWith(1, 'synapse_admin')
      expect(listServices).toHaveBeenNthCalledWith(2, 'matrix_admin')
    })

    it('returns [] when both prefixes fail', async () => {
      const listServices = vi.fn().mockRejectedValue(new Error('unavailable'))
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        makeClient('@me:e', { externalService: { listServices } }) as never
      )
      expect(await service.getExternalServices()).toEqual([])
    })

    it('returns [] when services is missing', async () => {
      const listServices = vi.fn().mockResolvedValue({})
      vi.mocked(matrixClientService.getClient).mockReturnValue(
        makeClient('@me:e', { externalService: { listServices } }) as never
      )
      expect(await service.getExternalServices()).toEqual([])
    })
  })
})
