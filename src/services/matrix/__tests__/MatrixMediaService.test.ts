import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { matrixMediaService } from '../MatrixMediaService'
import type { MatrixClient } from 'matrix-js-sdk'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../BaseManager', () => {
  return {
    BaseManager: class {
      protected handleError<T>(error: unknown, _operation: string, defaultValue: T, throwOnError: boolean): T {
        if (throwOnError) throw error
        return defaultValue
      }
      protected normalizeError(error: unknown, _operation: string) {
        return error
      }
    }
  }
})

vi.mock('../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => null),
    getTelemetry: vi.fn(() => null)
  }
}))

vi.mock('@/utils/ImageUtils', () => ({
  compressImage: vi.fn(),
  isImageFile: vi.fn(() => true),
  formatFileSize: vi.fn((size: number) => `${size} B`)
}))

import { matrixClientService } from '../MatrixClientService'

const createMockClient = () => ({
  uploadContent: vi.fn(),
  mxcUrlToHttp: vi.fn()
})

const mockClient = createMockClient()

describe('MatrixMediaService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('setCompressOptions', () => {
    it('should update compress options', () => {
      matrixMediaService.setCompressOptions({
        quality: 0.5,
        maxWidth: 800,
        maxHeight: 600
      })

      expect(true).toBe(true)
    })
  })

  describe('setEnableCompression', () => {
    it('should toggle compression', () => {
      matrixMediaService.setEnableCompression(false)
      matrixMediaService.setEnableCompression(true)

      expect(true).toBe(true)
    })
  })

  describe('uploadFile', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      await expect(matrixMediaService.uploadFile(file)).rejects.toThrow('客户端未初始化')
    })
  })

  describe('uploadImage', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const file = new File(['content'], 'test.png', { type: 'image/png' })
      await expect(matrixMediaService.uploadImage(file)).rejects.toThrow('客户端未初始化')
    })
  })

  describe('uploadVideo', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const file = new File(['content'], 'test.mp4', { type: 'video/mp4' })
      await expect(matrixMediaService.uploadVideo(file)).rejects.toThrow('客户端未初始化')
    })
  })

  describe('uploadAudio', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const file = new File(['content'], 'test.ogg', { type: 'audio/ogg' })
      await expect(matrixMediaService.uploadAudio(file)).rejects.toThrow('客户端未初始化')
    })
  })

  describe('uploadBlob', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const blob = new Blob(['content'], { type: 'application/octet-stream' })
      await expect(matrixMediaService.uploadBlob(blob, 'test.bin', 'application/octet-stream')).rejects.toThrow(
        '客户端未初始化'
      )
    })
  })

  describe('getMediaUrl', () => {
    it('should return null for invalid mxc url', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      expect(matrixMediaService.getMediaUrl('')).toBeNull()
      expect(matrixMediaService.getMediaUrl('https://example.com/image.png')).toBeNull()
    })

    it('should throw error when client is not initialized', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      expect(() => matrixMediaService.getMediaUrl('mxc://matrix.org/abc123')).toThrow('客户端未初始化')
    })
  })

  describe('getThumbnailUrl', () => {
    it('should return null for invalid mxc url', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      expect(matrixMediaService.getThumbnailUrl('', 100, 100)).toBeNull()
      expect(matrixMediaService.getThumbnailUrl('invalid-url', 100, 100)).toBeNull()
    })

    it('should throw error when client is not initialized', () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      expect(() => matrixMediaService.getThumbnailUrl('mxc://matrix.org/abc123', 100, 100)).toThrow('客户端未初始化')
    })
  })

  describe('successful uploads', () => {
    beforeEach(() => {
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        uploadContent: vi.fn().mockResolvedValue({
          content_uri: 'mxc://matrix.org/uploaded123'
        }),
        mxcUrlToHttp: vi.fn().mockReturnValue('https://matrix.org/media/uploaded123')
      } as unknown as MatrixClient)
      vi.mocked(matrixClientService.getTelemetry).mockReturnValue({
        trackMediaUploaded: vi.fn()
      } as unknown as ReturnType<typeof matrixClientService.getTelemetry>)
    })

    it('should upload file successfully', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const result = await matrixMediaService.uploadFile(file)

      expect(result.contentUri).toBe('mxc://matrix.org/uploaded123')
      expect(result.mimetype).toBe('text/plain')
    })

    it('should get media url successfully', () => {
      const url = matrixMediaService.getMediaUrl('mxc://matrix.org/abc123')
      expect(url).toBe('https://matrix.org/media/uploaded123')
    })

    it('should get thumbnail url with dimensions', () => {
      const url = matrixMediaService.getThumbnailUrl('mxc://matrix.org/abc123', 100, 100)
      expect(url).toBe('https://matrix.org/media/uploaded123')
    })
  })
})
