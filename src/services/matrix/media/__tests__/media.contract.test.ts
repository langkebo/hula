/**
 * Media service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute
 * through real matrix-js-sdk code. Catches media-prefix double-prefix bugs
 * (/_matrix/client/v3/_matrix/media/v3/... → 404) that vi.mock tests miss
 * because the stub authedRequest bypasses SDK URL construction.
 *
 * Covers the 6 quota / config / delete call sites in MatrixMediaService:
 * getMediaConfig, deleteMedia, getQuotaAlerts, checkQuota, getQuotaStats,
 * getAuthenticatedMediaConfig.
 */
import { createClient, initializeManagerExtensions, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixMediaService } from '../MatrixMediaService'

const HOMESERVER = 'https://hs.media-contract.test'
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

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

setupMswServer(
  http.get(`${HOMESERVER}/_matrix/media/v3/config`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ 'm.upload.size': 52428800 })
  }),
  http.post(`${HOMESERVER}/_matrix/media/v1/delete/:serverName/:mediaId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({})
  }),
  http.get(`${HOMESERVER}/_matrix/media/v1/quota/alerts`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ alerts: [{ alert_id: 'a1', alert_type: 'warning' }] })
  }),
  http.get(`${HOMESERVER}/_matrix/media/v1/quota/check`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ limit: 104857600, used: 52428800, remaining: 52428800 })
  }),
  http.get(`${HOMESERVER}/_matrix/media/v1/quota/stats`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ storage_bytes: 52428800, media_count: 42, limit_bytes: 104857600 })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v1/media/config`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ authenticated_media: true })
  })
)

describe('Media service URL construction contract (real SDK + msw)', () => {
  beforeAll(async () => {
    // In Vitest environment, SDK skips async manager init. Manually initialize
    // so client.getMediaManager() (used by getQuotaAlerts/checkQuota/getQuotaStats)
    // is available on the real MatrixClient instance.
    await initializeManagerExtensions()
  })

  beforeEach(() => {
    seenUrls.length = 0
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.media-contract.test',
      deviceId: 'DEV1'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // General double-prefix guard: SDK must NOT prepend /_matrix/client/v3
  // before any /_matrix/media or /_matrix/client/v1 path.
  const DOUBLE_PREFIX = /\/_matrix\/client\/v3\/_matrix\/(media|client)/

  it('getMediaConfig hits /_matrix/media/v3/config (no double-prefix)', async () => {
    const result = await matrixMediaService.getMediaConfig()

    const calls = seenUrls.filter((u) => u.url.includes('/media/v3/config'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/media/v3/config`)
    expect(calls[0].url).not.toMatch(DOUBLE_PREFIX)
    expect(result['m.upload.size']).toBe(52428800)
  })

  it('deleteMedia hits POST /_matrix/media/v1/delete/:server/:mediaId (no double-prefix)', async () => {
    const result = await matrixMediaService.deleteMedia('matrix.org', 'media123')

    const calls = seenUrls.filter((u) => u.url.includes('/media/v1/delete/'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('POST')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/media/v1/delete/matrix.org/media123`)
    expect(calls[0].url).not.toMatch(DOUBLE_PREFIX)
    expect(result).toBe(true)
  })

  it('getQuotaAlerts hits /_matrix/media/v1/quota/alerts (no double-prefix)', async () => {
    const result = await matrixMediaService.getQuotaAlerts()

    const calls = seenUrls.filter((u) => u.url.includes('/media/v1/quota/alerts'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/media/v1/quota/alerts`)
    expect(calls[0].url).not.toMatch(DOUBLE_PREFIX)
    expect(result).toHaveLength(1)
    expect(result[0].alert_id).toBe('a1')
  })

  it('checkQuota hits /_matrix/media/v1/quota/check (no double-prefix)', async () => {
    const result = await matrixMediaService.checkQuota()

    const calls = seenUrls.filter((u) => u.url.includes('/media/v1/quota/check'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/media/v1/quota/check`)
    expect(calls[0].url).not.toMatch(DOUBLE_PREFIX)
    expect(result?.limit).toBe(104857600)
    expect(result?.remaining).toBe(52428800)
  })

  it('getQuotaStats hits /_matrix/media/v1/quota/stats (no double-prefix)', async () => {
    const result = await matrixMediaService.getQuotaStats()

    const calls = seenUrls.filter((u) => u.url.includes('/media/v1/quota/stats'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/media/v1/quota/stats`)
    expect(calls[0].url).not.toMatch(DOUBLE_PREFIX)
    expect(result?.mediaCount).toBe(42)
    expect(result?.storageBytes).toBe(52428800)
  })

  it('getAuthenticatedMediaConfig hits /_matrix/client/v1/media/config (no double-prefix)', async () => {
    const result = await matrixMediaService.getAuthenticatedMediaConfig()

    const calls = seenUrls.filter((u) => u.url.includes('/client/v1/media/config'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/media/config`)
    expect(calls[0].url).not.toMatch(DOUBLE_PREFIX)
    expect(result?.authenticated_media).toBe(true)
  })
})
