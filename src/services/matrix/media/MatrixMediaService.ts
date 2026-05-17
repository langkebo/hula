import { error, info } from '@tauri-apps/plugin-log'
import {
  type MatrixEncryptedAttachmentLike,
  matrixAttachmentDecryptionService
} from '@/services/matrix/crypto/MatrixAttachmentDecryptionService'
import {
  type EncryptedAttachmentFile,
  matrixAttachmentEncryptionService
} from '@/services/matrix/crypto/MatrixAttachmentEncryptionService'
import { compressImage, formatFileSize, isImageFile } from '@/utils/ImageUtils'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'
import { MATRIX_PATHS } from '../paths'

export interface UploadResult {
  contentUri: string
  size: number
  mimetype: string
}

export interface EncryptedUploadResult extends UploadResult {
  encryptedFile: EncryptedAttachmentFile
}

export interface MediaInfo {
  size: number
  mimetype: string
  width?: number
  height?: number
  duration?: number
}

export interface CompressOptions {
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
      let response = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (!response.ok) {
        const separator = downloadUrl.includes('?') ? '&' : '?'
        response = await fetch(`${downloadUrl}${separator}access_token=${encodeURIComponent(accessToken)}`)
      }
      if (!response.ok) {
        throw new Error(
          this.t('matrix_error.media.download_failed', { status: response.status, statusText: response.statusText })
        )
      }
      return new Uint8Array(await response.arrayBuffer())
    }

    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(
        this.t('matrix_error.media.download_failed', { status: response.status, statusText: response.statusText })
      )
    }

    return new Uint8Array(await response.arrayBuffer())
  }

  async downloadEncryptedFileBytes(encryptedFile: MatrixEncryptedAttachmentLike): Promise<Uint8Array> {
    const parsedEncryptedFile = matrixAttachmentDecryptionService.parseEncryptedFile(encryptedFile)
    const ciphertext = await this.downloadFileBytes(parsedEncryptedFile.url)
    return matrixAttachmentDecryptionService.decryptAttachment(ciphertext, parsedEncryptedFile)
  }

  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
    const client = this.getClient()

    try {
      const uploadResponse = await client.uploadContent(
        file,
        this.createUploadOptions(file.type, onProgress, file.name)
      )

      const contentUri = typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
      info(`[MatrixMedia] 文件上传成功: ${contentUri}`)

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
      error(`[MatrixMedia] 文件上传失败: ${err}`)
      throw err
    }
  }

  async uploadEncryptedFile(file: File, onProgress?: (progress: number) => void): Promise<EncryptedUploadResult> {
    const client = this.getClient()

    try {
      const encryptedPayload = await matrixAttachmentEncryptionService.encryptAttachment(file)
      const uploadResponse = await client.uploadContent(
        encryptedPayload.encryptedData,
        this.createUploadOptions('application/octet-stream', onProgress, file.name, false)
      )

      const contentUri = typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
      info(`[MatrixMedia] 加密文件上传成功: ${contentUri}`)

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
      error(`[MatrixMedia] 加密文件上传失败: ${err}`)
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
          info(
            `[MatrixMedia] 图片压缩完成: ${formatFileSize(originalSize)} -> ${formatFileSize(compressedSize)} (${result.compressionRatio.toFixed(1)}%)`
          )
        } catch (compressErr) {
          error(`[MatrixMedia] 图片压缩失败，使用原图: ${compressErr}`)
        }
      }

      const uploadResponse = await client.uploadContent(
        fileToUpload,
        this.createUploadOptions(fileToUpload.type, onProgress, fileToUpload.name)
      )

      const contentUri = typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
      info(`[MatrixMedia] 图片上传成功: ${contentUri}`)
      return {
        contentUri,
        size: compressedSize,
        mimetype: fileToUpload.type || 'image/png',
        width: dimensions.width,
        height: dimensions.height
      }
    } catch (err) {
      error(`[MatrixMedia] 图片上传失败: ${err}`)
      throw err
    }
  }

  async uploadVideo(file: File, onProgress?: (progress: number) => void): Promise<UploadResult & MediaInfo> {
    const client = this.getClient()

    try {
      const metadata = await this.getVideoMetadata(file)

      const uploadResponse = await client.uploadContent(
        file,
        this.createUploadOptions(file.type, onProgress, file.name)
      )

      const contentUri = typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
      info(`[MatrixMedia] 视频上传成功: ${contentUri}`)
      return {
        contentUri,
        size: file.size,
        mimetype: file.type || 'video/mp4',
        width: metadata.width,
        height: metadata.height,
        duration: metadata.duration
      }
    } catch (err) {
      error(`[MatrixMedia] 视频上传失败: ${err}`)
      throw err
    }
  }

  async uploadAudio(file: File, onProgress?: (progress: number) => void): Promise<UploadResult & MediaInfo> {
    const client = this.getClient()

    try {
      const duration = await this.getAudioDuration(file)

      const uploadResponse = await client.uploadContent(
        file,
        this.createUploadOptions(file.type, onProgress, file.name)
      )

      const contentUri = typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
      info(`[MatrixMedia] 音频上传成功: ${contentUri}`)
      return {
        contentUri,
        size: file.size,
        mimetype: file.type || 'audio/ogg',
        duration
      }
    } catch (err) {
      error(`[MatrixMedia] 音频上传失败: ${err}`)
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
      info(`[MatrixMedia] Blob 上传成功: ${contentUri}`)
      return {
        contentUri,
        size: blob.size,
        mimetype
      }
    } catch (err) {
      error(`[MatrixMedia] Blob 上传失败: ${err}`)
      throw err
    }
  }

  getMediaUrl(mxcUrl: string, width?: number, height?: number): string | null {
    if (!mxcUrl || !mxcUrl.startsWith('mxc://')) {
      return null
    }

    const client = this.getClient()

    if (width && height) {
      return client.mxcUrlToHttp(mxcUrl, width, height, 'scale') ?? null
    }

    return client.mxcUrlToHttp(mxcUrl) ?? null
  }

  getThumbnailUrl(mxcUrl: string, width: number, height: number): string | null {
    if (!mxcUrl || !mxcUrl.startsWith('mxc://')) {
      return null
    }

    const client = this.getClient()
    return client.mxcUrlToHttp(mxcUrl, width, height, 'scale') ?? null
  }

  async uploadContentWithId(
    _serverName: string,
    _mediaId: string,
    file: File | Blob,
    mimetype?: string
  ): Promise<UploadResult> {
    const client = this.getClient()
    try {
      const uploadResponse = await client.uploadContent(file, {
        type: mimetype || (file instanceof File ? file.type : undefined),
        name: file instanceof File ? file.name : undefined
      })
      const contentUri = typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
      info(`[MatrixMedia] 具名上传成功: ${contentUri}`)
      return {
        contentUri,
        size: file.size,
        mimetype:
          mimetype || (file instanceof File ? file.type || 'application/octet-stream' : 'application/octet-stream')
      }
    } catch (err) {
      error(`[MatrixMedia] 具名上传失败: ${err}`)
      throw err
    }
  }

  async getMediaConfig(): Promise<{ 'm.upload.size'?: number; [key: string]: unknown }> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', MATRIX_PATHS.MEDIA.CONFIG)
      info('[MatrixMedia] 获取上传配置成功')
      return result as { 'm.upload.size'?: number; [key: string]: unknown }
    } catch (err) {
      error(`[MatrixMedia] 获取上传配置失败: ${err}`)
      throw err
    }
  }

  async deleteMedia(serverName: string, mediaId: string): Promise<boolean> {
    const client = this.getClient()
    try {
      await client.http.authedRequest(
        'POST',
        MATRIX_PATHS.MEDIA.DELETE(encodeURIComponent(serverName), encodeURIComponent(mediaId))
      )
      info(`[MatrixMedia] 媒体删除成功: ${serverName}/${mediaId}`)
      return true
    } catch (err) {
      error(`[MatrixMedia] 媒体删除失败: ${serverName}/${mediaId}, ${err}`)
      throw err
    }
  }

  async getQuotaAlerts(): Promise<Array<Record<string, unknown>>> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest('GET', MATRIX_PATHS.MEDIA.QUOTA_ALERTS)
      info('[MatrixMedia] 获取配额告警成功')
      return (result as { alerts?: Array<Record<string, unknown>> }).alerts ?? []
    } catch (err) {
      error(`[MatrixMedia] 获取配额告警失败: ${err}`)
      return []
    }
  }

  async checkQuota(): Promise<{ limit: number; used: number; remaining: number } | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest('GET', MATRIX_PATHS.MEDIA.QUOTA_CHECK)) as Record<string, unknown>
      return {
        limit: (result.limit as number) ?? 0,
        used: (result.used as number) ?? 0,
        remaining: (result.remaining as number) ?? 0
      }
    } catch (err) {
      error(`[MatrixMedia] 配额检查失败: ${err}`)
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
      const result = (await client.http.authedRequest('GET', MATRIX_PATHS.MEDIA.QUOTA_STATS)) as Record<string, unknown>
      return {
        storageBytes: (result.storage_bytes as number) ?? 0,
        mediaCount: (result.media_count as number) ?? 0,
        limitBytes: (result.limit_bytes as number) ?? 0
      }
    } catch (err) {
      error(`[MatrixMedia] 获取配额统计失败: ${err}`)
      return null
    }
  }

  async getAuthenticatedMediaConfig(): Promise<{
    authenticated_media: boolean
    [key: string]: unknown
  } | null> {
    const client = this.getClient()
    try {
      const result = (await client.http.authedRequest('GET', MATRIX_PATHS.MEDIA.CLIENT_MEDIA_CONFIG)) as Record<
        string,
        unknown
      >
      info('[MatrixMedia] 获取认证媒体配置成功')
      return {
        authenticated_media: (result.authenticated_media as boolean) ?? false,
        ...result
      }
    } catch (err) {
      error(`[MatrixMedia] 获取认证媒体配置失败: ${err}`)
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
export default matrixMediaService
