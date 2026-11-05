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

    it('accepts a plain array response and still normalizes display name', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: JSON.stringify([alice]) }))
      const result = await synapseFriendExtensionService.getFriends()
      // 旧实现对数组分支直接 return，跳过了 display_name 归一（与对象分支不一致）
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ user_id: '@alice:hs', display_name: 'alice' })
    })

    it('requests the max page size and follows next_batch', async () => {
      // 后端默认 limit=50，不传会静默截断；这里锁住「带 limit 且跟随游标」
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({ friends: [alice], next_batch: 'c1' })
        })
      )
      const bob = { user_id: '@bob:hs', since: 1 }
      fetchMock.mockResolvedValueOnce(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ friends: [bob], next_batch: null }) })
      )
      const result = await synapseFriendExtensionService.getFriends()

      expect(result.map((f) => f.user_id)).toEqual(['@alice:hs', '@bob:hs'])
      const firstUrl = String(fetchMock.mock.calls[0][0])
      expect(firstUrl).toContain('limit=200')
      const secondUrl = String(fetchMock.mock.calls[1][0])
      expect(secondUrl).toContain('from=c1')
    })

    it('rethrows when the request fails（否则「空」与「失败」不可区分）', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      await expect(synapseFriendExtensionService.getFriends()).rejects.toThrow('down')
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

  /**
   * F-6：单页读取。`getFriends()` 内部改由它驱动，两者必须共用同一套失败语义
   * （真实失败抛出、「客户端未就绪」返回空页），否则首屏分页会把失败渲染成「没有好友」。
   */
  describe('getFriendsPage', () => {
    it('透传 nextBatch，并带 limit=200', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({ friends: [alice], next_batch: 'c2' })
        })
      )

      const result = await synapseFriendExtensionService.getFriendsPage()

      expect(result.friends.map((f) => f.user_id)).toEqual(['@alice:hs'])
      expect(result.nextBatch).toBe('c2')
      expect(String(fetchMock.mock.calls[0][0])).toContain('limit=200')
      expect(String(fetchMock.mock.calls[0][0])).not.toContain('from=')
    })

    it('带 from 时把游标拼进查询串', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ friends: [] }) })
      )

      await synapseFriendExtensionService.getFriendsPage('c2')

      expect(String(fetchMock.mock.calls[0][0])).toContain('from=c2')
    })

    it('游标原地打转（next_batch === from）→ 归一为 null，避免死循环', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ friends: [alice], next_batch: 'c2' }) })
      )

      const result = await synapseFriendExtensionService.getFriendsPage('c2')

      expect(result.nextBatch).toBeNull()
    })

    it('真实失败抛出（不能吞成空页）', async () => {
      fetchMock.mockRejectedValue(new Error('HTTP 503'))
      await expect(synapseFriendExtensionService.getFriendsPage()).rejects.toThrow('503')
    })

    it('客户端未就绪 → 空页 + nextBatch=null（启动期临时态）', async () => {
      fetchMock.mockRejectedValue(new Error('客户端未初始化'))
      const result = await synapseFriendExtensionService.getFriendsPage()
      expect(result).toEqual({ friends: [], nextBatch: null })
    })

    it('端点不可用 → 空页（能力缺失 ≠ 读取失败）', async () => {
      makeUnavailable()
      const result = await synapseFriendExtensionService.getFriendsPage()
      expect(result).toEqual({ friends: [], nextBatch: null })
    })
  })

  describe('sendFriendRequest', () => {
    it('returns unavailable result when endpoint is unavailable', async () => {
      makeUnavailable()
      const result = await synapseFriendExtensionService.sendFriendRequest('@bob:hs')
      expect(result).toEqual({ request_id: '', status: 'unavailable' })
    })

    it('returns data from wrapped { data } response', async () => {
      fetchMock.mockResolvedValue(
        makeResponse({
          ok: true,
          status: 200,
          textResp: JSON.stringify({ data: { request_id: '7', status: 'pending' } })
        })
      )
      const result = await synapseFriendExtensionService.sendFriendRequest('@bob:hs', 'hi')
      // 后端 request_id 是字符串（实测 "82"），统一按字符串返回
      expect(result).toEqual({ request_id: '7', status: 'pending' })
    })

    it('returns direct fields when no data wrapper', async () => {
      // 真实响应示例：{"request_id":"82","status":"pending"}
      fetchMock.mockResolvedValue(
        makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ request_id: '82', status: 'pending' }) })
      )
      const result = await synapseFriendExtensionService.sendFriendRequest('@bob:hs')
      expect(result).toEqual({ request_id: '82', status: 'pending' })
    })

    it('returns error result when no usable data', async () => {
      fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, textResp: '{}' }))
      const result = await synapseFriendExtensionService.sendFriendRequest('@bob:hs')
      expect(result).toEqual({ request_id: '', status: 'error' })
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

    it('rethrows when the request fails（搜索失败不能显示成「没搜到人」）', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      await expect(synapseFriendExtensionService.searchFriends('alice')).rejects.toThrow('down')
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

    it('throws when one side fails（半个列表不能当完整列表返回）', async () => {
      const incomingReq = { request_id: 1, requester: '@a:hs', recipient: '@me:hs', status: 'pending', created_ts: 1 }
      // 基于 URL 分发：incoming 成功，outgoing 失败
      fetchMock.mockImplementation((url: string) => {
        if (String(url).includes('/friends/outgoing')) return Promise.resolve(makeResponse({ ok: false, status: 500 }))
        return Promise.resolve(
          makeResponse({ ok: true, status: 200, textResp: JSON.stringify({ requests: [incomingReq] }) })
        )
      })
      await expect(synapseFriendExtensionService.getPendingRequests()).rejects.toThrow()
    })

    it('returns empty lists when client is not ready（启动期临时态不算失败）', async () => {
      fetchMock.mockRejectedValue(new Error('MatrixClient 未在指定时间内就绪'))
      const result = await synapseFriendExtensionService.getPendingRequests()
      expect(result).toEqual({ incoming: [], outgoing: [] })
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

    it('rethrows when the request fails（false 会被误判成「确认不是好友」）', async () => {
      fetchMock.mockRejectedValue(new Error('down'))
      await expect(synapseFriendExtensionService.checkFriendship('@bob:hs')).rejects.toThrow('down')
    })
  })
})
