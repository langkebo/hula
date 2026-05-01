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

const { MatrixRoomAccountDataService } = await import('../AccountDataService')

const makeClient = (
  userId: string | null,
  impl: (method: string, url: string, qp?: unknown, body?: unknown) => unknown
) => ({
  getUserId: () => userId,
  http: {
    authedRequest: vi.fn((method: string, url: string, qp?: unknown, body?: unknown) => impl(method, url, qp, body))
  }
})

describe('MatrixRoomAccountDataService', () => {
  let service: InstanceType<typeof MatrixRoomAccountDataService>

  beforeEach(() => {
    service = new MatrixRoomAccountDataService()
    getClientMock.mockReset()
  })

  describe('getRoomAccountData', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.getRoomAccountData('!r', 'm.x')).rejects.toThrow('[MatrixRoom] 客户端未初始化')
    })

    it('GETs the user/rooms/account_data URL with triple-encoded params', async () => {
      const client = makeClient('@me:e', () => ({ foo: 1 }))
      getClientMock.mockReturnValueOnce(client)
      expect(await service.getRoomAccountData('!r:e', 'm.fully_read')).toEqual({ foo: 1 })
      expect(client.http.authedRequest).toHaveBeenCalledWith(
        'GET',
        `/_matrix/client/v3/user/${encodeURIComponent('@me:e')}/rooms/${encodeURIComponent('!r:e')}/account_data/${encodeURIComponent('m.fully_read')}`
      )
    })

    it('swallows backend errors and returns null', async () => {
      getClientMock.mockReturnValueOnce(
        makeClient('@me:e', () => {
          throw new Error('404')
        })
      )
      expect(await service.getRoomAccountData('!r', 'x')).toBeNull()
    })
  })

  describe('setRoomAccountData', () => {
    it('PUTs the payload as-is', async () => {
      const client = makeClient('@me:e', () => undefined)
      getClientMock.mockReturnValueOnce(client)
      await service.setRoomAccountData('!r', 'm.x', { a: 1 })
      expect(client.http.authedRequest).toHaveBeenCalledWith(
        'PUT',
        `/_matrix/client/v3/user/${encodeURIComponent('@me:e')}/rooms/${encodeURIComponent('!r')}/account_data/${encodeURIComponent('m.x')}`,
        undefined,
        { a: 1 }
      )
    })

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce(
        makeClient('@me:e', () => {
          throw new Error('403')
        })
      )
      await expect(service.setRoomAccountData('!r', 'x', {})).rejects.toThrow('403')
    })
  })

  describe('getReportScannerInfo', () => {
    it('GETs the v1 scanner_info endpoint', async () => {
      const client = makeClient('@me:e', () => ({ clean: true }))
      getClientMock.mockReturnValueOnce(client)
      expect(await service.getReportScannerInfo('!r', '$e')).toEqual({ clean: true })
      expect(client.http.authedRequest).toHaveBeenCalledWith(
        'GET',
        `/_matrix/client/v1/rooms/${encodeURIComponent('!r')}/report/${encodeURIComponent('$e')}/scanner_info`
      )
    })

    it('swallows backend errors and returns null', async () => {
      getClientMock.mockReturnValueOnce(
        makeClient('@me:e', () => {
          throw new Error('404')
        })
      )
      expect(await service.getReportScannerInfo('!r', '$e')).toBeNull()
    })
  })

  describe('setReadLifetime', () => {
    it('PUTs burn config to /burn', async () => {
      const client = makeClient('@me:e', () => undefined)
      getClientMock.mockReturnValueOnce(client)
      await service.setReadLifetime('!r', 5000)
      expect(client.http.authedRequest).toHaveBeenCalledWith(
        'PUT',
        `/_matrix/client/v3/rooms/${encodeURIComponent('!r')}/burn`,
        undefined,
        { enabled: true, burn_after_ms: 5000 }
      )
    })

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce(
        makeClient('@me:e', () => {
          throw new Error('403')
        })
      )
      await expect(service.setReadLifetime('!r', 1000)).rejects.toThrow('403')
    })
  })

  describe('getExternalServices', () => {
    it('unwraps `services` array from the response', async () => {
      const client = makeClient('@me:e', () => ({ services: [{ id: 'a' }] }))
      getClientMock.mockReturnValueOnce(client)
      expect(await service.getExternalServices()).toEqual([{ id: 'a' }])
      expect(client.http.authedRequest).toHaveBeenCalledWith('GET', '/_synapse/admin/v1/external_services')
    })

    it('returns [] when backend omits `services`', async () => {
      getClientMock.mockReturnValueOnce(makeClient('@me:e', () => ({})))
      expect(await service.getExternalServices()).toEqual([])
    })

    it('swallows backend errors and returns []', async () => {
      getClientMock.mockReturnValueOnce(
        makeClient('@me:e', () => {
          throw new Error('500')
        })
      )
      expect(await service.getExternalServices()).toEqual([])
    })
  })
})
