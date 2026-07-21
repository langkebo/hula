/**
 * SynapseRustExtensionsService rooms + captcha contract tests — MSW intercepts
 * at the HTTP boundary.
 *
 * Like the friends contract test, these methods use the service's own
 * `this.request()` → `getRuntimeAwareFetch()` → `globalThis.fetch`, so we
 * DO NOT mock getRuntimeAwareFetch. MSW intercepts the real fetch call.
 *
 * All endpoints here use PREFIX_V3 (/matrix/client/v3) inlined in the service.
 * Contract value: verify URL correctness (path, encoded roomId, query string),
 * HTTP method, request body shape, and response unwrapping
 * (`{data: ...}` wrapper vs bare payload).
 *
 * Covers: burn stats/toggle, anti-screenshot toggle, invite blocklist/allowlist,
 * sticky events, room summary (members/state/stats), ephemeral, captcha.
 */
import type { MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixClientService } from '../MatrixClientService'
import { synapseRustExtensionsService } from '../SynapseRustExtensionsService'

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
  http.get(`${HOMESERVER}/_matrix/client/v3/user/burn/stats`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ data: { total_burned: 5, total_pending: 2, rooms_with_burn_enabled: 3 } })
  }),
  http.put(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/burn`, async ({ request }) => {
    const body = await request.text()
    seenUrls.push({ method: request.method, url: request.url, body })
    return HttpResponse.json({ status: 'ok' })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/burn`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ data: { enabled: true } })
  }),
  http.put(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/anti_screenshot`, async ({ request }) => {
    const body = await request.text()
    seenUrls.push({ method: request.method, url: request.url, body })
    return HttpResponse.json({ status: 'ok' })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/anti_screenshot`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ data: { enabled: false } })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/invite_blocklist`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ data: { blocked_users: ['@bad:hs'], updated_ts: 123 } })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/invite_blocklist`, async ({ request }) => {
    const body = await request.text()
    seenUrls.push({ method: request.method, url: request.url, body })
    return HttpResponse.json({ status: 'ok' })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/invite_allowlist`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ data: { allowed_users: ['@good:hs'], updated_ts: 456 } })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/invite_allowlist`, async ({ request }) => {
    const body = await request.text()
    seenUrls.push({ method: request.method, url: request.url, body })
    return HttpResponse.json({ status: 'ok' })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/sticky_events`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({
      data: { events: [{ event_id: '$e1:hs', event_type: 'm.room.name', content: {}, updated_ts: 1 }] }
    })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/sticky_events`, async ({ request }) => {
    const body = await request.text()
    seenUrls.push({ method: request.method, url: request.url, body })
    return HttpResponse.json({ status: 'ok' })
  }),
  http.delete(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/sticky_events/:eventType`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ status: 'ok' })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/summary`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({
      data: {
        room_id: '!room:hs',
        name: 'Test Room',
        heroes: [],
        stats: { room_id: '!room:hs', total_events: 100, total_messages: 50, total_media: 10, storage_size: 1024 }
      }
    })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/summary/members`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json([{ user_id: '@u:hs', membership: 'join', is_hero: false }])
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/summary/state`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json([{ event_type: 'm.room.name', state_key: '', event_id: '$e:hs', content: { name: 'R' } }])
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/summary/stats`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ room_id: '!room:hs', total_messages: 5 })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/ephemeral`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ data: { chunk: [{ type: 'm.typing', content: {} }] } })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v3/register/captcha/send`, async ({ request }) => {
    const body = await request.text()
    seenUrls.push({ method: request.method, url: request.url, body })
    return HttpResponse.json({ data: { captcha_id: 'cap-1', expires_in: 300 } })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v3/register/captcha/verify`, async ({ request }) => {
    const body = await request.text()
    seenUrls.push({ method: request.method, url: request.url, body })
    return HttpResponse.json({ data: { verified: true } })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/register/captcha/status`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ data: { used: false } })
  })
)

describe('SynapseRustExtensionsService rooms + captcha URL construction contract (real fetch + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    vi.spyOn(matrixClientService, 'getHomeserverUrl').mockReturnValue(HOMESERVER)
    vi.spyOn(matrixClientService, 'getAccessToken').mockReturnValue(ACCESS_TOKEN)
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null as unknown as MatrixClient)
    vi.spyOn(matrixClientService, 'waitForClientReady').mockResolvedValue(null as unknown as MatrixClient)
    synapseRustExtensionsService.clear()
    ;(synapseRustExtensionsService as unknown as { baseUrl: string }).baseUrl = HOMESERVER
    ;(synapseRustExtensionsService as unknown as { accessToken: string }).accessToken = ACCESS_TOKEN
    ;(synapseRustExtensionsService as unknown as { friendEndpointAvailable: null }).friendEndpointAvailable = null
  })

  afterEach(() => {
    vi.clearAllMocks()
    server.resetHandlers()
  })

  const filterBy = (substring: string) => seenUrls.filter((u) => u.url.includes(substring))

  describe('burn after read', () => {
    it('getBurnStats hits GET /_matrix/client/v3/user/burn/stats and unwraps {data}', async () => {
      const result = await synapseRustExtensionsService.getBurnStats()
      const calls = filterBy('/user/burn/stats')
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe('GET')
      expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/user/burn/stats`)
      expect(result.total_burned).toBe(5)
      expect(result.rooms_with_burn_enabled).toBe(3)
    })

    it('enableBurnAfterRead PUTs /_matrix/client/v3/rooms/{roomId}/burn with {enabled, burn_after_ms?}', async () => {
      await synapseRustExtensionsService.enableBurnAfterRead('!room:hs', true, 60000)
      const calls = filterBy('/burn')
      const putCall = calls.find((c) => c.method === 'PUT')
      expect(putCall).toBeDefined()
      expect(putCall!.url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/burn`)
      expect(JSON.parse(putCall!.body!)).toEqual({ enabled: true, burn_after_ms: 60000 })
    })

    it('isBurnAfterReadEnabled hits GET /_matrix/client/v3/rooms/{roomId}/burn', async () => {
      const result = await synapseRustExtensionsService.isBurnAfterReadEnabled('!room:hs')
      const calls = filterBy('/burn')
      const getCall = calls.find((c) => c.method === 'GET')
      expect(getCall).toBeDefined()
      expect(getCall!.url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/burn`)
      expect(result).toBe(true)
    })
  })

  describe('anti-screenshot', () => {
    it('enableAntiScreenshot PUTs /_matrix/client/v3/rooms/{roomId}/anti_screenshot with {enabled}', async () => {
      await synapseRustExtensionsService.enableAntiScreenshot('!room:hs', true)
      const calls = filterBy('/anti_screenshot')
      const putCall = calls.find((c) => c.method === 'PUT')
      expect(putCall).toBeDefined()
      expect(putCall!.url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/anti_screenshot`)
      expect(JSON.parse(putCall!.body!)).toEqual({ enabled: true })
    })

    it('isAntiScreenshotEnabled hits GET /_matrix/client/v3/rooms/{roomId}/anti_screenshot', async () => {
      const result = await synapseRustExtensionsService.isAntiScreenshotEnabled('!room:hs')
      const calls = filterBy('/anti_screenshot')
      const getCall = calls.find((c) => c.method === 'GET')
      expect(getCall).toBeDefined()
      expect(getCall!.url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/anti_screenshot`)
      expect(result).toBe(false)
    })
  })

  describe('invite blocklist / allowlist', () => {
    it('getInviteBlocklist hits GET /_matrix/client/v3/rooms/{roomId}/invite_blocklist', async () => {
      const result = await synapseRustExtensionsService.getInviteBlocklist('!room:hs')
      const calls = filterBy('/invite_blocklist')
      const getCall = calls.find((c) => c.method === 'GET')
      expect(getCall).toBeDefined()
      expect(getCall!.url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/invite_blocklist`)
      expect(result.blocked_users).toHaveLength(1)
    })

    it('setInviteBlocklist POSTs /_matrix/client/v3/rooms/{roomId}/invite_blocklist with {user_ids}', async () => {
      await synapseRustExtensionsService.setInviteBlocklist('!room:hs', ['@bad:hs'])
      const calls = filterBy('/invite_blocklist')
      const postCall = calls.find((c) => c.method === 'POST')
      expect(postCall).toBeDefined()
      expect(JSON.parse(postCall!.body!)).toEqual({ user_ids: ['@bad:hs'] })
    })

    it('getInviteAllowlist hits GET /_matrix/client/v3/rooms/{roomId}/invite_allowlist', async () => {
      const result = await synapseRustExtensionsService.getInviteAllowlist('!room:hs')
      const calls = filterBy('/invite_allowlist')
      const getCall = calls.find((c) => c.method === 'GET')
      expect(getCall).toBeDefined()
      expect(getCall!.url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/invite_allowlist`)
      expect(result.allowed_users).toHaveLength(1)
    })

    it('setInviteAllowlist POSTs /_matrix/client/v3/rooms/{roomId}/invite_allowlist with {user_ids}', async () => {
      await synapseRustExtensionsService.setInviteAllowlist('!room:hs', ['@good:hs'])
      const calls = filterBy('/invite_allowlist')
      const postCall = calls.find((c) => c.method === 'POST')
      expect(postCall).toBeDefined()
      expect(JSON.parse(postCall!.body!)).toEqual({ user_ids: ['@good:hs'] })
    })
  })

  describe('sticky events', () => {
    it('getStickyEvents hits GET /_matrix/client/v3/rooms/{roomId}/sticky_events', async () => {
      const result = await synapseRustExtensionsService.getStickyEvents('!room:hs')
      const calls = filterBy('/sticky_events')
      const getCall = calls.find((c) => c.method === 'GET' && !c.url.includes('/sticky_events/'))
      expect(getCall).toBeDefined()
      expect(getCall!.url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/sticky_events`)
      expect(result).toHaveLength(1)
      expect(result[0].event_id).toBe('$e1:hs')
    })

    it('setStickyEvent POSTs /_matrix/client/v3/rooms/{roomId}/sticky_events with {events:[{event_id,event_type}]}', async () => {
      await synapseRustExtensionsService.setStickyEvent('!room:hs', '$e1:hs', 'm.room.name')
      const calls = filterBy('/sticky_events')
      const postCall = calls.find((c) => c.method === 'POST')
      expect(postCall).toBeDefined()
      expect(JSON.parse(postCall!.body!)).toEqual({
        events: [{ event_id: '$e1:hs', event_type: 'm.room.name' }]
      })
    })

    it('clearStickyEvent DELETEs /_matrix/client/v3/rooms/{roomId}/sticky_events/{eventType}', async () => {
      await synapseRustExtensionsService.clearStickyEvent('!room:hs', 'm.room.name')
      const calls = filterBy('/sticky_events/')
      const deleteCall = calls.find((c) => c.method === 'DELETE')
      expect(deleteCall).toBeDefined()
      expect(deleteCall!.url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/sticky_events/m.room.name`)
    })
  })

  describe('room summary', () => {
    it('getRoomSummary hits GET /_matrix/client/v3/rooms/{roomId}/summary and unwraps {data}', async () => {
      const result = await synapseRustExtensionsService.getRoomSummary('!room:hs')
      const calls = filterBy('/summary')
      const getCall = calls.find((c) => c.method === 'GET' && !c.url.includes('/summary/'))
      expect(getCall).toBeDefined()
      expect(getCall!.url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/summary`)
      expect(result?.room_id).toBe('!room:hs')
      expect(result?.name).toBe('Test Room')
    })

    it('getRoomSummary accepts bare payload (no {data} wrapper)', async () => {
      server.use(
        http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/summary`, ({ request }) => {
          seenUrls.push({ method: request.method, url: request.url })
          return HttpResponse.json({
            room_id: '!bare:hs',
            name: 'Bare',
            heroes: [],
            stats: { room_id: '!bare:hs', total_events: 1, total_messages: 1, total_media: 0, storage_size: 10 }
          })
        })
      )
      const result = await synapseRustExtensionsService.getRoomSummary('!bare:hs')
      expect(result?.room_id).toBe('!bare:hs')
      expect(result?.name).toBe('Bare')
    })

    it('getRoomSummary returns null on 404 when throwOnError=false', async () => {
      server.use(
        http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/summary`, ({ request }) => {
          seenUrls.push({ method: request.method, url: request.url })
          return new HttpResponse(null, { status: 404 })
        })
      )
      const result = await synapseRustExtensionsService.getRoomSummary('!missing:hs', false)
      expect(result).toBeNull()
    })

    it('getRoomSummaryMembers hits GET /_matrix/client/v3/rooms/{roomId}/summary/members (bare array)', async () => {
      const result = await synapseRustExtensionsService.getRoomSummaryMembers('!room:hs')
      const calls = filterBy('/summary/members')
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe('GET')
      expect(result).toHaveLength(1)
      expect(result[0].user_id).toBe('@u:hs')
    })

    it('getRoomSummaryState hits GET /_matrix/client/v3/rooms/{roomId}/summary/state (bare array)', async () => {
      const result = await synapseRustExtensionsService.getRoomSummaryState('!room:hs')
      const calls = filterBy('/summary/state')
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe('GET')
      expect(result).toHaveLength(1)
      expect(result[0].event_type).toBe('m.room.name')
    })

    it('getRoomSummaryStats hits GET /_matrix/client/v3/rooms/{roomId}/summary/stats (bare object)', async () => {
      const result = await synapseRustExtensionsService.getRoomSummaryStats('!room:hs')
      const calls = filterBy('/summary/stats')
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe('GET')
      expect(result?.total_messages).toBe(5)
    })
  })

  describe('room ephemeral', () => {
    it('getRoomEphemeral hits GET /_matrix/client/v3/rooms/{roomId}/ephemeral and unwraps {data:{chunk}}', async () => {
      const result = await synapseRustExtensionsService.getRoomEphemeral('!room:hs')
      const calls = filterBy('/ephemeral')
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe('GET')
      expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/ephemeral`)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('m.typing')
    })

    it('getRoomEphemeral appends ?types=... when types filter provided', async () => {
      await synapseRustExtensionsService.getRoomEphemeral('!room:hs', ['m.typing', 'm.receipt'])
      const calls = filterBy('/ephemeral')
      expect(calls).toHaveLength(1)
      expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!room%3Ahs/ephemeral?types=m.typing,m.receipt`)
    })
  })

  describe('captcha', () => {
    it('sendCaptcha POSTs /_matrix/client/v3/register/captcha/send with {target, captcha_type}', async () => {
      const result = await synapseRustExtensionsService.sendCaptcha('+8613800138000', 'sms')
      const calls = filterBy('/captcha/send')
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe('POST')
      expect(JSON.parse(calls[0].body!)).toEqual({ target: '+8613800138000', captcha_type: 'sms' })
      expect(result.success).toBe(true)
      expect(result.captchaId).toBe('cap-1')
    })

    it('verifyCaptcha POSTs /_matrix/client/v3/register/captcha/verify with {captcha_id, code}', async () => {
      const result = await synapseRustExtensionsService.verifyCaptcha('cap-1', '123456')
      const calls = filterBy('/captcha/verify')
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe('POST')
      expect(JSON.parse(calls[0].body!)).toEqual({ captcha_id: 'cap-1', code: '123456' })
      expect(result).toBe(true)
    })

    it('getCaptchaStatus hits GET /_matrix/client/v3/register/captcha/status?captcha_id=...', async () => {
      const result = await synapseRustExtensionsService.getCaptchaStatus('cap-1')
      const calls = filterBy('/captcha/status')
      expect(calls).toHaveLength(1)
      expect(calls[0].method).toBe('GET')
      expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/register/captcha/status?captcha_id=cap-1`)
      expect(result).toHaveProperty('used', false)
    })
  })
})
