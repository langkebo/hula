import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UploadProviderEnum, useUpload } from '../useUpload'

vi.mock('@tauri-apps/api/core', () => ({
  Channel: vi.fn(() => ({ onmessage: null })),
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppData: 'AppData', AppCache: 'AppCache' },
  stat: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: vi.fn(() => ({
    userInfo: { account: 'test-user', uid: 'test-uid' }
  }))
}))

vi.mock('@/services/UploadService', () => ({
  uploadService: {
    getUploadProvider: vi.fn(),
    getOssToken: vi.fn()
  }
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: vi.fn(() => false),
  isAndroid: vi.fn(() => false)
}))

vi.mock('@/utils/ImageUtils', () => ({
  getImageDimensions: vi.fn()
}))

vi.mock('@/utils/TempFileManager', () => ({
  removeTempFile: vi.fn()
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    error: vi.fn()
  }))
}))

describe('useUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.window = { $message: { error: vi.fn() } } as any
  })

  it('should initialize with default values', () => {
    const { isUploading, progress, fileInfo } = useUpload()
    expect(isUploading.value).toBe(false)
    expect(progress.value).toBe(0)
    expect(fileInfo.value).toBeNull()
  })

  it('should parse image file with dimensions', async () => {
    const { getImageDimensions } = await import('@/utils/ImageUtils')
    vi.mocked(getImageDimensions).mockResolvedValue({
      width: 800,
      height: 600,
      previewUrl: 'blob:test'
    })

    const { parseFile } = useUpload()
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const result = await parseFile(file)

    expect(result).toMatchObject({
      name: 'test.png',
      type: 'image/png',
      suffix: 'png',
      width: 800,
      height: 600
    })
  })

  it('should parse video file', async () => {
    const { parseFile } = useUpload()
    const file = new File(['test'], 'test.mp4', { type: 'video/mp4' })

    const result = await parseFile(file)
    expect(result).toMatchObject({
      name: 'test.mp4',
      type: 'video/mp4',
      suffix: 'mp4'
    })
  })

  it('should reject file larger than max size', async () => {
    const largeSize = 600 * 1024 * 1024
    const largeFile = new File(['test'], 'large.txt', { type: 'text/plain' })
    Object.defineProperty(largeFile, 'size', { value: largeSize })

    const { uploadService } = await import('@/services/UploadService')
    vi.mocked(uploadService.getOssToken).mockResolvedValue({
      uploadUrl: 'http://test.com/upload',
      downloadUrl: 'http://test.com/download',
      objectKey: 'test-key'
    })

    const { uploadFile } = useUpload()
    await uploadFile(largeFile)
    expect(window.$message.error).toHaveBeenCalledWith('文件大小不能超过 500MB')
  })

  it('should resolve upload provider', async () => {
    const { uploadService } = await import('@/services/UploadService')
    vi.mocked(uploadService.getUploadProvider).mockResolvedValue({ provider: 'minio' })

    const { uploadFile } = useUpload()
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })

    vi.mocked(uploadService.getOssToken).mockResolvedValue({
      uploadUrl: 'http://test.com/upload',
      downloadUrl: 'http://test.com/download',
      objectKey: 'test-key'
    })

    const { invoke } = await import('@tauri-apps/api/core')
    vi.mocked(invoke).mockResolvedValue(undefined)

    await uploadFile(file, { provider: UploadProviderEnum.MINIO })
    expect(uploadService.getOssToken).toHaveBeenCalled()
  })

  it('should generate hash key with deduplication', async () => {
    const { generateHashKey } = useUpload()
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })

    const key = await generateHashKey({ scene: 1 as any, enableDeduplication: true }, file, 'test.txt')

    expect(key).toMatch(/^1\/test-user\/[a-f0-9]+\.txt$/)
  })

  it('should generate timestamp key without deduplication', async () => {
    const { generateHashKey } = useUpload()
    const file = new File(['test'], 'test.txt', { type: 'text/plain' })

    const key = await generateHashKey({ scene: 1 as any, enableDeduplication: false }, file, 'test.txt')

    expect(key).toMatch(/^1\/\d+_test\.txt$/)
  })

  it('should get upload and download URLs', async () => {
    const { uploadService } = await import('@/services/UploadService')
    vi.mocked(uploadService.getOssToken).mockResolvedValue({
      uploadUrl: 'http://test.com/upload',
      downloadUrl: 'http://test.com/download',
      objectKey: 'test-key'
    })

    const { getUploadAndDownloadUrl } = useUpload()
    const result = await getUploadAndDownloadUrl('/path/to/file.txt')

    expect(result).toMatchObject({
      uploadUrl: 'http://test.com/upload',
      downloadUrl: 'http://test.com/download'
    })
  })

  it('should trigger onChange event on progress', async () => {
    const { uploadService } = await import('@/services/UploadService')
    vi.mocked(uploadService.getOssToken).mockResolvedValue({
      uploadUrl: 'http://test.com/upload',
      downloadUrl: 'http://test.com/download',
      objectKey: 'test-key'
    })

    const { onChange, uploadFile } = useUpload()
    const callback = vi.fn()
    onChange(callback)

    const file = new File(['test'], 'test.txt', { type: 'text/plain' })
    const uploadPromise = uploadFile(file)

    await new Promise((resolve) => setTimeout(resolve, 0))
    await uploadPromise
  })
})
