/**
 * UrlPreview service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute
 * through real matrix-js-sdk code. Catches media double-prefix bugs
 * (/_matrix/client/v3/_matrix/media/r0/preview_url → 404) that vi.mock
 * tests miss because the stub authedRequest bypasses SDK URL construction.
 *
 * MatrixUrlPreviewService uses the second overload of authedRequest:
 *   authedRequest({ prefix: mediaPrefix }, 'GET', previewPath, queryParams, undefined, { global: false })
 * stripMatrixPrefix extracts prefix from the full media-prefixed path constant,
 * then passes it explicitly via opts.prefix so the SDK does not prepend its
 * default client prefix.
 *
 * Covers the 1 authedRequest call site in MatrixUrlPreviewService.getPreview.
 */
import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixUrlPreviewService } from '../MatrixUrlPreviewService'

const HOMESERVER = 'https://hs.urlpreview-contract.test'
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

setupMswServer(
  http.get(`${HOMESERVER}/_matrix/media/r0/preview_url`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    const url = new URL(request.url)
    const previewUrl = url.searchParams.get('url')
    if (previewUrl === 'https://example.com') {
      return HttpResponse.json({
        'og:title': 'Example Page',
        'og:description': 'A test page',
        'og:image': 'https://example.com/image.jpg',
        'og:site_name': 'Example'
      })
    }
    if (previewUrl === 'https://empty.example.com') {
      return HttpResponse.json({})
    }
    return HttpResponse.json({ 'og:title': 'Default Page' })
  })
)

describe('UrlPreview service URL construction contract (real SDK + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.urlpreview-contract.test',
      deviceId: 'DEV1'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Guards against SDK prepending its default client prefix to a media-prefixed
  // path constant (the V1/media double-prefix bug fixed in Phase H.1).
  const MEDIA_DOUBLE_PREFIX = /\/_matrix\/client\/v3\/_matrix\/(media|client)/

  it('getPreview hits /_matrix/media/r0/preview_url?url=... (no media double-prefix)', async () => {
    const result = await matrixUrlPreviewService.getPreview({ url: 'https://example.com' })

    const calls = seenUrls.filter((u) => u.url.includes('/preview_url'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/media/r0/preview_url?url=https%3A%2F%2Fexample.com`)
    expect(calls[0].url).not.toMatch(MEDIA_DOUBLE_PREFIX)
    expect(result?.title).toBe('Example Page')
    expect(result?.description).toBe('A test page')
    expect(result?.siteName).toBe('Example')
  })

  it('getPreview with timestamp adds ts query param (no media double-prefix)', async () => {
    const result = await matrixUrlPreviewService.getPreview({
      url: 'https://example.com',
      timestamp: 1234567890
    })

    const calls = seenUrls.filter((u) => u.url.includes('/preview_url'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/media/r0/preview_url?url=https%3A%2F%2Fexample.com&ts=1234567890`)
    expect(calls[0].url).not.toMatch(MEDIA_DOUBLE_PREFIX)
    expect(result?.title).toBe('Example Page')
  })

  it('getPreview returns null for empty response (still no media double-prefix)', async () => {
    const result = await matrixUrlPreviewService.getPreview({ url: 'https://empty.example.com' })

    const calls = seenUrls.filter((u) => u.url.includes('/preview_url'))
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/media/r0/preview_url?url=https%3A%2F%2Fempty.example.com`)
    expect(calls[0].url).not.toMatch(MEDIA_DOUBLE_PREFIX)
    expect(result).toBeNull()
  })
})
