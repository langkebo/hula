import { beforeEach, describe, expect, it, vi } from 'vitest'
import endpointCapabilityService from '../../EndpointCapabilityService'
import { matrixCapabilityService } from '../../MatrixCapabilityService'
import { matrixClientService } from '../../MatrixClientService'
import { getRuntimeAwareFetch } from '../../network/runtimeFetch'
import { synapseFriendExtensionService } from '../SynapseFriendExtensionService'

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

vi.mock('../../MatrixCapabilityService', () => ({
  matrixCapabilityService: {
    canUseFriendList: vi.fn()
  }
}))

vi.mock('../../paths', () => ({
  PREFIX_V3: '/_matrix/client/v3',
  MATRIX_PATHS: {
    FRIENDS: {
      LIST: '/friends/list',
      REQUEST: '/friends/request',
      SEARCH: '/friends/search',
      INCOMING_REQUESTS: '/friends/incoming',
      OUTGOING_REQUESTS: '/friends/outgoing',
      ACCEPT: (userId: string) => `/friends/accept/${userId}`,
      REJECT: (userId: string) => `/friends/reject/${userId}`,
      CANCEL: (userId: string) => `/friends/cancel/${userId}`,
      REMOVE: (userId: string) => `/friends/remove/${userId}`,
      NOTE: (userId: string) => `/friends/note/${userId}`,
      CHECK: (userId: string) => `/friends/check/${userId}`
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

const alice = { user_id: '@alice:hs', username: 'alice', since: 1 }
const bob = { user_id: '@bob:hs', display_name: 'Bob', since: 2 }

describe('SynapseFriendExtensionService', () => {
  const getHomeserverUrl = matrixClientService.getHomeserverUrl as ReturnType<typeof vi.fn>
  const getAccessToken = matrixClientService.getAccessToken as ReturnType<typeof vi.fn>
  const getRuntimeAwareFetchMock = getRuntimeAwareFetch as ReturnType<typeof vi.fn>
  const endpointCheckMock = endpointCapabilityService.check as ReturnType<typeof vi.fn>
  const canUseFriendListMock = matrixCapabilityService.canUseFriendList as ReturnType<typeof vi.fn>
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    getHomeserverUrl.mockReset()
    getAccessToken.mockReset()
    getRuntimeAwareFetchMock.mockReset()
    endpointCheckMock.mockReset()
    canUseFriendListMock.mockReset()
    fetchMock = vi.fn()
    getRuntimeAwareFetchMock.mockReturnValue(fetchMock)
    getHomeserverUrl.mockReturnValue('https://hs.example.com')
    getAccessToken.mockReturnValue('tok')
    // 默认声明式能力检测可用，友端点可用
    canUseFriendListMock.mockReturnValue(true)
    synapseFriendExtensionService.clear()
  })

  const makeUnavailable = (): void => {
    canUseFriendListMock.mockReturnValue(false)
    endpointCheckMock.mockResolvedValue(false)
  }

  describe('getFriends', () => {
    it('returns [] when endpoint is unavailable', async () => {
      makeUnavailable()
      const result = await synapseFriendExtensionService.getFriends()
      expect(result).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns normalized friends from the friends field', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ friends: [alice, bob] }) })
      )
      const result = await synapseFriendExtensionService.getFriends()
      expect(result).toHaveLength(2)
      expect(result[0].display_name).toBe('alice') // username → display_name fallback
      expect(result[1].display_name).toBe('Bob')
    })

    it('falls back to the items field', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ items: [bob] }) }))
      const result = await synapseFriendExtensionService.getFriends()
      expect(result).toEqual([expect.objectContaining({ user_id: '@bob:hs', display_name: 'Bob' })])
    })

    it('falls back to the data field', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: [alice] }) }))
      const result = await synapseFriendExtensionService.getFriends()
      expect(result).toEqual([expect.objectContaining({ user_id: '@alice:hs' })])
    })

    it('dedupes friends by user_id', async () => {
      const dup = { ...bob }
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ friends: [bob, dup, alice] }) })
      )
      const result = await synapseFriendExtensionService.getFriends()
      expect(result).toEqual([
        expect.objectContaining({ user_id: '@bob:hs' }),
        expect.objectContaining({ user_id: '@alice:hs' })
      ])
    })

    it('returns [] when the response has no array field', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      const result = await synapseFriendExtensionService.getFriends()
      expect(result).toEqual([])
    })

    it('returns the raw array when response is a plain array', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify([alice]) }))
      const result = await synapseFriendExtensionService.getFriends()
      expect(result).toEqual([alice])
    })

    it('returns [] when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      const result = await synapseFriendExtensionService.getFriends()
      expect(result).toEqual([])
    })

    it('returns [] when Matrix client is not ready', async () => {
      fetchMock.mockRejectedValue(new Error('MatrixClient 未在指定时间内就绪'))
      const result = await synapseFriendExtensionService.getFriends()
      expect(result).toEqual([])
    })

    it('returns [] when client is not initialized', async () => {
      fetchMock.mockRejectedValue(new Error('客户端未初始化'))
      const result = await synapseFriendExtensionService.getFriends()
      expect(result).toEqual([])
    })
  })

  describe('sendFriendRequest', () => {
    it('returns unavailable result when endpoint is unavailable', async () => {
      makeUnavailable()
      const result = await synapseFriendExtensionService.sendFriendRequest('@bob:hs')
      expect(result).toEqual({ request_id: 0, status: 'unavailable' })
    })

    it('returns data from wrapped { data } response', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({ data: { request_id: 7, status: 'pending' } })
        })
      )
      const result = await synapseFriendExtensionService.sendFriendRequest('@bob:hs', 'hi')
      expect(result).toEqual({ request_id: 7, status: 'pending' })
    })

    it('returns direct fields when no data wrapper', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ request_id: 9 }) }))
      const result = await synapseFriendExtensionService.sendFriendRequest('@bob:hs')
      expect(result).toEqual({ request_id: 9, status: 'pending' })
    })

    it('returns error result when no usable data', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      const result = await synapseFriendExtensionService.sendFriendRequest('@bob:hs')
      expect(result).toEqual({ request_id: 0, status: 'error' })
    })

    it('rethrows when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      await expect(synapseFriendExtensionService.sendFriendRequest('@bob:hs')).rejects.toThrow('boom')
    })
  })

  describe('searchFriends', () => {
    it('returns [] for an empty query', async () => {
      expect(await synapseFriendExtensionService.searchFriends('')).toEqual([])
      expect(await synapseFriendExtensionService.searchFriends('   ')).toEqual([])
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('returns [] when endpoint is unavailable', async () => {
      makeUnavailable()
      const result = await synapseFriendExtensionService.searchFriends('alice')
      expect(result).toEqual([])
    })

    it('builds default query params and returns results', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ results: [{ user_id: '@alice:hs' }] }) })
      )
      const result = await synapseFriendExtensionService.searchFriends('  alice  ')
      expect(result).toEqual([{ user_id: '@alice:hs' }])
      const [url] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('q=alice')
      expect(String(url)).toContain('limit=20')
      expect(String(url)).toContain('mode=fuzzy')
    })

    it('respects custom limit and mode', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await synapseFriendExtensionService.searchFriends('alice', { limit: 5, mode: 'exact' })
      const [url] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('limit=5')
      expect(String(url)).toContain('mode=exact')
    })

    it('returns results from the data field', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: [{ user_id: '@bob:hs' }] }) })
      )
      const result = await synapseFriendExtensionService.searchFriends('bob')
      expect(result).toEqual([{ user_id: '@bob:hs' }])
    })

    it('returns a plain array when the response is an array', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify([{ user_id: '@c:hs' }]) })
      )
      const result = await synapseFriendExtensionService.searchFriends('c')
      expect(result).toEqual([{ user_id: '@c:hs' }])
    })

    it('returns [] when the response has no array field', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      const result = await synapseFriendExtensionService.searchFriends('alice')
      expect(result).toEqual([])
    })

    it('returns [] when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      const result = await synapseFriendExtensionService.searchFriends('alice')
      expect(result).toEqual([])
    })
  })

  describe('getPendingRequests', () => {
    it('returns empty requests when endpoint is unavailable', async () => {
      makeUnavailable()
      const result = await synapseFriendExtensionService.getPendingRequests()
      expect(result).toEqual({ incoming: [], outgoing: [] })
    })

    it('extracts incoming and outgoing from the requests field', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({
            requests: [{ request_id: 1, requester: '@a:hs', recipient: '@me:hs', status: 'pending', created_ts: 1 }]
          })
        })
      )
      const result = await synapseFriendExtensionService.getPendingRequests()
      expect(result.incoming).toHaveLength(1)
      expect(result.outgoing).toHaveLength(1)
    })

    it('handles one fulfilled and one rejected via allSettled', async () => {
      const incomingReq = { request_id: 1, requester: '@a:hs', recipient: '@me:hs', status: 'pending', created_ts: 1 }
      // 基于 URL 分发：incoming 成功，outgoing 失败
      fetchMock.mockImplementation((url: string) => {
        if (String(url).includes('/friends/outgoing')) return Promise.resolve(makeResponse({ ok: false, status: 500 }))
        return Promise.resolve(
          makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ requests: [incomingReq] }) })
        )
      })
      const result = await synapseFriendExtensionService.getPendingRequests()
      expect(result.incoming).toHaveLength(1)
      expect(result.outgoing).toEqual([])
    })

    it('returns [] entries when responses carry no array', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      const result = await synapseFriendExtensionService.getPendingRequests()
      expect(result).toEqual({ incoming: [], outgoing: [] })
    })
  })

  describe('acceptFriendRequest', () => {
    it('returns unavailable result when endpoint is unavailable', async () => {
      makeUnavailable()
      const result = await synapseFriendExtensionService.acceptFriendRequest('@bob:hs')
      expect(result).toEqual({ status: 'unavailable', room_id: '' })
    })

    it('returns data from wrapped { data } response', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: { status: 'ok', room_id: '!r:hs' } }) })
      )
      const result = await synapseFriendExtensionService.acceptFriendRequest('@bob:hs')
      expect(result).toEqual({ status: 'ok', room_id: '!r:hs' })
    })

    it('returns direct fields when no data wrapper', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ status: 'ok', room_id: '!r2:hs' }) })
      )
      const result = await synapseFriendExtensionService.acceptFriendRequest('@bob:hs')
      expect(result).toEqual({ status: 'ok', room_id: '!r2:hs' })
    })

    it('returns error result when no usable data', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      const result = await synapseFriendExtensionService.acceptFriendRequest('@bob:hs')
      expect(result).toEqual({ status: 'error', room_id: '' })
    })

    it('rethrows when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      await expect(synapseFriendExtensionService.acceptFriendRequest('@bob:hs')).rejects.toThrow('boom')
    })
  })

  describe('declineFriendRequest', () => {
    it('resolves early when endpoint is unavailable', async () => {
      makeUnavailable()
      await expect(synapseFriendExtensionService.declineFriendRequest('@bob:hs')).resolves.toBeUndefined()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('sends a POST and resolves on success', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await expect(synapseFriendExtensionService.declineFriendRequest('@bob:hs')).resolves.toBeUndefined()
      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('/friends/reject/%40bob%3Ahs')
      expect(init.method).toBe('POST')
    })

    it('rethrows when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      await expect(synapseFriendExtensionService.declineFriendRequest('@bob:hs')).rejects.toThrow('boom')
    })
  })

  describe('cancelFriendRequest', () => {
    it('resolves early when endpoint is unavailable', async () => {
      makeUnavailable()
      await expect(synapseFriendExtensionService.cancelFriendRequest('@bob:hs')).resolves.toBeUndefined()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('sends a POST and resolves on success', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await expect(synapseFriendExtensionService.cancelFriendRequest('@bob:hs')).resolves.toBeUndefined()
      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('/friends/cancel/%40bob%3Ahs')
      expect(init.method).toBe('POST')
    })

    it('rethrows when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      await expect(synapseFriendExtensionService.cancelFriendRequest('@bob:hs')).rejects.toThrow('boom')
    })
  })

  describe('removeFriend', () => {
    it('resolves early when endpoint is unavailable', async () => {
      makeUnavailable()
      await expect(synapseFriendExtensionService.removeFriend('@bob:hs')).resolves.toBeUndefined()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('sends a DELETE and resolves on success', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await expect(synapseFriendExtensionService.removeFriend('@bob:hs')).resolves.toBeUndefined()
      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('/friends/remove/%40bob%3Ahs')
      expect(init.method).toBe('DELETE')
    })

    it('rethrows when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      await expect(synapseFriendExtensionService.removeFriend('@bob:hs')).rejects.toThrow('boom')
    })
  })

  describe('setFriendNote', () => {
    it('resolves early when endpoint is unavailable', async () => {
      makeUnavailable()
      await expect(synapseFriendExtensionService.setFriendNote('@bob:hs', 'n')).resolves.toBeUndefined()
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('sends a PUT with the note and resolves on success', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      await expect(synapseFriendExtensionService.setFriendNote('@bob:hs', 'my note')).resolves.toBeUndefined()
      const [url, init] = fetchMock.mock.calls[0]
      expect(String(url)).toContain('/friends/note/%40bob%3Ahs')
      expect(init.method).toBe('PUT')
      expect(JSON.parse(init.body)).toEqual({ note: 'my note' })
    })

    it('rethrows when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))
      await expect(synapseFriendExtensionService.setFriendNote('@bob:hs', 'n')).rejects.toThrow('boom')
    })
  })

  describe('checkFriendship', () => {
    it('returns false when endpoint is unavailable', async () => {
      makeUnavailable()
      const result = await synapseFriendExtensionService.checkFriendship('@bob:hs')
      expect(result).toBe(false)
    })

    it('returns true when are_friends is true', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ are_friends: true }) })
      )
      const result = await synapseFriendExtensionService.checkFriendship('@bob:hs')
      expect(result).toBe(true)
    })

    it('returns false when are_friends is false', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ data: { are_friends: false } }) })
      )
      const result = await synapseFriendExtensionService.checkFriendship('@bob:hs')
      expect(result).toBe(false)
    })

    it('returns false when the request fails', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      const result = await synapseFriendExtensionService.checkFriendship('@bob:hs')
      expect(result).toBe(false)
    })
  })
})
