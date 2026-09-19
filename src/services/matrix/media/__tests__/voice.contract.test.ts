/**
 * Voice service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute
 * through real matrix-js-sdk code. Catches V1 double-prefix bugs
 * (/_matrix/client/v3/_matrix/vendor/v1/voice/... → 404) that vi.mock
 * tests miss because the stub authedRequest bypasses SDK URL construction.
 *
 * Covers every voice call site in MatrixVoiceService at the HTTP boundary:
 * uploadVoice, getVoiceStats, getUserVoiceStats, getVoiceConfig,
 * deleteVoice, getRoomVoiceList, getUserVoiceList, getVoiceContent,
 * convertVoice, optimizeVoice, transcribeVoiceViaApi.
 *
 * 全部走 SDK `VoiceManager`（`getVoiceManager()`），SDK 内部统一用 VendorPrefix
 * 命中同一批 V1 端点。MatrixVoiceService 已不再直接调用 `authedRequestWithPath`：
 * 上传（multipart）与两个列表方法在 Phase 0 收口时一并迁入 SDK；**加密与否不在本服务内决策**
 * （明文房间走 `uploadVoice`，加密房间由 `useVoiceInput` 改走标准 media 加密上传），
 * 本服务只负责明文通道与能力探测，避免第五处 URL 拼装逻辑与后端漂移。
 */
import { createClient, extendMatrixClientWithManagers, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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

// MSW handlers at FULL V1-prefixed URLs.
// VoiceManager uses REST-style paths: /voice/{mediaId}/convert (not /voice/convert).
// Backend (synapse-web/src/routes/voice.rs) registers the same pattern.
// Specific paths registered before the :messageId wildcard so /voice/config etc. don't get swallowed.
setupMswServer(
  http.post(`${HOMESERVER}/_matrix/vendor/v1/voice/upload`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    // 后端 upload 响应形状（voice_service.rs:130-136）：没有 event_id / url
    return HttpResponse.json({
      content_uri: 'mxc://hs.voice-contract.test/m1',
      content: { msgtype: 'm.audio', url: 'mxc://hs.voice-contract.test/m1' },
      content_type: 'audio/webm',
      duration_ms: 3000,
      size: 1024
    })
  }),
  http.get(`${HOMESERVER}/_matrix/vendor/v1/voice/config`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ max_duration: 600, allowed_formats: ['audio/webm'], auto_transcribe: true })
  }),
  http.get(`${HOMESERVER}/_matrix/vendor/v1/voice/stats`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ total_duration: 1200, total_messages: 10, average_duration: 120 })
  }),
  http.get(`${HOMESERVER}/_matrix/vendor/v1/voice/room/:roomId/stats`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ total_duration: 300, total_messages: 3, average_duration: 100 })
  }),
  http.get(`${HOMESERVER}/_matrix/vendor/v1/voice/room/:roomId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    // 后端真实响应：{ room_id, messages: [IVoiceMessage...], next_batch: <i64|null> }
    // （voice_service.rs::record_to_message_json / get_room_voice_messages）
    const url = request.url
    const fromParam = url.match(/from=(\d+)/)
    const from = fromParam ? parseInt(fromParam[1], 10) : 0
    const limitParam = url.match(/limit=(\d+)/)
    const limit = limitParam ? parseInt(limitParam[1], 10) : 50
    const mockMessages = Array.from({ length: limit }, (_, i) => ({
      media_id: 'm' + (from + i),
      user_id: '@a:hs',
      room_id: '!room:hs',
      content_uri: `mxc://hs.voice-contract.test/m${from + i}`,
      content_type: 'audio/webm',
      duration_ms: 5 + i,
      size_bytes: 1024,
      created_ts: 1000000 + i * 1000
    }))
    return HttpResponse.json({
      room_id: '!room:hs',
      messages: mockMessages,
      // 毫秒时间戳游标，不是字符串
      next_batch: from + limit
    })
  }),
  http.get(`${HOMESERVER}/_matrix/vendor/v1/voice/user/:userId/stats`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ total_duration: 600, total_messages: 5 })
  }),
  http.get(`${HOMESERVER}/_matrix/vendor/v1/voice/user/:userId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({
      user_id: '@bob:hs',
      messages: [
        {
          media_id: 'm2',
          user_id: '@bob:hs',
          room_id: '!r:hs',
          content_uri: 'mxc://hs.voice-contract.test/m2',
          content_type: 'audio/webm',
          duration_ms: 8,
          size_bytes: 512,
          created_ts: 2
        }
      ],
      next_batch: 42
    })
  }),
  // VoiceManager REST-style paths: /voice/{mediaId}/convert|optimize|transcription
  http.post(`${HOMESERVER}/_matrix/vendor/v1/voice/:mediaId/convert`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ url: 'mxc://hs.voice-contract.test/conv1', format: 'mp3' })
  }),
  http.post(`${HOMESERVER}/_matrix/vendor/v1/voice/:mediaId/optimize`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ url: 'mxc://hs.voice-contract.test/opt1', size: 1024 })
  }),
  http.post(`${HOMESERVER}/_matrix/vendor/v1/voice/:mediaId/transcription`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ text: 'hello', language: 'en', confidence: 0.95 })
  }),
  // Wildcard :messageId routes last (DELETE + GET)
  http.delete(`${HOMESERVER}/_matrix/vendor/v1/voice/:messageId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({})
  }),
  http.get(`${HOMESERVER}/_matrix/vendor/v1/voice/:messageId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ body: 'voice-bytes', info: { mimetype: 'audio/webm', size: 2048 } })
  })
)

describe('Voice service URL construction contract (real SDK + msw)', () => {
  beforeAll(async () => {
    // In Vitest environment, SDK skips async manager init (shouldSkipAsyncManagerInit).
    // Manually initialize so getVoiceManager() is available on the real SDK client.
    await extendMatrixClientWithManagers()
  })

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

  // vendor double-prefix guard: SDK must NOT prepend /_matrix/client/v3 when
  // the service already passes a vendor-prefixed path via { prefix } option.
  const V1_DOUBLE_PREFIX = /\/_matrix\/client\/v3\/_matrix\/vendor\/v1/

  it('uploadVoice hits /_matrix/vendor/v1/voice/upload (no V1 double-prefix)', async () => {
    const file = new Blob(['voice-bytes'], { type: 'audio/webm' })
    const result = await matrixVoiceService.uploadVoice('!room:hs', file, 'voice.webm')

    const calls = seenUrls.filter((u) => u.url.includes('/voice/upload'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/voice/upload`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    // 后端不上报 event_id，上传结果里不该有它
    expect(result.eventId).toBeUndefined()
    expect(result.mxcUrl).toBe('mxc://hs.voice-contract.test/m1')
  })

  it('getVoiceConfig hits /_matrix/vendor/v1/voice/config (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getVoiceConfig()

    const calls = seenUrls.filter((u) => u.url.includes('/voice/config'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/voice/config`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.maxDuration).toBe(600)
    expect(result.autoTranscribe).toBe(true)
  })

  it('getVoiceStats hits /_matrix/vendor/v1/voice/stats (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getVoiceStats()

    const calls = seenUrls.filter((u) => u.url.endsWith('/voice/stats'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/voice/stats`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.totalMessages).toBe(10)
  })

  it('getVoiceStats with roomId hits /voice/room/:roomId/stats (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getVoiceStats('!room:hs')

    const calls = seenUrls.filter((u) => u.url.includes('/voice/room/'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    // encodeURIComponent('!room:hs') = '!room%3Ahs'
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/voice/room/!room%3Ahs/stats`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.totalMessages).toBe(3)
  })

  it('getUserVoiceStats hits /voice/user/:userId/stats (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getUserVoiceStats('@alice:hs')

    const calls = seenUrls.filter((u) => u.url.includes('/voice/user/'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    // encodeURIComponent('@alice:hs') = '%40alice%3Ahs'
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/voice/user/%40alice%3Ahs/stats`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.totalMessages).toBe(5)
  })

  it('deleteVoice hits DELETE /voice/:messageId (no V1 double-prefix)', async () => {
    await matrixVoiceService.deleteVoice('$msg-1')

    const calls = seenUrls.filter((u) => u.method === 'DELETE')
    expect(calls).toHaveLength(1)
    // encodeURIComponent('$msg-1') = '%24msg-1'
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/voice/%24msg-1`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
  })

  it('getRoomVoiceList hits /voice/room/:roomId with limit/from query (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getRoomVoiceList('!room:hs', 25, 10)

    const calls = seenUrls.filter((u) => u.url.includes('/voice/room/!room%3Ahs?'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/voice/room/!room%3Ahs?limit=25&from=10`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.messages).toHaveLength(25)
    expect(result.next_batch).toBe(35)
  })

  it('getUserVoiceList hits /voice/user/:userId with limit/from query (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getUserVoiceList('@bob:hs', 5, 0)

    const calls = seenUrls.filter((u) => u.url.includes('/voice/user/%40bob%3Ahs?'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/voice/user/%40bob%3Ahs?limit=5&from=0`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.messages).toHaveLength(1)
    expect(result.next_batch).toBe(42)
  })

  it('getVoiceContent hits GET /voice/:messageId (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.getVoiceContent('$msg-2')

    const calls = seenUrls.filter((u) => u.method === 'GET' && u.url.includes('%24msg-2'))
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/voice/%24msg-2`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result?.body).toBe('voice-bytes')
  })

  it('convertVoice hits POST /voice/:mediaId/convert via VoiceManager (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.convertVoice('$msg-3', 'mp3')

    const calls = seenUrls.filter((u) => u.url.includes('/convert'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    // VoiceManager uses REST-style: /voice/{mediaId}/convert
    // encodeURIComponent('$msg-3') = '%24msg-3'
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/voice/%24msg-3/convert`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result?.format).toBe('mp3')
  })

  it('optimizeVoice hits POST /voice/:mediaId/optimize via VoiceManager (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.optimizeVoice('$msg-4', { bitrate: 128 })

    const calls = seenUrls.filter((u) => u.url.includes('/optimize'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/voice/%24msg-4/optimize`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result?.size).toBe(1024)
  })

  it('transcribeVoiceViaApi hits POST /voice/:mediaId/transcription via VoiceManager (no V1 double-prefix)', async () => {
    const result = await matrixVoiceService.transcribeVoiceViaApi('$msg-5', 'en')

    const calls = seenUrls.filter((u) => u.url.includes('/transcription'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/vendor/v1/voice/%24msg-5/transcription`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result?.text).toBe('hello')
    expect(result?.language).toBe('en')
  })
})
