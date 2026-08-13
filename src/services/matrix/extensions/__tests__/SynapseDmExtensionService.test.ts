import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { getRuntimeAwareFetch } from '../../network/runtimeFetch'
import { synapseDmExtensionService } from '../SynapseDmExtensionService'

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getHomeserverUrl: vi.fn(),
    getAccessToken: vi.fn(),
    waitForClientReady: vi.fn()
  }
}))

vi.mock('../../network/runtimeFetch', () => ({
  getRuntimeAwareFetch: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('../../paths', () => ({
  PREFIX_V3: '/_matrix/client/v3',
  MATRIX_PATHS: {
    FRIENDS: {
      DM: (userId: string) => `/friends/dm/${userId}`
    }
  }
}))

function makeResponse(args: { ok: boolean; status: number; textResp?: string }): Response {
  return {
    ok: args.ok,
    status: args.status,
    text: async () => args.textResp ?? '',
    headers: { get: () => null }
  } as unknown as Response
}

describe('SynapseDmExtensionService', () => {
  const getHomeserverUrl = matrixClientService.getHomeserverUrl as ReturnType<typeof vi.fn>
  const getAccessToken = matrixClientService.getAccessToken as ReturnType<typeof vi.fn>
  const getRuntimeAwareFetchMock = getRuntimeAwareFetch as ReturnType<typeof vi.fn>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getHomeserverUrl.mockReset()
    getAccessToken.mockReset()
    getRuntimeAwareFetchMock.mockReset()
    fetchMock = vi.fn()
    getRuntimeAwareFetchMock.mockReturnValue(fetchMock)
    getHomeserverUrl.mockReturnValue('https://hs.example.com')
    getAccessToken.mockReturnValue('tok')
    synapseDmExtensionService.clear()
  })

  describe('createPrivateDm', () => {
    it('returns unwrapped data on success', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ room_id: '!dm:hs', created: true }) })
      )
      const result = await synapseDmExtensionService.createPrivateDm('@alice:hs')
      expect(result).toEqual({ room_id: '!dm:hs', created: true })
    })

    it('returns unwrapped data from wrapped { data } response', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({ data: { room_id: '!dm2:hs', created: false } })
        })
      )
      const result = await synapseDmExtensionService.createPrivateDm('@alice:hs')
      expect(result).toEqual({ room_id: '!dm2:hs', created: false })
    })

    it('falls back to default empty result when response carries no data', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: null }) }))
      const result = await synapseDmExtensionService.createPrivateDm('@alice:hs')
      expect(result).toEqual({ room_id: '', created: false })
    })

    it('sends is_private=true by default', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await synapseDmExtensionService.createPrivateDm('@alice:hs')
      const [, init] = fetchMock.mock.calls[0]
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body)).toEqual({ is_private: true })
    })

    it('sends is_private=false when isPrivate is false', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await synapseDmExtensionService.createPrivateDm('@alice:hs', false)
      const [, init] = fetchMock.mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({ is_private: false })
    })

    it('encodes the userId in the request path', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await synapseDmExtensionService.createPrivateDm('@a b:hs')
      const [url] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('/friends/dm/%40a%20b%3Ahs')
    })

    it('rethrows when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      await expect(synapseDmExtensionService.createPrivateDm('@alice:hs')).rejects.toThrow('boom')
    })
  })

  describe('getDmRoom', () => {
    it('returns unwrapped data on success', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ room_id: '!dm:hs', exists: true }) })
      )
      const result = await synapseDmExtensionService.getDmRoom('@alice:hs')
      expect(result).toEqual({ room_id: '!dm:hs', exists: true })
    })

    it('returns unwrapped data from wrapped { data } response', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({ data: { room_id: '!dm2:hs', exists: false } })
        })
      )
      const result = await synapseDmExtensionService.getDmRoom('@alice:hs')
      expect(result).toEqual({ room_id: '!dm2:hs', exists: false })
    })

    it('falls back to default empty result when response carries no data', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: null }) }))
      const result = await synapseDmExtensionService.getDmRoom('@alice:hs')
      expect(result).toEqual({ room_id: '', exists: false })
    })

    it('returns default empty result on request failure (does not throw)', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      const result = await synapseDmExtensionService.getDmRoom('@alice:hs')
      expect(result).toEqual({ room_id: '', exists: false })
    })
  })
})
