import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chunkUploadService } from '@/services/performance/ChunkUploadService'
import type { MatrixClient, MediaManager } from '../../sdk'
import {
  createUploadOptions,
  isPayloadTooLarge,
  uploadContentWithChunkFallback,
  uploadViaDirectFetch
} from '../mediaUploadHelpers'

vi.mock('@/services/performance/ChunkUploadService', () => ({
  chunkUploadService: {
    upload: vi.fn()
  }
}))

/** 可控的 XMLHttpRequest 假实现 */
class FakeXHR {
  static DONE = 4
  static instances: FakeXHR[] = []
  status = 0
  responseText = ''
  readyState = 0
  headers: Record<string, string> = {}
  sent: unknown = null
  aborted = false
  method = ''
  url = ''
  onreadystatechange: (() => void) | null = null
  onerror: (() => void) | null = null

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v
  }
  send(body: unknown) {
    this.sent = body
    FakeXHR.instances.push(this)
  }
  abort() {
    this.aborted = true
  }
  complete(status: number, responseText: string) {
    this.status = status
    this.responseText = responseText
    this.readyState = 4
    this.onreadystatechange?.()
  }
}

const OriginalXHR = globalThis.XMLHttpRequest

function createClient(overrides: { token?: string | null; homeserverUrl?: string } = {}) {
  return {
    getAccessToken: () => overrides.token ?? null,
    getHomeserverUrl: () => overrides.homeserverUrl ?? 'https://hs.example.com'
  } as unknown as MatrixClient
}

describe('createUploadOptions', () => {
  it('should set type, name and includeFilename', () => {
    const opts = createUploadOptions('image/png', undefined, 'a.png', true)
    expect(opts.type).toBe('image/png')
    expect(opts.name).toBe('a.png')
    expect(opts.includeFilename).toBe(true)
    expect(opts.progressHandler).toBeUndefined()
  })

  it('should default includeFilename to true', () => {
    const opts = createUploadOptions('image/png')
    expect(opts.includeFilename).toBe(true)
  })

  it('should not include name when filename undefined', () => {
    const opts = createUploadOptions('image/png', undefined, undefined, true)
    expect(opts.name).toBeUndefined()
  })

  it('should report rounded percentage via progressHandler', () => {
    const onProgress = vi.fn()
    const opts = createUploadOptions('image/png', onProgress, undefined, true)

    opts.progressHandler?.({ loaded: 50, total: 100 })
    expect(onProgress).toHaveBeenCalledWith(50)

    opts.progressHandler?.({ loaded: 33, total: 100 })
    expect(onProgress).toHaveBeenCalledWith(33)
  })

  it('should skip progress reporting when total is 0', () => {
    const onProgress = vi.fn()
    const opts = createUploadOptions('image/png', onProgress, undefined, true)

    opts.progressHandler?.({ loaded: 10, total: 0 })
    expect(onProgress).not.toHaveBeenCalled()
  })
})

describe('isPayloadTooLarge', () => {
  it('should return true for httpStatus 413', () => {
    expect(isPayloadTooLarge({ httpStatus: 413 })).toBe(true)
  })

  it('should return true for errcode M_TOO_LARGE', () => {
    expect(isPayloadTooLarge({ errcode: 'M_TOO_LARGE' })).toBe(true)
  })

  it('should return false for other errors', () => {
    expect(isPayloadTooLarge({ httpStatus: 500 })).toBe(false)
    expect(isPayloadTooLarge(new Error('x'))).toBe(false)
    expect(isPayloadTooLarge(null)).toBe(false)
  })
})

describe('uploadViaDirectFetch', () => {
  beforeEach(() => {
    FakeXHR.instances = []
    globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest
  })

  afterEach(() => {
    globalThis.XMLHttpRequest = OriginalXHR
  })

  it('should POST to upload endpoint and resolve content_uri on 2xx', async () => {
    const client = createClient({ token: 'tok' })
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })

    const promise = uploadViaDirectFetch(client, file, { type: 'text/plain' })

    const xhr = FakeXHR.instances[0]
    expect(xhr.method).toBe('POST')
    expect(xhr.url).toContain('/_matrix/media/v3/upload')
    expect(xhr.url).toContain('filename=a.txt')
    expect(xhr.headers['Content-Type']).toBe('text/plain')
    expect(xhr.headers['Authorization']).toBe('Bearer tok')

    xhr.complete(200, '{"content_uri":"mxc://upload/x"}')
    await expect(promise).resolves.toBe('mxc://upload/x')
  })

  it('should default filename and mimetype when opts empty', async () => {
    const client = createClient({ token: null })
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })

    const promise = uploadViaDirectFetch(client, file, {})
    const xhr = FakeXHR.instances[0]
    expect(xhr.headers['Authorization']).toBeUndefined()
    xhr.complete(200, '{"content_uri":"mxc://o"}')
    await expect(promise).resolves.toBe('mxc://o')
  })

  it('should reject on non-2xx status', async () => {
    const client = createClient({ token: null })
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })

    const promise = uploadViaDirectFetch(client, file, {})
    const xhr = FakeXHR.instances[0]
    xhr.complete(500, 'server error')
    await expect(promise).rejects.toThrow('上传失败: 500')
  })
})

describe('uploadContentWithChunkFallback', () => {
  const upload = chunkUploadService.upload as ReturnType<typeof vi.fn>

  beforeEach(() => {
    upload.mockReset()
  })

  it('should return content_uri from MediaManager upload', async () => {
    const getMedia = () =>
      ({ uploadContent: vi.fn().mockResolvedValue({ content_uri: 'mxc://ok' }) }) as unknown as MediaManager
    const client = createClient()

    const result = await uploadContentWithChunkFallback(getMedia, client, new File(['x'], 'a.txt'), {})

    expect(result).toBe('mxc://ok')
  })

  it('should handle string upload response', async () => {
    const getMedia = () => ({ uploadContent: vi.fn().mockResolvedValue('mxc://str') }) as unknown as MediaManager
    const client = createClient()

    const result = await uploadContentWithChunkFallback(getMedia, client, new File(['x'], 'a.txt'), {})

    expect(result).toBe('mxc://str')
  })

  it('should fall back to chunk upload on 413', async () => {
    const getMedia = () =>
      ({ uploadContent: vi.fn().mockRejectedValue({ httpStatus: 413 }) }) as unknown as MediaManager
    upload.mockResolvedValue({ mxcUrl: 'mxc://chunk' })
    const client = createClient()

    const result = await uploadContentWithChunkFallback(getMedia, client, new File(['x'], 'a.txt'), {})

    expect(upload).toHaveBeenCalledTimes(1)
    expect(result).toBe('mxc://chunk')
  })

  it('should fall back to direct fetch on AbortError', async () => {
    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    const getMedia = () => ({ uploadContent: vi.fn().mockRejectedValue(abortError) }) as unknown as MediaManager
    const client = createClient({ token: null, homeserverUrl: 'https://hs.example.com' })

    FakeXHR.instances = []
    globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest

    const promise = uploadContentWithChunkFallback(getMedia, client, new File(['x'], 'a.txt'), {})
    await vi.waitFor(() => expect(FakeXHR.instances.length).toBeGreaterThan(0))
    FakeXHR.instances[0].complete(200, '{"content_uri":"mxc://direct"}')

    await expect(promise).resolves.toBe('mxc://direct')
    globalThis.XMLHttpRequest = OriginalXHR
  })

  it('should rethrow other errors', async () => {
    const getMedia = () => ({ uploadContent: vi.fn().mockRejectedValue(new Error('boom')) }) as unknown as MediaManager
    const client = createClient()

    await expect(uploadContentWithChunkFallback(getMedia, client, new File(['x'], 'a.txt'), {})).rejects.toThrow('boom')
  })
})
