/**
 * Voice service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute
 * through real matrix-js-sdk code. Catches V1 double-prefix bugs
 * (/_matrix/client/v3/_matrix/client/v1/voice/... → 404) that vi.mock
 * tests miss because the stub authedRequest bypasses SDK URL construction.
 *
 * Covers all 11 authedRequestWithPath call sites in MatrixVoiceService:
 * uploadVoice, getVoiceStats, getUserVoiceStats, getVoiceConfig,
 * deleteVoice, getRoomVoiceList, getUserVoiceList, getVoiceContent,
 * convertVoice, optimizeVoice, transcribeVoiceViaApi.
 */
import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixVoiceService } from '../MatrixVoiceService'

const HOMESERVER = 'https://hs.voice-contract.test'
const seenUrls: { method: string; url: string }[] = []
let realClient: MatrixClient

vi.mock('../../MatrixClientService', () => {
  const instance = {
    getClient: (): MatrixClient => realClient,
    getHomeserverUrl: () => HOMESERVER,
    waitForClientReady: () => Promise.resolve(realClient)
  }
  return { default: instance, matrixClientService: instance }
})

vi.mock('../../EndpointCapabilityService', () => ({
  default: { check: vi.fn().mockResolvedValue(true) }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

// MSW handlers at FULL V1-prefixed URLs. Specific paths registered before
// the :messageId wildcard so /voice/config etc. don't get swallowed.
setupMswServer(
  http.post(`${HOMESERVER}/_matrix/client/v1/voice/upload`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ event_id: '$evt-1', content_uri: 'mxc://hs.voice-contract.test/m1' })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v1/voice/config`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ max_duration: 600, allowed_formats: ['audio/webm'], auto_transcribe: true })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v1/voice/stats`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ total_duration: 1200, total_messages: 10, average_duration: 120 })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v1/voice/room/:roomId/stats`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ total_duration: 300, total_messages: 3, average_duration: 100 })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v1/voice/room/:roomId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ voices: [{ event_id: '$v1', sender: '@a:hs', duration: 5, timestamp: 1 }], total: 1 })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v1/voice/user/:userId/stats`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ total_duration: 600, total_messages: 5 })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v1/voice/user/:userId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ voices: [{ event_id: '$v2', room_id: '!r:hs', duration: 8, timestamp: 2 }], total: 1 })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v1/voice/convert`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ url: 'mxc://hs.voice-contract.test/conv1', format: 'mp3' })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v1/voice/optimize`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ url: 'mxc://hs.voice-contract.test/opt1', size: 1024 })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v1/voice/transcription`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ text: 'hello', language: 'en', confidence: 0.95 })
  }),
  // Wildcard :messageId routes last (DELETE + GET)
  http.delete(`${HOMESERVER}/_matrix/client/v1/voice/:messageId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({})
  }),
  http.get(`${HOMESERVER}/_matrix/client/v1/voice/:messageId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ body: 'voice-bytes', info: { mimetype: 'audio/webm', size: 2048 } })
  })
)

describe('Voice service URL construction contract (real SDK + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.voice-contract.test',
      deviceId: 'DEV1'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // V1 double-prefix guard: SDK must NOT prepend /_matrix/client/v3 when
  // the service already passes a V1-prefixed path via { prefix } option.
  const V1_DOUBLE_PREFIX = /\/_matrix\/client\/v3\/_matrix\/client\/v1/

  it('uploadVoice hits /_matrix/client/v1/voice/upload (no V1 double-prefix)', async () => {
    const file = new Blob(['voice-bytes'], { type: 'audio/webm' })
    const result = await matrixVoiceService.uploadVoice('!room:hs', file, 'voice.webm')

    const calls = seenUrls.filter((u) => u.url.includes('/voice/upload'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/voice/upload`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.eventId).toBe('$evt-1')
    expect(result.mxcUrl).toBe('mxc://hs.voice-contract.test/m1')
  })

  it('getVoiceConfig hits /_matrix/client/v1/voice/config (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getVoiceConfig()

    const calls = seenUrls.filter((u) => u.url.includes('/voice/config'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/voice/config`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.maxDuration).toBe(600)
    expect(result.autoTranscribe).toBe(true)
  })

  it('getVoiceStats hits /_matrix/client/v1/voice/stats (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getVoiceStats()

    const calls = seenUrls.filter((u) => u.url.endsWith('/voice/stats'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/voice/stats`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.totalMessages).toBe(10)
  })

  it('getVoiceStats with roomId hits /voice/room/:roomId/stats (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getVoiceStats('!room:hs')

    const calls = seenUrls.filter((u) => u.url.includes('/voice/room/'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    // encodeURIComponent('!room:hs') = '!room%3Ahs'
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/voice/room/!room%3Ahs/stats`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.totalMessages).toBe(3)
  })

  it('getUserVoiceStats hits /voice/user/:userId/stats (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getUserVoiceStats('@alice:hs')

    const calls = seenUrls.filter((u) => u.url.includes('/voice/user/'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    // encodeURIComponent('@alice:hs') = '%40alice%3Ahs'
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/voice/user/%40alice%3Ahs/stats`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.totalMessages).toBe(5)
  })

  it('deleteVoice hits DELETE /voice/:messageId (no V1 double-prefix)', async () => {
    await matrixVoiceService.deleteVoice('$msg-1')

    const calls = seenUrls.filter((u) => u.method === 'DELETE')
    expect(calls).toHaveLength(1)
    // encodeURIComponent('$msg-1') = '%24msg-1'
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/voice/%24msg-1`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
  })

  it('getRoomVoiceList hits /voice/room/:roomId with limit/offset query (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getRoomVoiceList('!room:hs', 25, 10)

    const calls = seenUrls.filter((u) => u.url.includes('/voice/room/!room%3Ahs?'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/voice/room/!room%3Ahs?limit=25&offset=10`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.total).toBe(1)
  })

  it('getUserVoiceList hits /voice/user/:userId with limit/offset query (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getUserVoiceList('@bob:hs', 5, 0)

    const calls = seenUrls.filter((u) => u.url.includes('/voice/user/%40bob%3Ahs?'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/voice/user/%40bob%3Ahs?limit=5&offset=0`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.total).toBe(1)
  })

  it('getVoiceContent hits GET /voice/:messageId (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getVoiceContent('$msg-2')

    const calls = seenUrls.filter((u) => u.method === 'GET' && u.url.includes('%24msg-2'))
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/voice/%24msg-2`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result?.body).toBe('voice-bytes')
  })

  it('convertVoice hits POST /voice/convert with body (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.convertVoice('$msg-3', 'mp3')

    const calls = seenUrls.filter((u) => u.url.includes('/voice/convert'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/voice/convert`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result?.format).toBe('mp3')
  })

  it('optimizeVoice hits POST /voice/optimize with body (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.optimizeVoice('$msg-4', { bitrate: 128 })

    const calls = seenUrls.filter((u) => u.url.includes('/voice/optimize'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/voice/optimize`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result?.size).toBe(1024)
  })

  it('transcribeVoiceViaApi hits POST /voice/transcription with body (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.transcribeVoiceViaApi('$msg-5', 'en')

    const calls = seenUrls.filter((u) => u.url.includes('/voice/transcription'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/voice/transcription`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result?.text).toBe('hello')
    expect(result?.language).toBe('en')
  })
})
