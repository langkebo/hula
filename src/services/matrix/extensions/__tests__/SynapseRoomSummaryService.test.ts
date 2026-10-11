import { beforeEach, describe, expect, it, vi } from 'vitest'
import endpointCapabilityService from '../../EndpointCapabilityService'
import { matrixClientService } from '../../MatrixClientService'
import { getRuntimeAwareFetch } from '../../network/runtimeFetch'
import { synapseRoomSummaryService } from '../SynapseRoomSummaryService'

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getHomeserverUrl: vi.fn(),
    getAccessToken: vi.fn(),
    waitForClientReady: vi.fn(),
    getClient: vi.fn()
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

vi.mock('../../paths/prefixes', () => ({
  PREFIX_V3: '/_matrix/client/v3'
}))

function makeResponse(args: { ok: boolean; status: number; textResp?: string }): Response {
  return {
    ok: args.ok,
    status: args.status,
    text: async () => args.textResp ?? '',
    headers: { get: () => null }
  } as unknown as Response
}

describe('SynapseRoomSummaryService', () => {
  const getHomeserverUrl = matrixClientService.getHomeserverUrl as ReturnType<typeof vi.fn>
  const getAccessToken = matrixClientService.getAccessToken as ReturnType<typeof vi.fn>
  const getClient = matrixClientService.getClient as ReturnType<typeof vi.fn>
  const getRuntimeAwareFetchMock = getRuntimeAwareFetch as ReturnType<typeof vi.fn>
  const endpointCheckMock = endpointCapabilityService.check as ReturnType<typeof vi.fn>
  const getRoomSummaryMock = vi.fn()
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getHomeserverUrl.mockReset()
    getAccessToken.mockReset()
    getRuntimeAwareFetchMock.mockReset()
    endpointCheckMock.mockReset()
    getClient.mockReset()
    getRoomSummaryMock.mockReset()
    endpointCheckMock.mockResolvedValue(true)
    fetchMock = vi.fn()
    getRuntimeAwareFetchMock.mockReturnValue(fetchMock)
    getHomeserverUrl.mockReturnValue('https://hs.example.com')
    getAccessToken.mockReturnValue('tok')
    getClient.mockReturnValue({ getRoomSummaryManager: () => ({ getRoomSummary: getRoomSummaryMock }) })
    synapseRoomSummaryService.clear()
  })

  describe('getRoomSummary（委托 SDK RoomSummaryManager）', () => {
    it('delegates with forceRefresh=true and forwards throwOnError', async () => {
      getRoomSummaryMock.mockResolvedValue({ room_id: '!r1:hs', name: 'Room', heroes: [] })
      const result = await synapseRoomSummaryService.getRoomSummary('!r1:hs')
      expect(getRoomSummaryMock).toHaveBeenCalledWith('!r1:hs', undefined, true, true)
      expect(result).toMatchObject({ room_id: '!r1:hs', name: 'Room' })
    })

    it('forwards throwOnError=false', async () => {
      getRoomSummaryMock.mockResolvedValue(null)
      const result = await synapseRoomSummaryService.getRoomSummary('!r2:hs', false)
      expect(getRoomSummaryMock).toHaveBeenCalledWith('!r2:hs', undefined, true, false)
      expect(result).toBeNull()
    })

    it('returns null when the manager yields null', async () => {
      getRoomSummaryMock.mockResolvedValue(null)
      const result = await synapseRoomSummaryService.getRoomSummary('!r3:hs')
      expect(result).toBeNull()
    })

    it('rethrows when the manager fails and throwOnError is true', async () => {
      getRoomSummaryMock.mockRejectedValue(new Error('boom'))
      await expect(synapseRoomSummaryService.getRoomSummary('!r:hs')).rejects.toThrow('boom')
    })

    it('returns null when the manager fails and throwOnError is false', async () => {
      getRoomSummaryMock.mockRejectedValue(new Error('boom'))
      const result = await synapseRoomSummaryService.getRoomSummary('!r:hs', false)
      expect(result).toBeNull()
    })

    it('no longer touches the raw transport (路径构造交还 SDK)', async () => {
      getRoomSummaryMock.mockResolvedValue({ room_id: '!r:hs', heroes: [] })
      await synapseRoomSummaryService.getRoomSummary('!r:hs')
      expect(fetchMock).not.toHaveBeenCalled()
      expect(endpointCheckMock).not.toHaveBeenCalled()
    })
  })

  describe('getRoomEphemeral（SDK 未封装的 synapse-rust 扩展端点）', () => {
    it('returns [] when the endpoint is unavailable', async () => {
      endpointCheckMock.mockResolvedValue(false)
      const result = await synapseRoomSummaryService.getRoomEphemeral('!r:hs')
      expect(result).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns the chunk on success', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ chunk: [{ type: 'm.typing' }] }) })
      )
      const result = await synapseRoomSummaryService.getRoomEphemeral('!r:hs')
      expect(result).toEqual([{ type: 'm.typing' }])
    })

    it('returns the chunk from wrapped { data } response', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: { chunk: [{ type: 'm.receipt' }] } }) })
      )
      const result = await synapseRoomSummaryService.getRoomEphemeral('!r:hs')
      expect(result).toEqual([{ type: 'm.receipt' }])
    })

    it('returns [] when the response has no chunk', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      const result = await synapseRoomSummaryService.getRoomEphemeral('!r:hs')
      expect(result).toEqual([])
    })

    it('encodes types into the query string when provided', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await synapseRoomSummaryService.getRoomEphemeral('!r:hs', ['m.typing', 'm.receipt'])
      const [url] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('/ephemeral?types=m.typing,m.receipt')
    })

    it('returns [] when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      const result = await synapseRoomSummaryService.getRoomEphemeral('!r:hs')
      expect(result).toEqual([])
    })
  })
})
