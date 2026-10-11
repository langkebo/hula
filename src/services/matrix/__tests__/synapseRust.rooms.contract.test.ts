/**
 * SynapseRust extensions (rooms) contract tests — MSW intercepts
 * at the HTTP boundary.
 *
 * Like the friends contract test, these methods use the service's own
 * `this.request()` → `getRuntimeAwareFetch()` → `globalThis.fetch`, so we
 * DO NOT mock getRuntimeAwareFetch. MSW intercepts the real fetch call.
 *
 * 前缀口径（2026-10-11，见 `scripts/bare-matrix-paths-baseline.json` 的 history）：
 * - sticky events → `/_matrix/client/unstable/org.matrix.msc4354`（后端唯一注册形态，L-D03/L-D04）；
 * - room ephemeral 仍走 `/_matrix/client/v3`（该路由确实注册在 v3）；
 * - room summary（含 members/state/stats）**已不在本文件覆盖**：该能力已收敛到 SDK
 *   `RoomSummaryManager`，其路径正确性由 SDK 侧 path-contract / wire-format 门禁保证
 *   （历史 404 见 L-D05~L-D08：曾误用 client/v3，后端无该形态）。
 * Contract value: verify URL correctness (path, encoded roomId, query string),
 * HTTP method, request body shape, and response unwrapping
 * (`{data: ...}` wrapper vs bare payload).
 *
 * Covers: invite blocklist/allowlist,
 * sticky events, ephemeral.
 * Burn-after-read endpoints are covered by MatrixBurnAfterReadService tests.
 * Captcha endpoints are covered by SDK CaptchaManager (matrix-js-sdk/lib/captcha),
 * not exposed via package.json exports — frontend has no production callers.
 */
import type { MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { synapseRoomSummaryService } from '../extensions/SynapseRoomSummaryService'
import { synapseStickyEventService } from '../extensions/SynapseStickyEventService'
import { matrixClientService } from '../MatrixClientService'

const HOMESERVER = 'https://hs.synapserust-rooms-contract.test'
const ACCESS_TOKEN = 'rooms-contract-at'
const seenUrls: { method: string; url: string; body?: string }[] = []

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('../MatrixCapabilityService', () => ({
  matrixCapabilityService: { canUseFriendList: vi.fn(() => true) }
}))

// check() must return true so getStickyEvents / getRoomSummary / getRoomEphemeral
// proceed past the capability gate to the actual fetch call.
vi.mock('../EndpointCapabilityService', () => ({
  default: { check: vi.fn(() => Promise.resolve(true)), clear: vi.fn() }
}))

const server = setupMswServer(
  http.get(`${HOMESERVER}/_matrix/client/unstable/org.matrix.msc4354/rooms/:roomId/sticky_events`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({
      data: { events: [{ event_id: '$e1:hs', event_type: 'm.room.name', content: {}, updated_ts: 1 }] }
    })
  }),
  http.post(
    `${HOMESERVER}/_matrix/client/unstable/org.matrix.msc4354/rooms/:roomId/sticky_events`,
    async ({ request }) => {
      const body = await request.text()
      seenUrls.push({ method: request.method, url: request.url, body })
      return HttpResponse.json({ status: 'ok' })
    }
  ),
  http.delete(
    `${HOMESERVER}/_matrix/client/unstable/org.matrix.msc4354/rooms/:roomId/sticky_events/:eventType`,
    ({ request }) => {
      seenUrls.push({ method: request.method, url: request.url })
      return HttpResponse.json({ status: 'ok' })
    }
  ),
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/ephemeral`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ data: { chunk: [{ type: 'm.typing', content: {} }] } })
  })
)

describe('SynapseRust extensions rooms URL construction contract (real fetch + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    vi.spyOn(matrixClientService, 'getHomeserverUrl').mockReturnValue(HOMESERVER)
    vi.spyOn(matrixClientService, 'getAccessToken').mockReturnValue(ACCESS_TOKEN)
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null as unknown as MatrixClient)
    vi.spyOn(matrixClientService, 'waitForClientReady').mockResolvedValue(null as unknown as MatrixClient)
    const services = [synapseStickyEventService, synapseRoomSummaryService]
    for (const svc of services) {
      svc.clear()
      ;(svc as unknown as { baseUrl: string }).baseUrl = HOMESERVER
      ;(svc as unknown as { accessToken: string }).accessToken = ACCESS_TOKEN
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
    server.resetHandlers()
  })

  const filterBy = (substring: string) => seenUrls.filter((u) => u.url.includes(substring))

  describe('sticky events', () => {
    it('getStickyEvents hits GET /_matrix/client/unstable/org.matrix.msc4354/rooms/{roomId}/sticky_events', async () => {
      const result = await synapseStickyEventService.getStickyEvents('!room:hs')
      const calls = filterBy('/sticky_events')
      const getCall = calls.find((c) => c.method === 'GET' && !c.url.includes('/sticky_events/'))
      expect(getCall).toBeDefined()
      expect(getCall!.url).toBe(
        `${HOMESERVER}/_matrix/client/unstable/org.matrix.msc4354/rooms/!room%3Ahs/sticky_events`
      )
      expect(result).toHaveLength(1)
      expect(result[0].event_id).toBe('$e1:hs')
    })

    it('setStickyEvent POSTs /_matrix/client/unstable/org.matrix.msc4354/rooms/{roomId}/sticky_events with {events:[{event_id,event_type}]}', async () => {
      await synapseStickyEventService.setStickyEvent('!room:hs', '$e1:hs', 'm.room.name')
      const calls = filterBy('/sticky_events')
      const postCall = calls.find((c) => c.method === 'POST')
      expect(postCall).toBeDefined()
      expect(JSON.parse(postCall!.body!)).toEqual({
        events: [{ event_id: '$e1:hs', event_type: 'm.room.name' }]
      })
    })

    it('clearStickyEvent DELETEs /_matrix/client/unstable/org.matrix.msc4354/rooms/{roomId}/sticky_events/{eventType}', async () => {
      await synapseStickyEventService.clearStickyEvent('!room:hs', 'm.room.name')
      const calls = filterBy('/sticky_events/')
      const deleteCall = calls.find((c) => c.method === 'DELETE')
      expect(deleteCall).toBeDefined()
      expect(deleteCall!.url).toBe(
        `${HOMESERVER}/_matrix/client/unstable/org.matrix.msc4354/rooms/!room%3Ahs/sticky_events/m.room.name`
      )
    })
  })

  describe('room ephemeral', () => {
    it('getRoomEphemeral hits GET /_matrix/client/v3/rooms/{roomId}/ephemeral and unwraps {data:{chunk}}', async () => {
      const result = await synapseRoomSummaryService.getRoomEphemeral('!room:hs')
      const calls = filterBy('/ephemeral')
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe('GET')
      expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/ephemeral`)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('m.typing')
    })

    it('getRoomEphemeral appends ?types=... when types filter provided', async () => {
      await synapseRoomSummaryService.getRoomEphemeral('!room:hs', ['m.typing', 'm.receipt'])
      const calls = filterBy('/ephemeral')
      expect(calls).toHaveLength(1)
      expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/ephemeral?types=m.typing,m.receipt`)
    })
  })
})
