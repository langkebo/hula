import { beforeEach, describe, expect, it, vi } from 'vitest'
import endpointCapabilityService from '../../EndpointCapabilityService'
import { matrixClientService } from '../../MatrixClientService'
import { getRuntimeAwareFetch } from '../../network/runtimeFetch'
import { synapseStickyEventService } from '../SynapseStickyEventService'

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

vi.mock('../../EndpointCapabilityService', () => ({
  default: {
    check: vi.fn(),
    clear: vi.fn()
  }
}))

vi.mock('../../paths', () => ({
  PREFIX_V3: '/_matrix/client/v3',
  MATRIX_PATHS: {}
}))

function makeResponse(args: { ok: boolean; status: number; textResp?: string }): Response {
  return {
    ok: args.ok,
    status: args.status,
    text: async () => args.textResp ?? '',
    headers: { get: () => null }
  } as unknown as Response
}

describe('SynapseStickyEventService', () => {
  const getHomeserverUrl = matrixClientService.getHomeserverUrl as ReturnType<typeof vi.fn>
  const getAccessToken = matrixClientService.getAccessToken as ReturnType<typeof vi.fn>
  const getRuntimeAwareFetchMock = getRuntimeAwareFetch as ReturnType<typeof vi.fn>
  const endpointCheckMock = endpointCapabilityService.check as ReturnType<typeof vi.fn>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getHomeserverUrl.mockReset()
    getAccessToken.mockReset()
    getRuntimeAwareFetchMock.mockReset()
    endpointCheckMock.mockReset()
    fetchMock = vi.fn()
    getRuntimeAwareFetchMock.mockReturnValue(fetchMock)
    getHomeserverUrl.mockReturnValue('https://hs.example.com')
    getAccessToken.mockReturnValue('tok')
    endpointCheckMock.mockResolvedValue(true)
    synapseStickyEventService.clear()
  })

  describe('getStickyEvents', () => {
    it('returns [] when the endpoint is unavailable', async () => {
      endpointCheckMock.mockResolvedValue(false)
      const result = await synapseStickyEventService.getStickyEvents('!room:hs')
      expect(result).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('parses events from a plain { events } response', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({ events: [{ event_id: 'e1', event_type: 'm.text', content: {}, updated_ts: 1 }] })
        })
      )
      const result = await synapseStickyEventService.getStickyEvents('!room:hs')
      expect(result).toHaveLength(1)
      expect(result[0].event_id).toBe('e1')
    })

    it('parses events from a wrapped { data: { events } } response', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({
            data: { events: [{ event_id: 'e2', event_type: 'm.reaction', content: {}, updated_ts: 2 }] }
          })
        })
      )
      const result = await synapseStickyEventService.getStickyEvents('!room:hs')
      expect(result).toHaveLength(1)
      expect(result[0].event_id).toBe('e2')
    })

    it('returns [] when the response has no events field', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      const result = await synapseStickyEventService.getStickyEvents('!room:hs')
      expect(result).toEqual([])
    })

    it('returns [] when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      const result = await synapseStickyEventService.getStickyEvents('!room:hs')
      expect(result).toEqual([])
    })

    it('encodes the roomId in the request path', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await synapseStickyEventService.getStickyEvents('!a b/room:hs')
      const [url] = fetchMock.mock.calls[0]
      expect(url).toContain('/rooms/!a%20b%2Froom%3Ahs/sticky_events')
    })
  })

  describe('setStickyEvent', () => {
    it('sends a POST and resolves on success', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await expect(synapseStickyEventService.setStickyEvent('!room:hs', 'e1', 'm.text')).resolves.toBeUndefined()
      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('/rooms/!room%3Ahs/sticky_events')
      expect(init.method).toBe('POST')
      expect(JSON.parse(init.body)).toEqual({ events: [{ event_id: 'e1', event_type: 'm.text' }] })
    })

    it('rethrows when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      await expect(synapseStickyEventService.setStickyEvent('!room:hs', 'e1', 'm.text')).rejects.toThrow('boom')
    })
  })

  describe('clearStickyEvent', () => {
    it('sends a DELETE and resolves on success', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await expect(synapseStickyEventService.clearStickyEvent('!room:hs', 'm.text')).resolves.toBeUndefined()
      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('/rooms/!room%3Ahs/sticky_events/m.text')
      expect(init.method).toBe('DELETE')
    })

    it('rethrows when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      await expect(synapseStickyEventService.clearStickyEvent('!room:hs', 'm.text')).rejects.toThrow('boom')
    })
  })
})
