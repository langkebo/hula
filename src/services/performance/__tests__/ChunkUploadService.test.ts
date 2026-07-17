import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/matrixClientAccessor', () => ({
  getMatrixAccessToken: () => 'tok-1',
  getMatrixHomeserverUrl: () => 'https://matrix.test'
}))
vi.mock('@/services/backend/config', () => ({
  resolveMatrixRuntimeEndpointConfig: () => ({ homeserverUrl: 'https://matrix.test' })
}))

import chunkUploadService from '../ChunkUploadService'

class FakeXHR {
  static instances: FakeXHR[] = []
  static failuresRemaining = 0
  upload = { onprogress: null as null | ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) }
  status = 200
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  url = ''
  open(_method: string, url: string) {
    this.url = url
  }
  setRequestHeader() {}
  send() {
    FakeXHR.instances.push(this)
    if (FakeXHR.failuresRemaining > 0) {
      FakeXHR.failuresRemaining--
      this.status = 500
    }
    queueMicrotask(() => this.onload?.())
  }
}

const fetchMock = vi.fn()

const okJson = (body: unknown) => ({ ok: true, json: async () => body, text: async () => '' }) as unknown as Response

beforeEach(() => {
  FakeXHR.instances = []
  FakeXHR.failuresRemaining = 0
  fetchMock.mockReset()
  vi.stubGlobal('XMLHttpRequest', FakeXHR)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const makeFile = () => new File([new Uint8Array(10)], 'big.bin', { type: 'application/octet-stream' })

describe('ChunkUploadService', () => {
  it('start/complete 端点 URL 含合法主机与 /_matrix 前缀', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ upload_id: 'u1', chunk_size_limit: 1, max_file_size: 1 }))
      .mockResolvedValueOnce(okJson({ content_uri: 'mxc://hs/x', size: 10 }))

    const result = await chunkUploadService.upload({ file: makeFile(), chunkSize: 10 })

    expect(fetchMock.mock.calls[0][0]).toBe('https://matrix.test/_matrix/media/v1/upload/chunk/start')
    expect(fetchMock.mock.calls[1][0]).toBe('https://matrix.test/_matrix/media/v1/upload/chunk/complete')
    expect(FakeXHR.instances[0].url).toContain('https://matrix.test/_matrix/media/v1/upload/chunk?')
    expect(result.mxcUrl).toBe('mxc://hs/x')
  })

  it('chunk 重试耗尽后上传失败并调用 cancel 端点', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ upload_id: 'u2', chunk_size_limit: 1, max_file_size: 1 }))
      .mockResolvedValueOnce(okJson({}))
    FakeXHR.failuresRemaining = 99

    await expect(chunkUploadService.upload({ file: makeFile(), chunkSize: 10, maxRetries: 2 })).rejects.toThrow()

    expect(fetchMock.mock.calls[1][0]).toBe('https://matrix.test/_matrix/media/v1/upload/chunk/cancel')
  })
})
