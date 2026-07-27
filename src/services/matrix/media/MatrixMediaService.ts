import type { MatrixClient } from 'matrix-js-sdk'
import {
  type MatrixEncryptedAttachmentLike,
  matrixAttachmentDecryptionService
} from '@/services/matrix/crypto/MatrixAttachmentDecryptionService'
import {
  type EncryptedAttachmentFile,
  matrixAttachmentEncryptionService
} from '@/services/matrix/crypto/MatrixAttachmentEncryptionService'
import { chunkUploadService } from '@/services/performance/ChunkUploadService'
import { HttpClient, HttpClientError } from '@/utils/HttpClient'
import { compressImage, formatFileSize, isImageFile } from '@/utils/ImageUtils'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'
import { authedRequestWithPath } from '../MatrixHttpClient'
import { MATRIX_PATHS } from '../paths'

const logger = createLogger('MatrixMediaService')

interface UploadResult {
  contentUri: string
  size: number
  mimetype: string
}

interface EncryptedUploadResult extends UploadResult {
  encryptedFile: EncryptedAttachmentFile
}

interface MediaInfo {
  size: number
  mimetype: string
  width?: number
  height?: number
  duration?: number
}

interface CompressOptions {
  quality?: number
  maxWidth?: number
  maxHeight?: number
  maxSizeKB?: number
}

const DEFAULT_COMPRESS_OPTIONS: CompressOptions = {
  quality: 0.8,
  maxWidth: 1920,
  maxHeight: 1920,
  maxSizeKB: 1024
}

class MatrixMediaServiceClass extends BaseMatrixService {
  private compressOptions: CompressOptions = { ...DEFAULT_COMPRESS_OPTIONS }
  private enableCompression = true

  private createUploadOptions(
    mimetype: string | undefined,
    onProgress?: (progress: number) => void,
    filename?: string,
    includeFilename: boolean = true
  ): {
    type?: string
    name?: string
    includeFilename?: boolean
    progressHandler?: (progress: { loaded: number; total: number }) => void
  } {
    return {
      type: mimetype,
      name: filename,
      includeFilename,
      progressHandler: onProgress
        ? ({ loaded, total }) => {
            if (!total) {
              return
            }

            const percentage = Math.min(100, Math.max(0, Math.round((loaded / total) * 100)))
            onProgress(percentage)
          }
        : undefined
    }
  }

  setCompressOptions(options: CompressOptions) {
    this.compressOptions = { ...DEFAULT_COMPRESS_OPTIONS, ...options }
  }

  setEnableCompression(enable: boolean) {
    this.enableCompression = enable
  }

  private isPayloadTooLarge(err: unknown): boolean {
    const e = err as { httpStatus?: number; errcode?: string }
    return e?.httpStatus === 413 || e?.errcode === 'M_TOO_LARGE'
  }

  private async uploadContentWithChunkFallback(
    client: MatrixClient,
    file: File,
    opts: ReturnType<MatrixMediaServiceClass['createUploadOptions']>,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      const uploadResponse = await client.uploadContent(file, opts)
      return typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
    } catch (err) {
      if (!this.isPayloadTooLarge(err)) throw err
      logger.warn(`[MatrixMedia] 上传返回 413,回退到分片上传: ${file.name}`)
      const result = await chunkUploadService.upload({
        file,
        onProgress: (p) => onProgress?.(p.percentage)
      })
      return result.mxcUrl
    }
  }

  private resolveDownloadUrl(mediaUrl: string): string {
    if (!mediaUrl) {
      throw new Error(this.t('matrix_error.media.url_empty'))
    }

    if (mediaUrl.startsWith('mxc://')) {
      const downloadUrl = this.getMediaUrl(mediaUrl)
      if (!downloadUrl) {
        throw new Error(this.t('matrix_error.media.url_parse_failed', { mediaUrl }))
      }
      return downloadUrl
    }

    return mediaUrl
  }

  async downloadFileBytes(mediaUrl: string): Promise<Uint8Array> {
    const client = this.getClient()
    const downloadUrl = this.resolveDownloadUrl(mediaUrl)

    const accessToken = client.getAccessToken()
    if (accessToken && downloadUrl.startsWith(client.getHomeserverUrl())) {
      try {
        const buffer = await HttpClient.downloadBytes(downloadUrl, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
        })
        return new Uint8Array(buffer)
      } catch (err) {
        if (err instanceof HttpClientError && err.status === 404 && accessToken) {
          // Fallback: try authenticated download endpoint (MSC3916)
          const mxcMatch = mediaUrl.match(/^mxc:\/\/([^/]+)\/(.+)$/)
          if (mxcMatch) {
            const serverName = mxcMatch[1]
            const mediaId = mxcMatch[2]
            const authDownloadUrl = `${client.getHomeserverUrl()}_matrix/client/v1/media/download/${encodeURIComponent(serverName)}/${encodeURIComponent(mediaId)}`
            try {
              const buffer = await HttpClient.downloadBytes(authDownloadUrl, {
                headers: { Authorization: `Bearer ${accessToken}` }
              })
              return new Uint8Array(buffer)
            } catch {
              // fall through to error
            }
          }
          // Last fallback: access_token in query (only if all else fails)
          const separator = downloadUrl.includes('?') ? '&' : '?'
          const queryUrl = `${downloadUrl}${separator}access_token=${encodeURIComponent(accessToken)}`
          const buffer = await HttpClient.downloadBytes(queryUrl)
          return new Uint8Array(buffer)
        }
        throw err
      }
    }

    const buffer = await HttpClient.downloadBytes(downloadUrl)
    return new Uint8Array(buffer)
  }

  async downloadEncryptedFileBytes(encryptedFile: MatrixEncryptedAttachmentLike): Promise<Uint8Array> {
    const parsedEncryptedFile = matrixAttachmentDecryptionService.parseEncryptedFile(encryptedFile)
    const ciphertext = await this.downloadFileBytes(parsedEncryptedFile.url)
    return matrixAttachmentDecryptionService.decryptAttachment(ciphertext, parsedEncryptedFile)
  }

  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
    const client = this.getClient()

    try {
      const contentUri = await this.uploadContentWithChunkFallback(
        client,
        file,
        this.createUploadOptions(file.type, onProgress, file.name),
        onProgress
      )
      logger.info(`[MatrixMedia] 文件上传成功: ${contentUri}`)

      // 记录遥测
      const telemetry = matrixClientService.getTelemetry()
      if (telemetry) {
        telemetry.trackMediaUploaded(file.size, file.type || 'application/octet-stream')
      }

      return {
        contentUri,
        size: file.size,
        mimetype: file.type || 'application/octet-stream'
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 文件上传失败: ${err}`)
      throw err
    }
  }

  /**
   * 主动分块上传大文件 (§9.4.1)
   * 阈值：文件 ≥ 10MB 时应优先调用此方法，避免触发 413 后再回退。
   * 复用 ChunkUploadService 现有的 413 自动半分重试机制。
   */
  async uploadLargeFile(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
    try {
      const result = await chunkUploadService.upload({
        file,
        onProgress: (p) => onProgress?.(p.percentage)
      })
      logger.info(`[MatrixMedia] 大文件分块上传成功: ${result.mxcUrl}`)

      const telemetry = matrixClientService.getTelemetry()
      if (telemetry) {
        telemetry.trackMediaUploaded(file.size, file.type || 'application/octet-stream')
      }

      return {
        contentUri: result.mxcUrl,
        size: file.size,
        mimetype: file.type || 'application/octet-stream'
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 大文件分块上传失败: ${err}`)
      throw err
    }
  }

  async uploadEncryptedFile(file: File, onProgress?: (progress: number) => void): Promise<EncryptedUploadResult> {
    const client = this.getClient()

    try {
      const encryptedPayload = await matrixAttachmentEncryptionService.encryptAttachment(file)
      const encryptedBlobFile = new File([encryptedPayload.encryptedData as unknown as BlobPart], file.name, {
        type: 'application/octet-stream'
      })
      const contentUri = await this.uploadContentWithChunkFallback(
        client,
        encryptedBlobFile,
        this.createUploadOptions('application/octet-stream', onProgress, file.name, false),
        onProgress
      )
      logger.info(`[MatrixMedia] 加密文件上传成功: ${contentUri}`)

      return {
        contentUri,
        size: file.size,
        mimetype: file.type || 'application/octet-stream',
        encryptedFile: {
          ...encryptedPayload.encryptedFile,
          url: contentUri
        }
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 加密文件上传失败: ${err}`)
      throw err
    }
  }

  async uploadImage(file: File, onProgress?: (progress: number) => void): Promise<UploadResult & MediaInfo> {
    const client = this.getClient()

    try {
      const dimensions = await this.getImageDimensions(file)

      let fileToUpload = file
      let originalSize = file.size
      let compressedSize = file.size

      if (this.enableCompression && isImageFile(file)) {
        try {
          const result = await compressImage(file, this.compressOptions)
          fileToUpload = new File([result.blob], file.name || 'image.jpg', { type: result.blob.type })
          originalSize = result.originalSize ?? file.size
          compressedSize = result.compressedSize ?? file.size
          logger.info(
            `[MatrixMedia] 图片压缩完成: ${formatFileSize(originalSize)} -> ${formatFileSize(compressedSize)} (${result.compressionRatio.toFixed(1)}%)`
          )
        } catch (compressErr) {
          logger.error(`[MatrixMedia] 图片压缩失败，使用原图: ${compressErr}`)
        }
      }

      const contentUri = await this.uploadContentWithChunkFallback(
        client,
        fileToUpload,
        this.createUploadOptions(fileToUpload.type, onProgress, fileToUpload.name),
        onProgress
      )
      logger.info(`[MatrixMedia] 图片上传成功: ${contentUri}`)
      return {
        contentUri,
        size: compressedSize,
        mimetype: fileToUpload.type || 'image/png',
        width: dimensions.width,
        height: dimensions.height
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 图片上传失败: ${err}`)
      throw err
    }
  }

  async uploadVideo(file: File, onProgress?: (progress: number) => void): Promise<UploadResult & MediaInfo> {
    const client = this.getClient()

    try {
      const metadata = await this.getVideoMetadata(file)

      const contentUri = await this.uploadContentWithChunkFallback(
        client,
        file,
        this.createUploadOptions(file.type, onProgress, file.name),
        onProgress
      )
      logger.info(`[MatrixMedia] 视频上传成功: ${contentUri}`)
      return {
        contentUri,
        size: file.size,
        mimetype: file.type || 'video/mp4',
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 视频上传失败: ${err}`)
      throw err
    }
  }

  async uploadAudio(file: File, onProgress?: (progress: number) => void): Promise<UploadResult & MediaInfo> {
    const client = this.getClient()

    try {
      const duration = await this.getAudioDuration(file)

      const contentUri = await this.uploadContentWithChunkFallback(
        client,
        file,
        this.createUploadOptions(file.type, onProgress, file.name),
        onProgress
      )
      logger.info(`[MatrixMedia] 音频上传成功: ${contentUri}`)
      return {
        contentUri,
        size: file.size,
        mimetype: file.type || 'audio/ogg',
        duration
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 音频上传失败: ${err}`)
      throw err
    }
  }

  async uploadBlob(blob: Blob, _filename: string, mimetype: string): Promise<UploadResult> {
    const client = this.getClient()

    try {
      const uploadResponse = await client.uploadContent(blob, {
        type: mimetype
      })

      const contentUri = typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
      logger.info(`[MatrixMedia] Blob 上传成功: ${contentUri}`)
      return {
        contentUri,
        size: blob.size,
        mimetype
      }
    } catch (err) {
      logger.error(`[MatrixMedia] Blob 上传失败: ${err}`)
      throw err
    }
  }

  getMediaUrl(mxcUrl: string, width?: number, height?: number): string | null {
    if (!mxcUrl?.startsWith('mxc://')) {
      return null
    }

    const client = this.getClient()

    if (width && height) {
      return client.mxcUrlToHttp(mxcUrl, width, height, 'scale') ?? null
    }

    return client.mxcUrlToHttp(mxcUrl) ?? null
  }

  getThumbnailUrl(mxcUrl: string, width: number, height: number): string | null {
    if (!mxcUrl?.startsWith('mxc://')) {
      return null
    }

    const client = this.getClient()
    return client.mxcUrlToHttp(mxcUrl, width, height, 'scale') ?? null
  }

  async uploadContentWithId(
    serverName: string,
    mediaId: string,
    file: File | Blob,
    mimetype?: string
  ): Promise<UploadResult> {
    const client = this.getClient()
    const resolvedMimetype =
      mimetype || (file instanceof File ? file.type || 'application/octet-stream' : 'application/octet-stream')
    try {
      // 使用 PUT /_matrix/media/v3/upload/{serverName}/{mediaId}
      const uploadPath = MATRIX_PATHS.MEDIA.UPLOAD_WITH_ID(serverName, mediaId)
      const uploadUrl = `${client.getHomeserverUrl()}${uploadPath}`
      const accessToken = client.getAccessToken()

      const data = await HttpClient.put<{ content_uri: string }>(uploadUrl, file, {
        headers: {
          'Content-Type': resolvedMimetype,
          Authorization: `Bearer ${accessToken}`
        }
      })
      const contentUri = typeof data === 'string' ? data : (data as { content_uri: string }).content_uri
      logger.info(`[MatrixMedia] 具名上传成功: ${contentUri}`)
      return {
        contentUri,
        size: file.size,
        mimetype: resolvedMimetype
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 具名上传失败: ${err}`)
      throw err
    }
  }

  async getMediaConfig(): Promise<{ 'm.upload.size'?: number; [key: string]: unknown }> {
    const client = this.getClient()
    try {
      const result = await authedRequestWithPath<{ 'm.upload.size'?: number; [key: string]: unknown }>(
        client,
        'GET',
        MATRIX_PATHS.MEDIA.CONFIG
      )
      logger.info('[MatrixMedia] 获取上传配置成功')
      return result
    } catch (err) {
      logger.error(`[MatrixMedia] 获取上传配置失败: ${err}`)
      throw err
    }
  }

  async deleteMedia(serverName: string, mediaId: string): Promise<boolean> {
    const client = this.getClient()
    try {
      await authedRequestWithPath<void>(
        client,
        'POST',
        MATRIX_PATHS.MEDIA.DELETE(encodeURIComponent(serverName), encodeURIComponent(mediaId))
      )
      logger.info(`[MatrixMedia] 媒体删除成功: ${serverName}/${mediaId}`)
      return true
    } catch (err) {
      logger.error(`[MatrixMedia] 媒体删除失败: ${serverName}/${mediaId}, ${err}`)
      throw err
    }
  }

  async getQuotaAlerts(): Promise<Array<Record<string, unknown>>> {
    const client = this.getClient()
    try {
      const result = await authedRequestWithPath<{ alerts?: Array<Record<string, unknown>> }>(
        client,
        'GET',
        MATRIX_PATHS.MEDIA.QUOTA_ALERTS
      )
      logger.info('[MatrixMedia] 获取配额告警成功')
      return result.alerts ?? []
    } catch (err) {
      logger.error(`[MatrixMedia] 获取配额告警失败: ${err}`)
      return []
    }
  }

  async checkQuota(): Promise<{ limit: number; used: number; remaining: number } | null> {
    const client = this.getClient()
    try {
      const result = await authedRequestWithPath<Record<string, unknown>>(client, 'GET', MATRIX_PATHS.MEDIA.QUOTA_CHECK)
      return {
        limit: (result.limit as number) ?? 0,
        used: (result.used as number) ?? 0,
        remaining: (result.remaining as number) ?? 0
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 配额检查失败: ${err}`)
      return null
    }
  }

  async getQuotaStats(): Promise<{
    storageBytes: number
    mediaCount: number
    limitBytes: number
  } | null> {
    const client = this.getClient()
    try {
      const result = await authedRequestWithPath<Record<string, unknown>>(client, 'GET', MATRIX_PATHS.MEDIA.QUOTA_STATS)
      return {
        storageBytes: (result.storage_bytes as number) ?? 0,
        mediaCount: (result.media_count as number) ?? 0,
        limitBytes: (result.limit_bytes as number) ?? 0
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 获取配额统计失败: ${err}`)
      return null
    }
  }

  async getAuthenticatedMediaConfig(): Promise<{
    authenticated_media: boolean
    [key: string]: unknown
  } | null> {
    const client = this.getClient()
    try {
      const result = (await authedRequestWithPath<Record<string, unknown>>(
        client,
        'GET',
        MATRIX_PATHS.MEDIA.CLIENT_MEDIA_CONFIG
      )) as Record<string, unknown>
      logger.info('[MatrixMedia] 获取认证媒体配置成功')
      return {
        authenticated_media: (result.authenticated_media as boolean) ?? false,
        ...result
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 获取认证媒体配置失败: ${err}`)
      return null
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(errorMessage)), ms)
      })
    ]).finally(() => clearTimeout(timer))
  }

  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return this.withTimeout(
      new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          resolve({
            width: img.naturalWidth,
            height: img.naturalHeight
          })
          URL.revokeObjectURL(img.src)
        }
        img.onerror = () => {
          reject(new Error('无法加载图片'))
          URL.revokeObjectURL(img.src)
        }
        img.src = URL.createObjectURL(file)
      }),
      10000,
      '获取图片尺寸超时'
    )
  }

  private getVideoMetadata(file: File): Promise<{ width: number; height: number; duration: number }> {
    return this.withTimeout(
      new Promise((resolve, reject) => {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.onloadedmetadata = () => {
          resolve({
            width: video.videoWidth,
            height: video.videoHeight,
            duration: Math.round(video.duration * 1000)
          })
          URL.revokeObjectURL(video.src)
        }
        video.onerror = () => {
          reject(new Error('无法加载视频'))
          URL.revokeObjectURL(video.src)
        }
        video.src = URL.createObjectURL(file)
      }),
      10000,
      '获取视频元数据超时'
    )
  }

  private getAudioDuration(file: File): Promise<number> {
    return this.withTimeout(
      new Promise((resolve, reject) => {
        const audio = new Audio()
        audio.preload = 'metadata'
        audio.onloadedmetadata = () => {
          resolve(Math.round(audio.duration * 1000))
          URL.revokeObjectURL(audio.src)
        }
        audio.onerror = () => {
          reject(new Error('无法加载音频'))
          URL.revokeObjectURL(audio.src)
        }
        audio.src = URL.createObjectURL(file)
      }),
      10000,
      '获取音频时长超时'
    )
  }
}

export const matrixMediaService = new MatrixMediaServiceClass()
