import type { MediaManager } from 'matrix-js-sdk/media'
import {
  type EncryptedAttachmentFile,
  matrixAttachmentEncryptionService
} from '@/services/matrix/crypto/MatrixAttachmentEncryptionService'
import { chunkUploadService } from '@/services/performance/ChunkUploadService'
import { formatBytes } from '@/utils/Formatting'
import { compressImage, isImageFile } from '@/utils/ImageUtils'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'
import {
  downloadEncryptedFileBytes as dlEncryptedFileBytes,
  downloadFileBytes as dlFileBytes
} from './mediaDownloadHelpers'
import { getAudioDuration, getImageDimensions, getVideoMetadata } from './mediaMetadata'
import {
  type CompressOptions,
  DEFAULT_COMPRESS_OPTIONS,
  type EncryptedUploadResult,
  type MediaInfo,
  type UploadResult
} from './mediaTypes'
import { createUploadOptions, uploadContentWithChunkFallback } from './mediaUploadHelpers'

const logger = createLogger('MatrixMediaService')

/**
 * Matrix Media 服务 — 文件上传/下载/媒体配置/配额管理。
 *
 * 实现已拆分为四个子模块：
 * - mediaTypes：类型定义和常量
 * - mediaMetadata：图片/视频/音频元数据提取（纯 DOM 函数）
 * - mediaUploadHelpers：上传选项构造、错误判断、分片回退、直接 XHR 上传
 * - mediaDownloadHelpers：URL 解析、文件下载、加密文件下载
 *
 * 本文件保留：上传编排、压缩控制、URL 解析、媒体配置/配额管理。
 */
class MatrixMediaServiceClass extends BaseMatrixService {
  private compressOptions: CompressOptions = { ...DEFAULT_COMPRESS_OPTIONS }
  private enableCompression = true

  protected getMedia(): MediaManager {
    const client = this.getClient()
    const fn = (client as unknown as { getMediaManager?: () => MediaManager }).getMediaManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getMediaManager is not available; SDK 未初始化')
    }
    return fn.call(client)
  }

  setCompressOptions(options: CompressOptions) {
    this.compressOptions = { ...DEFAULT_COMPRESS_OPTIONS, ...options }
  }

  setEnableCompression(enable: boolean) {
    this.enableCompression = enable
  }

  // ── 上传 ──

  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
    const client = this.getClient()
    try {
      const contentUri = await uploadContentWithChunkFallback(
        () => this.getMedia(),
        client,
        file,
        createUploadOptions(file.type, onProgress, file.name),
        onProgress
      )
      logger.info(`[MatrixMedia] 文件上传成功: ${contentUri}`)
      const telemetry = matrixClientService.getTelemetry()
      if (telemetry) telemetry.trackMediaUploaded(file.size, file.type || 'application/octet-stream')
      return { contentUri, size: file.size, mimetype: file.type || 'application/octet-stream' }
    } catch (err) {
      logger.error(`[MatrixMedia] 文件上传失败: ${err}`)
      throw err
    }
  }

  /**
   * 主动分块上传大文件 (§9.4.1)
   * 阈值：文件 ≥ 10MB 时应优先调用此方法，避免触发 413 后再回退。
   */
  async uploadLargeFile(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
    try {
      const result = await chunkUploadService.upload({
        file,
        onProgress: (p) => onProgress?.(p.percentage)
      })
      logger.info(`[MatrixMedia] 大文件分块上传成功: ${result.mxcUrl}`)
      const telemetry = matrixClientService.getTelemetry()
      if (telemetry) telemetry.trackMediaUploaded(file.size, file.type || 'application/octet-stream')
      return { contentUri: result.mxcUrl, size: file.size, mimetype: file.type || 'application/octet-stream' }
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
      const contentUri = await uploadContentWithChunkFallback(
        () => this.getMedia(),
        client,
        encryptedBlobFile,
        createUploadOptions('application/octet-stream', onProgress, file.name, false),
        onProgress
      )
      logger.info(`[MatrixMedia] 加密文件上传成功: ${contentUri}`)
      return {
        contentUri,
        size: file.size,
        mimetype: file.type || 'application/octet-stream',
        encryptedFile: { ...encryptedPayload.encryptedFile, url: contentUri } as EncryptedAttachmentFile
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
      const dimensions = await getImageDimensions(file)
      logger.info(`[MatrixMedia][AVATAR_DEBUG] dimensions: ${dimensions.width}x${dimensions.height}`)

      let fileToUpload = file
      let compressedSize = file.size

      if (this.enableCompression && isImageFile(file)) {
        try {
          const result = await compressImage(file, this.compressOptions)
          fileToUpload = new File([result.blob], file.name || 'image.jpg', { type: result.blob.type })
          compressedSize = result.compressedSize ?? file.size
          logger.info(
            `[MatrixMedia][AVATAR_DEBUG] 压缩完成: ${formatBytes(result.originalSize ?? file.size)} -> ${formatBytes(compressedSize)} (${result.compressionRatio.toFixed(1)}%)`
          )
        } catch (compressErr) {
          logger.error(`[MatrixMedia][AVATAR_DEBUG] 压缩失败，使用原图: ${compressErr}`)
        }
      }

      const contentUri = await uploadContentWithChunkFallback(
        () => this.getMedia(),
        client,
        fileToUpload,
        createUploadOptions(fileToUpload.type, onProgress, fileToUpload.name),
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
      const metadata = await getVideoMetadata(file)
      const contentUri = await uploadContentWithChunkFallback(
        () => this.getMedia(),
        client,
        file,
        createUploadOptions(file.type, onProgress, file.name),
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
      const duration = await getAudioDuration(file)
      const contentUri = await uploadContentWithChunkFallback(
        () => this.getMedia(),
        client,
        file,
        createUploadOptions(file.type, onProgress, file.name),
        onProgress
      )
      logger.info(`[MatrixMedia] 音频上传成功: ${contentUri}`)
      return { contentUri, size: file.size, mimetype: file.type || 'audio/ogg', duration }
    } catch (err) {
      logger.error(`[MatrixMedia] 音频上传失败: ${err}`)
      throw err
    }
  }

  async uploadBlob(blob: Blob, filename: string, mimetype: string): Promise<UploadResult> {
    const client = this.getClient()
    try {
      const opts = createUploadOptions(mimetype, undefined, filename)
      const contentUri = await uploadContentWithChunkFallback(() => this.getMedia(), client, blob as File, opts)
      logger.info(`[MatrixMedia] Blob 上传成功: ${contentUri}`)
      return { contentUri, size: blob.size, mimetype }
    } catch (err) {
      logger.error(`[MatrixMedia] Blob 上传失败: ${err}`)
      throw err
    }
  }

  async uploadContentWithId(
    serverName: string,
    mediaId: string,
    file: File | Blob,
    mimetype?: string
  ): Promise<UploadResult> {
    const resolvedMimetype =
      mimetype || (file instanceof File ? file.type || 'application/octet-stream' : 'application/octet-stream')
    try {
      const response = await this.getMedia().uploadContentWithId(serverName, mediaId, file, resolvedMimetype)
      logger.info(`[MatrixMedia] 具名上传成功: ${response.content_uri}`)
      return { contentUri: response.content_uri, size: file.size, mimetype: resolvedMimetype }
    } catch (err) {
      logger.error(`[MatrixMedia] 具名上传失败: ${err}`)
      throw err
    }
  }

  // ── URL 解析 ──

  getMediaUrl(mxcUrl: string, width?: number, height?: number): string | null {
    if (!mxcUrl?.startsWith('mxc://')) return null
    const client = this.getClient()
    // 容错：极少数 client 包装层会剥离 SDK 实例方法。优先调用标准方法；失败时回落到 mxc 原值返回。
    try {
      if (typeof client?.mxcUrlToHttp !== 'function') {
        logger.warn('[MatrixMedia] client.mxcUrlToHttp 不可用，返回原始 mxc')
        return mxcUrl
      }
      if (width && height) return client.mxcUrlToHttp(mxcUrl, width, height, 'scale') ?? null
      return client.mxcUrlToHttp(mxcUrl) ?? null
    } catch (err) {
      logger.warn(`[MatrixMedia] mxcUrlToHttp 调用失败: ${(err as Error)?.message ?? err}`)
      return mxcUrl
    }
  }

  getThumbnailUrl(mxcUrl: string, width: number, height: number): string | null {
    if (!mxcUrl?.startsWith('mxc://')) return null
    const client = this.getClient()
    try {
      if (typeof client?.mxcUrlToHttp !== 'function') return null
      return client.mxcUrlToHttp(mxcUrl, width, height, 'scale') ?? null
    } catch (err) {
      logger.warn(`[MatrixMedia] mxcUrlToHttp(thumbnail) 失败: ${(err as Error)?.message ?? err}`)
      return null
    }
  }

  // ── 下载（委托 mediaDownloadHelpers）──

  async downloadFileBytes(mediaUrl: string): Promise<Uint8Array> {
    const client = this.getClient()
    return dlFileBytes(
      client,
      mediaUrl,
      (url) => this.getMediaUrl(url),
      (key, params) => this.t(key, params)
    )
  }

  async downloadEncryptedFileBytes(encryptedFile: Parameters<typeof dlEncryptedFileBytes>[1]): Promise<Uint8Array> {
    const client = this.getClient()
    return dlEncryptedFileBytes(
      client,
      encryptedFile,
      (url) => this.getMediaUrl(url),
      (key, params) => this.t(key, params)
    )
  }

  // ── 媒体配置 & 配额 ──

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
    try {
      await this.getMedia().deleteMedia(serverName, mediaId)
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
      return { limit: result.limit ?? 0, used: result.used ?? 0, remaining: result.remaining ?? 0 }
    } catch (err) {
      logger.error(`[MatrixMedia] 配额检查失败: ${err}`)
      return null
    }
  }

  async getQuotaStats(): Promise<{ storageBytes: number; mediaCount: number; limitBytes: number } | null> {
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

  async getAuthenticatedMediaConfig(): Promise<{ authenticated_media: boolean; [key: string]: unknown } | null> {
    try {
      const result = (await this.getMedia().getMediaConfig(true)) as Record<string, unknown>
      logger.info('[MatrixMedia] 获取认证媒体配置成功')
      return { authenticated_media: (result.authenticated_media as boolean) ?? false, ...result }
    } catch (err) {
      logger.error(`[MatrixMedia] 获取认证媒体配置失败: ${err}`)
      return null
    }
  }
}

export const matrixMediaService = new MatrixMediaServiceClass()
