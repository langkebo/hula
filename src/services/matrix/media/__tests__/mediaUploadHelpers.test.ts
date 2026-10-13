import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chunkUploadService } from '@/services/performance/ChunkUploadService'
import type { MediaManager } from '../../sdk'
import {
  createUploadOptions,
  isPayloadTooLarge,
  uploadContentWithChunkFallback,
  uploadViaGateway
} from '../mediaUploadHelpers'

const { uploadRawMock } = vi.hoisted(() => ({ uploadRawMock: vi.fn() }))

vi.mock('@/services/performance/ChunkUploadService', () => ({
  chunkUploadService: {
    upload: vi.fn()
  }
}))

// 网关直传通道：这里只断言「调用形态 + 参数」；真实的 URL/鉴权/错误归一化语义
// 在 src/services/matrix/__tests__/MatrixRawUploadChannel.test.ts 里单独覆盖。
vi.mock('../../MatrixHttpClient', () => ({
  matrixHttpClient: { uploadRaw: (...args: unknown[]) => uploadRawMock(...args) }
}))

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

describe('uploadViaGateway（经 MatrixHttpClient，无自建 XHR）', () => {
  beforeEach(() => {
    uploadRawMock.mockReset()
    uploadRawMock.mockResolvedValue({ content_uri: 'mxc://upload/x' })
  })

  it('POST 到 media v3 upload，并把 filename / content_type 作为查询参数', async () => {
    const file = new File(['x'], 'a.txt', { type: 'text/plain' })

    await expect(uploadViaGateway(file, { type: 'text/plain' })).resolves.toBe('mxc://upload/x')

    expect(uploadRawMock).toHaveBeenCalledTimes(1)
    const [path, body, options] = uploadRawMock.mock.calls[0]
    expect(path).toBe('_matrix/media/v3/upload')
    expect(body).toBe(file)
    expect(options).toMatchObject({
      contentType: 'text/plain',
      queryParams: { filename: 'a.txt', content_type: 'text/plain' }
    })
    // Authorization / dev 同源改写都归网关，调用点不再自己拼
    expect(options.headers).toBeUndefined()
    expect(options.signal).toBeUndefined()
  })

  it('opts 为空时回退到文件自身的 name / type', async () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' })

    await uploadViaGateway(file, {})

    expect(uploadRawMock.mock.calls[0][2]).toMatchObject({
      contentType: 'application/pdf',
      queryParams: { filename: 'doc.pdf', content_type: 'application/pdf' }
    })
  })

  it('文件无类型时用 application/octet-stream 兜底', async () => {
    const file = new File(['x'], 'blob.bin')

    await uploadViaGateway(file, {})

    expect(uploadRawMock.mock.calls[0][2].contentType).toBe('application/octet-stream')
  })

  it('响应缺少 content_uri ⇒ 抛错（不静默返回 undefined）', async () => {
    uploadRawMock.mockResolvedValue({})

    await expect(uploadViaGateway(new File(['x'], 'a.txt'), {})).rejects.toThrow('上传响应缺少 content_uri')
  })

  it('网关抛出的错误原样冒泡（保留 httpStatus 供上层分流）', async () => {
    const tooLarge = Object.assign(new Error('too big'), { httpStatus: 413, errcode: 'M_TOO_LARGE' })
    uploadRawMock.mockRejectedValue(tooLarge)

    await expect(uploadViaGateway(new File(['x'], 'a.txt'), {})).rejects.toBe(tooLarge)
  })
})

describe('uploadContentWithChunkFallback', () => {
  const upload = chunkUploadService.upload as ReturnType<typeof vi.fn>

  beforeEach(() => {
    upload.mockReset()
    uploadRawMock.mockReset()
  })

  it('should return content_uri from MediaManager upload', async () => {
    const getMedia = () =>
      ({ uploadContent: vi.fn().mockResolvedValue({ content_uri: 'mxc://ok' }) }) as unknown as MediaManager

    await expect(uploadContentWithChunkFallback(getMedia, new File(['x'], 'a.txt'), {})).resolves.toBe('mxc://ok')
  })

  it('should handle string upload response', async () => {
    const getMedia = () => ({ uploadContent: vi.fn().mockResolvedValue('mxc://str') }) as unknown as MediaManager

    await expect(uploadContentWithChunkFallback(getMedia, new File(['x'], 'a.txt'), {})).resolves.toBe('mxc://str')
  })

  it('should fall back to chunk upload on 413', async () => {
    const getMedia = () =>
      ({ uploadContent: vi.fn().mockRejectedValue({ httpStatus: 413 }) }) as unknown as MediaManager
    upload.mockResolvedValue({ mxcUrl: 'mxc://chunk' })

    await expect(uploadContentWithChunkFallback(getMedia, new File(['x'], 'a.txt'), {})).resolves.toBe('mxc://chunk')
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('SDK 抛 AbortError ⇒ 回退到网关直传（不再自建 XHR）', async () => {
    const abortError = new Error('aborted')
    abortError.name = 'AbortError'
    const getMedia = () => ({ uploadContent: vi.fn().mockRejectedValue(abortError) }) as unknown as MediaManager
    uploadRawMock.mockResolvedValue({ content_uri: 'mxc://direct' })

    await expect(uploadContentWithChunkFallback(getMedia, new File(['x'], 'a.txt'), {})).resolves.toBe('mxc://direct')

    expect(uploadRawMock).toHaveBeenCalledTimes(1)
    expect(uploadRawMock.mock.calls[0][0]).toBe('_matrix/media/v3/upload')
  })

  it('should rethrow other errors', async () => {
    const getMedia = () => ({ uploadContent: vi.fn().mockRejectedValue(new Error('boom')) }) as unknown as MediaManager

    await expect(uploadContentWithChunkFallback(getMedia, new File(['x'], 'a.txt'), {})).rejects.toThrow('boom')
  })
})
