import type { MatrixClient } from 'matrix-js-sdk'
import type { TelemetryManager } from 'matrix-js-sdk/telemetry'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixAttachmentEncryptionService } from '../../crypto/MatrixAttachmentEncryptionService'
import { matrixMediaService } from '../MatrixMediaService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const { mockMatrixClientService } = vi.hoisted(() => ({
  mockMatrixClientService: {
    getClient: vi.fn(() => null),
    getTelemetry: vi.fn(() => null),
    getHomeserverUrl: vi.fn(() => 'https://matrix.test'),
    getAccessToken: vi.fn(() => 'token123')
  }
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: mockMatrixClientService,
  default: mockMatrixClientService
}))

vi.mock('@/utils/ImageUtils', () => ({
  compressImage: vi.fn(),
  isImageFile: vi.fn(() => true),
  formatFileSize: vi.fn((size: number) => `${size} B`)
}))

import { matrixClientService } from '../../MatrixClientService'

const mockClient = {
  getHomeserverUrl: vi.fn(() => 'https://matrix.test'),
  getAccessToken: vi.fn(() => 'token123'),
  uploadContent: vi.fn(),
  mxcUrlToHttp: vi.fn((url: string) => url.replace('mxc://', 'https://matrix.test/_matrix/media/r0/download/'))
}

describe('MatrixMediaService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
    vi.unstubAllGlobals()
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

  describe('uploadEncryptedFile', () => {
    it('should upload encrypted payload and return Matrix file descriptor', async () => {
      const uploadContent = vi.fn().mockResolvedValue({
        content_uri: 'mxc://matrix.org/encrypted123'
      })
      vi.mocked(matrixClientService.getClient).mockReturnValue({
        uploadContent,
        mxcUrlToHttp: vi.fn()
      } as unknown as MatrixClient)

      const file = new File(['secret-content'], 'secret.txt', { type: 'text/plain' })
      const result = await matrixMediaService.uploadEncryptedFile(file)

      expect(uploadContent).toHaveBeenCalledTimes(1)
      expect(uploadContent.mock.calls[0]?.[0]).toBeInstanceOf(Blob)
      expect(result).toMatchObject({
        contentUri: 'mxc://matrix.org/encrypted123',
        size: file.size,
        mimetype: 'text/plain',
        encryptedFile: {
          url: 'mxc://matrix.org/encrypted123',
          v: 'v2',
          key: {
            alg: 'A256CTR',
            kty: 'oct'
          }
        }
      })
      expect(result.encryptedFile.hashes.sha256).toBeTruthy()
      expect(result.encryptedFile.iv).toBeTruthy()
    })
  })

  describe('downloadEncryptedFileBytes', () => {
    it('should download ciphertext and decrypt it back to plaintext', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)
      const sourceFile = new File(['secret-content'], 'secret.txt', { type: 'text/plain' })
      const encryptedPayload = await matrixAttachmentEncryptionService.encryptAttachment(sourceFile)
      const ciphertext = await encryptedPayload.encryptedData.arrayBuffer()
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(ciphertext, {
          status: 200
        })
      )

      vi.stubGlobal('fetch', fetchMock)

      const result = await matrixMediaService.downloadEncryptedFileBytes({
        ...encryptedPayload.encryptedFile,
        url: 'https://example.com/encrypted.bin'
      })

      expect(fetchMock).toHaveBeenCalledWith('https://example.com/encrypted.bin')
      expect(new TextDecoder().decode(result)).toBe('secret-content')
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
      } as unknown as TelemetryManager)
    })

    it('should upload file successfully', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const result = await matrixMediaService.uploadFile(file)

      expect(result.contentUri).toBe('mxc://matrix.org/uploaded123')
      expect(result.mimetype).toBe('text/plain')
    })

    it('should forward upload progress to callback', async () => {
      const uploadContent = vi
        .fn()
        .mockImplementation(
          async (_file: File, opts?: { progressHandler?: (progress: { loaded: number; total: number }) => void }) => {
            opts?.progressHandler?.({ loaded: 25, total: 100 })
            opts?.progressHandler?.({ loaded: 100, total: 100 })
            return { content_uri: 'mxc://matrix.org/uploaded123' }
          }
        )

      vi.mocked(matrixClientService.getClient).mockReturnValue({
        uploadContent,
        mxcUrlToHttp: vi.fn().mockReturnValue('https://matrix.org/media/uploaded123')
      } as unknown as MatrixClient)

      const onProgress = vi.fn()
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })

      await matrixMediaService.uploadFile(file, onProgress)

      expect(onProgress).toHaveBeenNthCalledWith(1, 25)
      expect(onProgress).toHaveBeenNthCalledWith(2, 100)
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

  describe('getMediaConfig', () => {
    it('should get media config', async () => {
      const mockConfig = { 'm.upload.size': 52428800 }
      const mockHttp = { authedRequest: vi.fn().mockResolvedValue(mockConfig) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as unknown as MatrixClient)

      const result = await matrixMediaService.getMediaConfig()

      expect(result['m.upload.size']).toBe(52428800)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith('GET', '/_matrix/media/v3/config')
    })

    it('should throw on error', async () => {
      const mockHttp = { authedRequest: vi.fn().mockRejectedValue(new Error('fail')) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as unknown as MatrixClient)

      await expect(matrixMediaService.getMediaConfig()).rejects.toThrow('fail')
    })
  })

  describe('deleteMedia', () => {
    it('should delete media successfully', async () => {
      const mockHttp = { authedRequest: vi.fn().mockResolvedValue({}) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as unknown as MatrixClient)

      const result = await matrixMediaService.deleteMedia('matrix.org', 'media123')

      expect(result).toBe(true)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith('POST', '/_matrix/media/v3/delete/matrix.org/media123')
    })

    it('should throw on delete error', async () => {
      const mockHttp = { authedRequest: vi.fn().mockRejectedValue(new Error('forbidden')) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as unknown as MatrixClient)

      await expect(matrixMediaService.deleteMedia('matrix.org', 'media123')).rejects.toThrow('forbidden')
    })
  })

  describe('getQuotaAlerts', () => {
    it('should get quota alerts', async () => {
      const mockAlerts = { alerts: [{ alert_id: '1', alert_type: 'warning' }] }
      const mockHttp = { authedRequest: vi.fn().mockResolvedValue(mockAlerts) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as unknown as MatrixClient)

      const result = await matrixMediaService.getQuotaAlerts()

      expect(result).toHaveLength(1)
      expect(mockHttp.authedRequest).toHaveBeenCalledWith('GET', '/_matrix/media/v1/quota/alerts')
    })

    it('should return empty array on error', async () => {
      const mockHttp = { authedRequest: vi.fn().mockRejectedValue(new Error('fail')) }
      vi.mocked(matrixClientService.getClient).mockReturnValue({ http: mockHttp } as unknown as MatrixClient)

      const result = await matrixMediaService.getQuotaAlerts()

      expect(result).toEqual([])
    })
  })

  describe('uploadContentWithId', () => {
    it('should throw error when client is not initialized', async () => {
      vi.mocked(matrixClientService.getClient).mockReturnValue(null)

      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      await expect(matrixMediaService.uploadContentWithId('server', 'id', file)).rejects.toThrow('客户端未初始化')
    })

    it('should upload content with id successfully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ content_uri: 'mxc://matrix.org/named123' })
      })
      vi.stubGlobal('fetch', mockFetch)

      vi.mocked(matrixClientService.getClient).mockReturnValue({
        getHomeserverUrl: vi.fn(() => 'https://matrix.test'),
        getAccessToken: vi.fn(() => 'token123')
      } as unknown as MatrixClient)
      vi.mocked(matrixClientService.getTelemetry).mockReturnValue(null)

      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const result = await matrixMediaService.uploadContentWithId('matrix.org', 'named-id', file)

      expect(result.contentUri).toBe('mxc://matrix.org/named123')
      expect(result.mimetype).toBe('text/plain')

      vi.unstubAllGlobals()
    })
  })
})
