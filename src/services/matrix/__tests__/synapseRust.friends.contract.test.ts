/**
 * SynapseFriendExtensionService contract tests — MSW intercepts at the
 * HTTP boundary.
 *
 * Unlike the thirdparty methods (which use SDK `client.http.authedRequest`),
 * the friends methods use the service's own `this.request()` which calls
 * `getRuntimeAwareFetch()` → `globalThis.fetch`. So we DO NOT mock
 * getRuntimeAwareFetch — MSW intercepts the real fetch call.
 *
 * URL construction is `${this.baseUrl}${endpoint}` (plain string concat,
 * no SDK prefix stacking). The contract value here is verifying:
 *   - Full URL correctness (path, query string, encoded path params)
 *   - HTTP method correctness (GET/POST/PUT/DELETE)
 *   - Request body shape (JSON payloads)
 *   - Response parsing (bare vs `{data: ...}` wrapped payloads)
 *
 * All friends endpoints use PREFIX_VENDOR_V1 (/_matrix/vendor/v1) via MATRIX_PATHS.FRIENDS.
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { synapseDmExtensionService } from '../extensions/SynapseDmExtensionService'
import { synapseFriendExtensionService } from '../extensions/SynapseFriendExtensionService'
import { matrixClientService } from '../MatrixClientService'

const HOMESERVER = 'https://hs.synapserust-friends-contract.test'
const ACCESS_TOKEN = 'friends-contract-at'
const seenUrls: { method: string; url: string; body?: string }[] = []

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('../MatrixCapabilityService', () => ({
  matrixCapabilityService: { canUseFriendList: vi.fn(() => true) }
}))

vi.mock('../EndpointCapabilityService', () => ({
  default: { check: vi.fn(() => Promise.resolve(true)), clear: vi.fn() }
}))

// Catch-all handlers for all friends endpoints. Tests can override with
// server.use() for error/edge cases.
const server = setupMswServer(
  http.get(`${HOMESERVER}/_matrix/vendor/v1/friends`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({
      data: [{ user_id: '@alice:hs', display_name: 'Alice', since: 1 }]
    })
  }),
  http.get(`${HOMESERVER}/_matrix/vendor/v1/friends/search`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({
      results: [{ user_id: '@bob:hs', username: 'bob', match_type: 'fuzzy' }]
    })
  }),
  http.post(`${HOMESERVER}/_matrix/vendor/v1/friends/request`, async ({ request }) => {
    const body = await request.text()
    seenUrls.push({ method: request.method, url: request.url, body })
    return HttpResponse.json({ data: { request_id: 42, status: 'pending' } })
  }),
  http.get(`${HOMESERVER}/_matrix/vendor/v1/friends/requests/incoming`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({
      requests: [{ request_id: 1, requester: '@x:hs', recipient: '@me:hs', status: 'pending', created_ts: 1 }]
    })
  }),
  http.get(`${HOMESERVER}/_matrix/vendor/v1/friends/requests/outgoing`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ requests: [] })
  }),
  http.post(`${HOMESERVER}/_matrix/vendor/v1/friends/request/:userId/accept`, async ({ request }) => {
    const body = await request.text()
    seenUrls.push({ method: request.method, url: request.url, body })
    return HttpResponse.json({ data: { status: 'accepted', room_id: '!dm:hs' } })
  }),
  http.post(`${HOMESERVER}/_matrix/vendor/v1/friends/request/:userId/reject`, async ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ status: 'ok' })
  }),
  http.post(`${HOMESERVER}/_matrix/vendor/v1/friends/request/:userId/cancel`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ status: 'ok' })
  }),
  http.delete(`${HOMESERVER}/_matrix/vendor/v1/friends/:userId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ status: 'ok' })
  }),
  http.put(`${HOMESERVER}/_matrix/vendor/v1/friends/:userId/note`, async ({ request }) => {
    const body = await request.text()
    seenUrls.push({ method: request.method, url: request.url, body })
    return HttpResponse.json({ status: 'ok' })
  }),
  http.get(`${HOMESERVER}/_matrix/vendor/v1/friends/check/:userId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ data: { are_friends: true } })
  }),
  http.post(`${HOMESERVER}/_matrix/vendor/v1/friends/dm/:userId`, async ({ request }) => {
    const body = await request.text()
    seenUrls.push({ method: request.method, url: request.url, body })
    return HttpResponse.json({ data: { room_id: '!dm:hs', created: true } })
  }),
  http.get(`${HOMESERVER}/_matrix/vendor/v1/friends/dm/:userId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ data: { room_id: '!dm:hs', exists: true } })
  })
)

describe('SynapseFriendExtensionService friends URL construction contract (real fetch + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    vi.spyOn(matrixClientService, 'getHomeserverUrl').mockReturnValue(HOMESERVER)
    vi.spyOn(matrixClientService, 'getAccessToken').mockReturnValue(ACCESS_TOKEN)
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null as unknown as MatrixClient)
    vi.spyOn(matrixClientService, 'waitForClientReady').mockResolvedValue(null as unknown as MatrixClient)
    // Reset the singletons' cached state so each test starts clean.
    synapseFriendExtensionService.clear()
    synapseDmExtensionService.clear()
    // clear() sets baseUrl/accessToken to '' — re-seed via ensureInitialized
    // by pre-setting them (matches what ensureInitialized would do).
    for (const svc of [synapseFriendExtensionService, synapseDmExtensionService]) {
      ;(svc as unknown as { baseUrl: string }).baseUrl = HOMESERVER
      ;(svc as unknown as { accessToken: string }).accessToken = ACCESS_TOKEN
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    server.resetHandlers()
  })

  const filterBy = (substring: string) => seenUrls.filter((u) => u.url.includes(substring))

  it('getFriends hits GET /_matrix/vendor/v1/friends and unwraps {data: [...]}', async () => {
    const result = await synapseFriendExtensionService.getFriends()
    const calls = filterBy('/friends')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/friends`)
    expect(result).toHaveLength(1)
    expect(result[0].user_id).toBe('@alice:hs')
    expect(result[0].display_name).toBe('Alice')
  })

  it('getFriends accepts bare array payload (no {data: ...} wrapper)', async () => {
    server.use(
      http.get(`${HOMESERVER}/_matrix/vendor/v1/friends`, ({ request }) => {
        seenUrls.push({ method: request.method, url: request.url })
        return HttpResponse.json([{ user_id: '@bare:hs', since: 2 }])
      })
    )
    const result = await synapseFriendExtensionService.getFriends()
    expect(result).toHaveLength(1)
    expect(result[0].user_id).toBe('@bare:hs')
  })

  it('getFriends returns [] on HTTP error', async () => {
    server.use(
      http.get(`${HOMESERVER}/_matrix/vendor/v1/friends`, ({ request }) => {
        seenUrls.push({ method: request.method, url: request.url })
        return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
      })
    )
    const result = await synapseFriendExtensionService.getFriends()
    expect(result).toEqual([])
  })

  it('searchFriends builds GET /_matrix/vendor/v1/friends/search?q=...&limit=...&mode=...', async () => {
    const result = await synapseFriendExtensionService.searchFriends('ljf', { limit: 10, mode: 'exact' })
    const calls = filterBy('/friends/search')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/friends/search?q=ljf&limit=10&mode=exact`)
    expect(result).toHaveLength(1)
    expect(result[0].user_id).toBe('@bob:hs')
  })

  it('sendFriendRequest POSTs /_matrix/vendor/v1/friends/request with {user_id, message}', async () => {
    const result = await synapseFriendExtensionService.sendFriendRequest('@target:hs', 'hi')
    const calls = filterBy('/friends/request')
    const postCall = calls.find((c) => c.method === 'POST' && c.url.endsWith('/friends/request'))
    expect(postCall).toBeDefined()
    expect(JSON.parse(postCall!.body!)).toEqual({ user_id: '@target:hs', message: 'hi' })
    expect(result.request_id).toBe(42)
    expect(result.status).toBe('pending')
  })

  it('getPendingRequests hits both incoming and outgoing endpoints in parallel', async () => {
    const result = await synapseFriendExtensionService.getPendingRequests()
    const incoming = filterBy('/friends/requests/incoming')
    const outgoing = filterBy('/friends/requests/outgoing')
    expect(incoming).toHaveLength(1)
    expect(outgoing).toHaveLength(1)
    expect(incoming[0].method).toBe('GET')
    expect(outgoing[0].method).toBe('GET')
    expect(result.incoming).toHaveLength(1)
    expect(result.incoming[0].requester).toBe('@x:hs')
    expect(result.outgoing).toHaveLength(0)
  })

  it('acceptFriendRequest POSTs /_matrix/vendor/v1/friends/request/{userId}/accept (URL-encoded)', async () => {
    const result = await synapseFriendExtensionService.acceptFriendRequest('@user:hs')
    const calls = filterBy('/accept')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/friends/request/%40user%3Ahs/accept`)
    expect(result.status).toBe('accepted')
    expect(result.room_id).toBe('!dm:hs')
  })

  it('declineFriendRequest POSTs /_matrix/vendor/v1/friends/request/{userId}/reject', async () => {
    await synapseFriendExtensionService.declineFriendRequest('@user:hs')
    const calls = filterBy('/reject')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/friends/request/%40user%3Ahs/reject`)
  })

  it('cancelFriendRequest POSTs /_matrix/vendor/v1/friends/request/{userId}/cancel', async () => {
    await synapseFriendExtensionService.cancelFriendRequest('@user:hs')
    const calls = filterBy('/cancel')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/friends/request/%40user%3Ahs/cancel`)
  })

  it('removeFriend DELETEs /_matrix/vendor/v1/friends/{userId}', async () => {
    await synapseFriendExtensionService.removeFriend('@friend:hs')
    const calls = filterBy('/friends/')
    const deleteCall = calls.find((c) => c.method === 'DELETE')
    expect(deleteCall).toBeDefined()
    expect(deleteCall!.url).toBe(`${HOMESERVER}/_matrix/vendor/v1/friends/%40friend%3Ahs`)
  })

  it('setFriendNote PUTs /_matrix/vendor/v1/friends/{userId}/note with {note}', async () => {
    await synapseFriendExtensionService.setFriendNote('@friend:hs', 'bestie')
    const calls = filterBy('/note')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/friends/%40friend%3Ahs/note`)
    expect(JSON.parse(calls[0].body!)).toEqual({ note: 'bestie' })
  })

  it('checkFriendship hits GET /_matrix/vendor/v1/friends/check/{userId} and unwraps {data: {are_friends}}', async () => {
    const result = await synapseFriendExtensionService.checkFriendship('@friend:hs')
    const calls = filterBy('/friends/check/')
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/friends/check/%40friend%3Ahs`)
    expect(result).toBe(true)
  })

  it('createPrivateDm POSTs /_matrix/vendor/v1/friends/dm/{userId} with {is_private}', async () => {
    const result = await synapseDmExtensionService.createPrivateDm('@target:hs', true)
    const calls = filterBy('/friends/dm/')
    const postCall = calls.find((c) => c.method === 'POST')
    expect(postCall).toBeDefined()
    expect(postCall!.url).toBe(`${HOMESERVER}/_matrix/vendor/v1/friends/dm/%40target%3Ahs`)
    expect(JSON.parse(postCall!.body!)).toEqual({ is_private: true })
    expect(result.room_id).toBe('!dm:hs')
    expect(result.created).toBe(true)
  })

  it('getDmRoom hits GET /_matrix/vendor/v1/friends/dm/{userId}', async () => {
    const result = await synapseDmExtensionService.getDmRoom('@target:hs')
    const calls = filterBy('/friends/dm/')
    const getCall = calls.find((c) => c.method === 'GET')
    expect(getCall).toBeDefined()
    expect(getCall!.url).toBe(`${HOMESERVER}/_matrix/vendor/v1/friends/dm/%40target%3Ahs`)
    expect(result.room_id).toBe('!dm:hs')
    expect(result.exists).toBe(true)
  })
})
