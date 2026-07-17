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
