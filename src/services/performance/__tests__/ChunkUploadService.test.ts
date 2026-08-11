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
    // Disable SDK-level retries so frontend maxRetries is the only retry
    // source under test. Otherwise uploadChunk's withRetry retries 500s
    // (idempotent defaults to true) and the test times out waiting for
    // SDK backoff (1s + 2s + 4s = 7s per attempt) before frontend retry.
    realClient.getMediaManager().setRetryOptions({ maxRetries: 0 })
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

  it('progress callback receives percentage based on completed chunks', async () => {
    const onProgress = vi.fn()
    await chunkUploadService.upload({ file: makeFile(), chunkSize: 10, onProgress })

    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1]?.[0]
    expect(lastCall.percentage).toBe(100)
    expect(lastCall.loaded).toBe(10)
    expect(lastCall.total).toBe(10)
  })
})
