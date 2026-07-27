import { beforeEach, describe, expect, it, vi } from 'vitest'

const { uploadContentMock, chunkUploadMock } = vi.hoisted(() => ({
  uploadContentMock: vi.fn(),
  chunkUploadMock: vi.fn()
}))

vi.mock('../../MatrixClientService', () => {
  const svc = {
    getClient: () => ({
      uploadContent: uploadContentMock,
      mxcUrlToHttp: () => null,
      http: { authedRequest: vi.fn() }
    }),
    getTelemetry: () => null
  }
  return { default: svc, matrixClientService: svc }
})

vi.mock('@/services/performance/ChunkUploadService', () => ({
  chunkUploadService: { upload: chunkUploadMock },
  default: { upload: chunkUploadMock }
}))

import { matrixMediaService } from '../MatrixMediaService'

const bigFile = new File([new Uint8Array(8)], 'big.bin', { type: 'application/octet-stream' })

describe('MatrixMediaService 413 分片回退', () => {
  beforeEach(() => {
    uploadContentMock.mockReset()
    chunkUploadMock.mockReset()
  })

  it('uploadFile 遇 413 回退分片上传并返回其 mxcUrl', async () => {
    uploadContentMock.mockRejectedValueOnce(Object.assign(new Error('too large'), { httpStatus: 413 }))
    chunkUploadMock.mockResolvedValueOnce({
      mxcUrl: 'mxc://hs/chunked',
      filename: 'big.bin',
      size: 8,
      mimeType: 'application/octet-stream'
    })

    const result = await matrixMediaService.uploadFile(bigFile)

    expect(chunkUploadMock).toHaveBeenCalledTimes(1)
    expect(result.contentUri).toBe('mxc://hs/chunked')
  })

  it('errcode M_TOO_LARGE 同样触发回退', async () => {
    uploadContentMock.mockRejectedValueOnce(Object.assign(new Error('too large'), { errcode: 'M_TOO_LARGE' }))
    chunkUploadMock.mockResolvedValueOnce({
      mxcUrl: 'mxc://hs/chunked2',
      filename: 'big.bin',
      size: 8,
      mimeType: 'application/octet-stream'
    })

    const result = await matrixMediaService.uploadFile(bigFile)
    expect(result.contentUri).toBe('mxc://hs/chunked2')
  })

  it('非 413 错误原样抛出且不触发分片', async () => {
    uploadContentMock.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { httpStatus: 403 }))

    await expect(matrixMediaService.uploadFile(bigFile)).rejects.toThrow('forbidden')
    expect(chunkUploadMock).not.toHaveBeenCalled()
  })
})

describe('MatrixMediaService uploadLargeFile 主动分块上传 (§9.4.1)', () => {
  beforeEach(() => {
    uploadContentMock.mockReset()
    chunkUploadMock.mockReset()
  })

  it('uploadLargeFile 直接调用分块上传服务，不走 client.uploadContent', async () => {
    chunkUploadMock.mockResolvedValueOnce({
      mxcUrl: 'mxc://hs/large-file',
      filename: 'large.bin',
      size: 15 * 1024 * 1024,
      mimeType: 'application/octet-stream'
    })

    const largeFile = new File([new Uint8Array(16)], 'large.bin', { type: 'application/octet-stream' })
    const result = await matrixMediaService.uploadLargeFile(largeFile)

    expect(chunkUploadMock).toHaveBeenCalledTimes(1)
    expect(uploadContentMock).not.toHaveBeenCalled()
    expect(result.contentUri).toBe('mxc://hs/large-file')
    expect(result.size).toBe(largeFile.size)
  })

  it('uploadLargeFile 透传进度回调', async () => {
    chunkUploadMock.mockImplementationOnce(async (opts) => {
      opts.onProgress?.({ percentage: 42 } as never)
      return {
        mxcUrl: 'mxc://hs/large-file-2',
        filename: 'large.bin',
        size: 12 * 1024 * 1024,
        mimeType: 'application/octet-stream'
      }
    })

    const onProgress = vi.fn()
    const largeFile = new File([new Uint8Array(16)], 'large.bin', { type: 'application/octet-stream' })
    await matrixMediaService.uploadLargeFile(largeFile, onProgress)

    expect(onProgress).toHaveBeenCalledWith(42)
  })
})
