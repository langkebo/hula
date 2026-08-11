import { createClient, initializeManagerExtensions, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'

const HOMESERVER = 'https://hs.chunk-contract.test'
let realClient: MatrixClient

vi.mock('@/services/matrix/matrixClientAccessor', () => ({
  getMatrixClient: () => realClient,
  getMatrixAccessToken: () => 'contract-at',
  getMatrixHomeserverUrl: () => HOMESERVER
}))
vi.mock('@/services/backend/config', () => ({
  resolveMatrixRuntimeEndpointConfig: () => ({ homeserverUrl: HOMESERVER })
}))
vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

const seenRequests: { method: string; url: string }[] = []

const server = setupMswServer(
  http.post(`${HOMESERVER}/_matrix/media/v1/upload/chunk/start`, ({ request }) => {
    seenRequests.push({ method: request.method, url: request.url })
    return HttpResponse.json({ upload_id: 'u1', chunk_size_limit: 5242880, max_file_size: 52428800 })
  }),
  http.post(`${HOMESERVER}/_matrix/media/v1/upload/chunk`, ({ request }) => {
    seenRequests.push({ method: request.method, url: request.url })
    return HttpResponse.json({ upload_id: 'u1', chunk_index: 0, received_bytes: 10 })
  }),
  http.post(`${HOMESERVER}/_matrix/media/v1/upload/chunk/complete`, ({ request }) => {
    seenRequests.push({ method: request.method, url: request.url })
    return HttpResponse.json({ upload_id: 'u1', content_uri: 'mxc://hs/chunked' })
  }),
  http.post(`${HOMESERVER}/_matrix/media/v1/upload/chunk/cancel`, ({ request }) => {
    seenRequests.push({ method: request.method, url: request.url })
    return HttpResponse.json({ upload_id: 'u1', cancelled: true })
  })
)

import chunkUploadService from '../ChunkUploadService'

const makeFile = () => new File([new Uint8Array(10)], 'big.bin', { type: 'application/octet-stream' })

describe('ChunkUploadService (MediaManager-backed)', () => {
  beforeAll(async () => {
    // SDK skips async manager init under Vitest; must call explicitly
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.chunk-contract.test',
      deviceId: 'DEV1'
    })
    await initializeManagerExtensions()
    // Note: production ChunkUploadService.upload() now calls
    // setRetryOptions({ maxRetries: 0 }) itself to disable SDK-level
    // retry (uploadChunk's withRetry defaults to idempotent=true and
    // would retry 500s, causing double-retry with frontend maxRetries).
    // The finally block restores maxRetries=3 after each upload.
  })

  beforeEach(() => {
    seenRequests.length = 0
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('start/uploadChunk/complete URLs hit /_matrix/media/v1/upload/chunk/* via SDK', async () => {
    const result = await chunkUploadService.upload({ file: makeFile(), chunkSize: 10 })

    expect(seenRequests.find((r) => r.url.includes('/chunk/start'))).toBeTruthy()
    expect(seenRequests.find((r) => r.url.includes('/chunk?') || r.url.includes('/chunk&'))).toBeTruthy()
    expect(seenRequests.find((r) => r.url.includes('/chunk/complete'))).toBeTruthy()
    expect(result.mxcUrl).toBe('mxc://hs/chunked')
  })

  it('chunk upload failure after retry exhaustion triggers cancel endpoint', async () => {
    // Override the chunk handler to always return 500
    server.use(
      http.post(
        `${HOMESERVER}/_matrix/media/v1/upload/chunk`,
        () => new HttpResponse('Internal Server Error', { status: 500 })
      )
    )

    await expect(chunkUploadService.upload({ file: makeFile(), chunkSize: 10, maxRetries: 2 })).rejects.toThrow()

    expect(seenRequests.find((r) => r.url.includes('/chunk/cancel'))).toBeTruthy()
  })

  it('disables SDK-level retry during upload to prevent double-retry', async () => {
    // Verify production code calls setRetryOptions({ maxRetries: 0 }) by
    // counting HTTP requests on a 500: with maxRetries=3 (frontend), the
    // chunk endpoint should be hit exactly 3 times (1 original + 2 retries,
    // because retryCount++ then >= maxRetries check allows N-1 retries).
    // If SDK retry were active, it would be 12 hits (3 frontend × 4 SDK).
    server.use(
      http.post(`${HOMESERVER}/_matrix/media/v1/upload/chunk`, ({ request }) => {
        seenRequests.push({ method: request.method, url: request.url })
        return new HttpResponse('Internal Server Error', { status: 500 })
      })
    )

    await expect(chunkUploadService.upload({ file: makeFile(), chunkSize: 10, maxRetries: 3 })).rejects.toThrow()

    const chunkHits = seenRequests.filter((r) => r.url.includes('/chunk?') || r.url.includes('/chunk&')).length
    // 1 original attempt + 2 frontend retries = 3 total (no SDK retry)
    expect(chunkHits).toBe(3)
  })

  it('progress callback receives percentage based on completed chunks', async () => {
    const onProgress = vi.fn()
    await chunkUploadService.upload({ file: makeFile(), chunkSize: 10, onProgress })

    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1]?.[0]
    expect(lastCall.percentage).toBe(100)
    expect(lastCall.loaded).toBe(10)
    expect(lastCall.total).toBe(10)
  })
})
