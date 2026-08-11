import type { MatrixClient } from 'matrix-js-sdk'
import type { MediaManager } from 'matrix-js-sdk/media'
import {
  type MatrixEncryptedAttachmentLike,
  matrixAttachmentDecryptionService
} from '@/services/matrix/crypto/MatrixAttachmentDecryptionService'
import {
  type EncryptedAttachmentFile,
  matrixAttachmentEncryptionService
} from '@/services/matrix/crypto/MatrixAttachmentEncryptionService'
import { chunkUploadService } from '@/services/performance/ChunkUploadService'
import { formatBytes } from '@/utils/Formatting'
import { HttpClient, HttpClientError } from '@/utils/HttpClient'
import { compressImage, isImageFile } from '@/utils/ImageUtils'
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

  protected getMedia(): MediaManager {
    const client = this.getClient()
    return (client as unknown as { getMediaManager: () => MediaManager }).getMediaManager()
  }

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
      if (this.isPayloadTooLarge(err)) {
        logger.warn(`[MatrixMedia] 上传返回 413,回退到分片上传: ${file.name}`)
        const result = await chunkUploadService.upload({
          file,
          onProgress: (p) => onProgress?.(p.percentage)
        })
        return result.mxcUrl
      }
      const errName = err instanceof Error ? err.name : ''
      if (errName === 'AbortError') {
        // SDK uploadContent 用 XMLHttpRequest 跨域被 CORS 阻止，回退到同源 XHR + Vite proxy
        logger.warn(`[MatrixMedia][AVATAR_DEBUG] uploadContent AbortError, 回退到直接 XHR 上传`)
        logger.info(
          `[MatrixMedia][AVATAR_DEBUG] calling uploadViaDirectFetch, typeof=${typeof this.uploadViaDirectFetch}`
        )
        const result = await this.uploadViaDirectFetch(client, file, opts)
        logger.info(`[MatrixMedia][AVATAR_DEBUG] uploadViaDirectFetch returned: ${result}`)
        return result
      }
      throw err
    }
  }

  /**
   * 直接上传：绕过 SDK 的 uploadContent（XMLHttpRequest 跨域 CORS 阻止）
   * 用 XMLHttpRequest + 同源 Vite proxy URL，避免 CORS 问题
   */
  private uploadViaDirectFetch(
    client: MatrixClient,
    file: File,
    opts: { type?: string; name?: string }
  ): Promise<string> {
    const homeserverUrl = client.getHomeserverUrl()
    const accessToken = client.getAccessToken()
    const filename = opts.name || file.name || 'upload'
    const mimetype = opts.type || file.type || 'application/octet-stream'

    // 构造同源 URL（dev 模式走 Vite proxy，避免 XMLHttpRequest 跨域 CORS）
    let uploadUrl = `${homeserverUrl}/_matrix/media/v3/upload?filename=${encodeURIComponent(filename)}&content_type=${encodeURIComponent(mimetype)}`
    if (import.meta.env.DEV) {
      try {
        const parsed = new URL(uploadUrl)
        if (parsed.pathname.startsWith('/_matrix/')) {
          uploadUrl = `${window.location.origin}${parsed.pathname}${parsed.search}`
        }
      } catch {
        // URL 解析失败，用原始 URL
      }
    }

    logger.info(`[MatrixMedia][AVATAR_DEBUG] 直接 XHR 上传: ${uploadUrl}, size=${file.size}`)

    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', uploadUrl)
      xhr.setRequestHeader('Content-Type', mimetype)
      if (accessToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`)
      }
      const timeout = setTimeout(() => {
        xhr.abort()
        reject(new Error('上传超时（30s）'))
      }, 30000)

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== XMLHttpRequest.DONE) return
        clearTimeout(timeout)
        if (xhr.status === 0) {
          reject(new Error('XMLHttpRequest 网络错误（CORS 或连接失败）'))
          return
        }
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const result = JSON.parse(xhr.responseText) as { content_uri: string }
            logger.info(`[MatrixMedia][AVATAR_DEBUG] 直接上传成功: ${result.content_uri}`)
            resolve(result.content_uri)
          } else {
            reject(new Error(`上传失败: ${xhr.status} ${xhr.responseText}`))
          }
        } catch (err) {
          reject(new Error(`解析响应失败: ${err}`))
        }
      }

      xhr.onerror = () => {
        clearTimeout(timeout)
        reject(new Error('XMLHttpRequest onerror'))
      }

      xhr.send(file)
    })
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
      logger.info(
        `[MatrixMedia][AVATAR_DEBUG] uploadImage start, size=${file.size} type=${file.type} name=${file.name}`
      )
      logger.info(`[MatrixMedia][AVATAR_DEBUG] calling getImageDimensions...`)
      const dimensions = await this.getImageDimensions(file)
      logger.info(`[MatrixMedia][AVATAR_DEBUG] dimensions: ${dimensions.width}x${dimensions.height}`)

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
            `[MatrixMedia][AVATAR_DEBUG] 压缩完成: ${formatBytes(originalSize)} -> ${formatBytes(compressedSize)} (${result.compressionRatio.toFixed(1)}%)`
          )
        } catch (compressErr) {
          logger.error(`[MatrixMedia][AVATAR_DEBUG] 压缩失败，使用原图: ${compressErr}`)
        }
      }

      logger.info(`[MatrixMedia][AVATAR_DEBUG] 开始 uploadContent, homeserver=${client.getHomeserverUrl()}`)
      const contentUri = await this.uploadContentWithChunkFallback(
        client,
        fileToUpload,
        this.createUploadOptions(fileToUpload.type, onProgress, fileToUpload.name),
        onProgress
      )
      logger.info(`[MatrixMedia][AVATAR_DEBUG] uploadContent 成功: ${contentUri}`)
      return {
        contentUri,
        size: compressedSize,
        mimetype: fileToUpload.type || 'image/png',
        width: dimensions.width,
        height: dimensions.height
      }
    } catch (err) {
      const errInfo = {
        name: err instanceof Error ? err.name : 'unknown',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5).join(' | ') : undefined,
        cause: err instanceof Error ? err.cause : undefined,
        errcode: (err as { errcode?: string })?.errcode,
        httpStatus: (err as { httpStatus?: number })?.httpStatus,
        data: (err as { data?: unknown })?.data
      }
      logger.error(`[MatrixMedia] 图片上传失败: ${JSON.stringify(errInfo)}`)
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
    try {
      const result = await this.getMedia().getMediaConfig(false)
      logger.info('[MatrixMedia] 获取上传配置成功')
      return result as { 'm.upload.size'?: number; [key: string]: unknown }
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
    try {
      const response = await this.getMedia().getMediaQuotaAlerts()
      logger.info('[MatrixMedia] 获取配额告警成功')
      return (response.alerts ?? []) as unknown as Array<Record<string, unknown>>
    } catch (err) {
      logger.error(`[MatrixMedia] 获取配额告警失败: ${err}`)
      return []
    }
  }

  async checkQuota(): Promise<{ limit: number; used: number; remaining: number } | null> {
    try {
      const result = await this.getMedia().checkMediaQuota()
      return {
        limit: result.limit ?? 0,
        used: result.used ?? 0,
        remaining: result.remaining ?? 0
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
    try {
      const result = await this.getMedia().getMediaQuotaStats()
      return {
        storageBytes: result.storage_bytes ?? 0,
        mediaCount: result.media_count ?? 0,
        limitBytes: result.limit_bytes ?? 0
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
    try {
      const result = (await this.getMedia().getMediaConfig(true)) as Record<string, unknown>
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
      new Promise<{ width: number; height: number }>((resolve) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
          const result = { width: img.naturalWidth, height: img.naturalHeight }
          URL.revokeObjectURL(url)
          resolve(result)
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          logger.warn(`[MatrixMedia][AVATAR_DEBUG] getImageDimensions onerror, 用默认尺寸 0x0`)
          resolve({ width: 0, height: 0 })
        }
        img.src = url
      }),
      10000,
      '获取图片尺寸超时'
    ).catch((err) => {
      logger.warn(`[MatrixMedia][AVATAR_DEBUG] getImageDimensions 失败, 用默认尺寸: ${err}`)
      return { width: 0, height: 0 }
    })
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
