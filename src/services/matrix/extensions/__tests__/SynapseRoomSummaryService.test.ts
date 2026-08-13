import { beforeEach, describe, expect, it, vi } from 'vitest'
import endpointCapabilityService from '../../EndpointCapabilityService'
import { matrixClientService } from '../../MatrixClientService'
import { getRuntimeAwareFetch } from '../../network/runtimeFetch'
import { synapseRoomSummaryService } from '../SynapseRoomSummaryService'

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

const member = (user_id: string, is_hero = false) => ({ user_id, membership: 'join', is_hero })

describe('SynapseRoomSummaryService', () => {
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
    endpointCheckMock.mockResolvedValue(true)
    fetchMock = vi.fn()
    getRuntimeAwareFetchMock.mockReturnValue(fetchMock)
    getHomeserverUrl.mockReturnValue('https://hs.example.com')
    getAccessToken.mockReturnValue('tok')
    synapseRoomSummaryService.clear()
  })

  describe('getRoomSummary', () => {
    it('returns null when the endpoint is unavailable', async () => {
      endpointCheckMock.mockResolvedValue(false)
      const result = await synapseRoomSummaryService.getRoomSummary('!r:hs')
      expect(result).toBeNull()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns data on success', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ room_id: '!r1:hs', name: 'Room' }) })
      )
      const result = await synapseRoomSummaryService.getRoomSummary('!r1:hs')
      expect(result).toEqual({ room_id: '!r1:hs', name: 'Room' })
    })

    it('returns unwrapped data from wrapped { data } response', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: { room_id: '!r2:hs' } }) })
      )
      const result = await synapseRoomSummaryService.getRoomSummary('!r2:hs')
      expect(result).toEqual({ room_id: '!r2:hs' })
    })

    it('returns null when the response carries null data', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: null }) }))
      const result = await synapseRoomSummaryService.getRoomSummary('!r3:hs')
      expect(result).toBeNull()
    })

    it('rethrows when the request fails and throwOnError is true', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      await expect(synapseRoomSummaryService.getRoomSummary('!r:hs')).rejects.toThrow('boom')
    })

    it('returns null when the request fails and throwOnError is false', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      const result = await synapseRoomSummaryService.getRoomSummary('!r:hs', false)
      expect(result).toBeNull()
    })
  })

  describe('getRoomSummaryMembers', () => {
    it('returns members on success (plain array)', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify([member('@a:hs'), member('@b:hs', true)])
        })
      )
      const result = await synapseRoomSummaryService.getRoomSummaryMembers('!r:hs')
      expect(result).toHaveLength(2)
    })

    it('returns unwrapped members from wrapped { data } response', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({ data: [member('@a:hs')] })
        })
      )
      const result = await synapseRoomSummaryService.getRoomSummaryMembers('!r:hs')
      expect(result).toHaveLength(1)
      expect(result[0].user_id).toBe('@a:hs')
    })

    it('returns [] when the response carries null data', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: null }) }))
      const result = await synapseRoomSummaryService.getRoomSummaryMembers('!r:hs')
      expect(result).toEqual([])
    })

    it('rethrows when the request fails and throwOnError is true', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      await expect(synapseRoomSummaryService.getRoomSummaryMembers('!r:hs')).rejects.toThrow('down')
    })

    it('returns [] when the request fails and throwOnError is false', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      const result = await synapseRoomSummaryService.getRoomSummaryMembers('!r:hs', false)
      expect(result).toEqual([])
    })
  })

  describe('getRoomSummaryHeroes', () => {
    it('returns only hero members', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify([member('@a:hs'), member('@b:hs', true), member('@c:hs', true)])
        })
      )
      const result = await synapseRoomSummaryService.getRoomSummaryHeroes('!r:hs')
      expect(result.map((m) => m.user_id)).toEqual(['@b:hs', '@c:hs'])
    })

    it('returns [] when there are no heroes', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify([member('@a:hs')]) }))
      const result = await synapseRoomSummaryService.getRoomSummaryHeroes('!r:hs')
      expect(result).toEqual([])
    })
  })

  describe('getRoomSummaryState', () => {
    it('returns state on success', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify([{ event_type: 'm.room.name', state_key: '', event_id: '$e', content: {} }])
        })
      )
      const result = await synapseRoomSummaryService.getRoomSummaryState('!r:hs')
      expect(result).toHaveLength(1)
      expect(result[0].event_type).toBe('m.room.name')
    })

    it('returns [] when the response carries null data', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: null }) }))
      const result = await synapseRoomSummaryService.getRoomSummaryState('!r:hs')
      expect(result).toEqual([])
    })

    it('returns [] when the request fails and throwOnError is false', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      const result = await synapseRoomSummaryService.getRoomSummaryState('!r:hs', false)
      expect(result).toEqual([])
    })
  })

  describe('getRoomSummaryStats', () => {
    it('returns stats on success', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({
            room_id: '!r:hs',
            total_events: 5,
            total_messages: 3,
            total_media: 1,
            storage_size: 100
          })
        })
      )
      const result = await synapseRoomSummaryService.getRoomSummaryStats('!r:hs')
      expect(result).toMatchObject({ room_id: '!r:hs', total_events: 5 })
    })

    it('returns unwrapped stats from wrapped { data } response', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({
            data: { room_id: '!r:hs', total_events: 2, total_messages: 1, total_media: 0, storage_size: 10 }
          })
        })
      )
      const result = await synapseRoomSummaryService.getRoomSummaryStats('!r:hs')
      expect(result).toMatchObject({ room_id: '!r:hs', total_events: 2 })
    })

    it('returns null when the response carries null data', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: null }) }))
      const result = await synapseRoomSummaryService.getRoomSummaryStats('!r:hs')
      expect(result).toBeNull()
    })

    it('returns null when the request fails and throwOnError is false', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      const result = await synapseRoomSummaryService.getRoomSummaryStats('!r:hs', false)
      expect(result).toBeNull()
    })
  })

  describe('getRoomEphemeral', () => {
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
