import type { MediaManager, MediaQuotaAlert } from 'matrix-js-sdk/media'
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
  deleteMediaById,
  fetchAuthenticatedMediaConfig,
  fetchMediaConfig,
  fetchQuotaAlerts,
  fetchQuotaStats,
  fetchQuotaUsage,
  fetchUrlPreview
} from './mediaConfigOps'
import {
  downloadEncryptedFileBytes as dlEncryptedFileBytes,
  downloadFileBytes as dlFileBytes
} from './mediaDownloadHelpers'
import { getAudioDuration, getImageDimensions, getVideoMetadata } from './mediaMetadata'
import {
  type CompressOptions,
  DEFAULT_COMPRESS_OPTIONS,
  type EncryptedUploadResult,
  MEDIA_CHUNK_UPLOAD_THRESHOLD_BYTES,
  type MediaInfo,
  type MediaUrlPreview,
  type UploadResult
} from './mediaTypes'
import { createUploadOptions, uploadContentWithChunkFallback } from './mediaUploadHelpers'
import { resolveMxcToHttp } from './mxcUrl'

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
  private enableChunkUpload = true

  protected getMedia(): MediaManager {
    const client = this.getClient()
    const fn = (client as { getMediaManager?: () => MediaManager }).getMediaManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getMediaManager is not available; SDK 未初始化')
    }
    return fn.call(client)
  }

  /**
   * 上传前置校验：client 未初始化时**立即**失败。
   *
   * 必须是显式的一次调用：`upload*` 在真正上传前会先做压缩 / 元数据解析等昂贵工作，
   * 若把「未初始化」留到 `getMedia()` 才暴露，`uploadVideo` / `uploadAudio` 会先白等
   * 10s 元数据超时，错误信息也从「客户端未初始化」退化成「获取视频元数据超时」
   * （实测被 `MatrixMediaService.test.ts` 的两条用例拦下）。
   */
  private assertClientReady(): void {
    this.getClient()
  }

  /**
   * 设置媒体压缩选项（与默认值合并）。
   */
  setCompressOptions(options: CompressOptions) {
    this.compressOptions = { ...DEFAULT_COMPRESS_OPTIONS, ...options }
  }

  /**
   * 开启或关闭上传前自动压缩。
   */
  setEnableCompression(enable: boolean) {
    this.enableCompression = enable
  }

  /**
   * 开启或关闭大文件主动分块上传。
   *
   * 仅作用于未加密的 `uploadFile`：加密附件走 `uploadEncryptedFile`，
   * 其密文大小与原文件不同，不能按原文件阈值分流。
   */
  setEnableChunkUpload(enable: boolean) {
    this.enableChunkUpload = enable
  }

  // ── 上传 ──

  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
    this.assertClientReady()
    if (this.enableChunkUpload && file.size >= MEDIA_CHUNK_UPLOAD_THRESHOLD_BYTES) {
      return this.uploadLargeFile(file, onProgress)
    }
    try {
      const contentUri = await uploadContentWithChunkFallback(
        () => this.getMedia(),
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
    this.assertClientReady()
    try {
      const encryptedPayload = await matrixAttachmentEncryptionService.encryptAttachment(file)
      const encryptedBlobFile = new File([encryptedPayload.encryptedData as BlobPart], file.name, {
        type: 'application/octet-stream'
      })
      const contentUri = await uploadContentWithChunkFallback(
        () => this.getMedia(),
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
    this.assertClientReady()
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
    this.assertClientReady()
    try {
      const metadata = await getVideoMetadata(file)
      const contentUri = await uploadContentWithChunkFallback(
        () => this.getMedia(),
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
    this.assertClientReady()
    try {
      const duration = await getAudioDuration(file)
      const contentUri = await uploadContentWithChunkFallback(
        () => this.getMedia(),
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

  /**
   * 上传内存中的 Blob（按 mimetype 推断，不解析元数据）。
   */
  async uploadBlob(blob: Blob, filename: string, mimetype: string): Promise<UploadResult> {
    this.assertClientReady()
    try {
      const opts = createUploadOptions(mimetype, undefined, filename)
      const contentUri = await uploadContentWithChunkFallback(() => this.getMedia(), blob as File, opts)
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

  /**
   * 将 mxc:// 地址解析为 HTTP 地址，可选指定缩略图尺寸。
   * 解析失败时返回 null。
   */
  getMediaUrl(mxcUrl: string, width?: number, height?: number): string | null {
    // 统一走 resolveMxcToHttp（优先 client 级 mxcUrlToHttp，ProfileManager 仅回退）
    return resolveMxcToHttp(this.getClient(), mxcUrl, width, height)
  }

  /**
   * 将 mxc:// 地址解析为指定尺寸的缩略图 HTTP 地址。
   * 解析失败时返回 null。
   */
  getThumbnailUrl(mxcUrl: string, width: number, height: number): string | null {
    return resolveMxcToHttp(this.getClient(), mxcUrl, width, height)
  }

  // ── 下载（委托 mediaDownloadHelpers）──

  /**
   * 下载（未加密）媒体为字节数组。
   */
  async downloadFileBytes(mediaUrl: string): Promise<Uint8Array> {
    const client = this.getClient()
    return dlFileBytes(
      client,
      mediaUrl,
      (url) => this.getMediaUrl(url),
      (key, params) => this.t(key, params)
    )
  }

  /**
   * 下载并解密加密媒体为字节数组。
   */
  async downloadEncryptedFileBytes(encryptedFile: Parameters<typeof dlEncryptedFileBytes>[1]): Promise<Uint8Array> {
    const client = this.getClient()
    return dlEncryptedFileBytes(
      client,
      encryptedFile,
      (url) => this.getMediaUrl(url),
      (key, params) => this.t(key, params)
    )
  }

  // ── 媒体配置 & 配额（实现在 mediaConfigOps，本类只做访问器绑定）──

  /** 获取媒体上传配置（含 `m.upload.size` 上限）；失败抛出。 */
  async getMediaConfig(): Promise<{ 'm.upload.size'?: number; [key: string]: unknown }> {
    return fetchMediaConfig(() => this.getMedia())
  }

  /** 删除指定服务器上的媒体；成功返回 true，失败抛出。 */
  async deleteMedia(serverName: string, mediaId: string): Promise<boolean> {
    return deleteMediaById(() => this.getMedia(), serverName, mediaId)
  }

  /** 获取媒体配额告警列表；失败返回空数组。 */
  async getQuotaAlerts(): Promise<MediaQuotaAlert[]> {
    return fetchQuotaAlerts(() => this.getMedia())
  }

  /** 检查媒体配额（上限/已用/剩余）；失败返回 null。 */
  async checkQuota(): Promise<{ limit: number; used: number; remaining: number } | null> {
    return fetchQuotaUsage(() => this.getMedia())
  }

  /** 获取媒体配额统计（存储字节/媒体数/上限字节）；失败返回 null。 */
  async getQuotaStats(): Promise<{ storageBytes: number; mediaCount: number; limitBytes: number } | null> {
    return fetchQuotaStats(() => this.getMedia())
  }

  /** 获取认证媒体配置（是否启用 authenticated_media）；失败返回 null。 */
  async getAuthenticatedMediaConfig(): Promise<{ authenticated_media: boolean; [key: string]: unknown } | null> {
    return fetchAuthenticatedMediaConfig(() => this.getMedia())
  }

  /** 获取链接预览（标题/描述/缩略图）；服务端不支持或抓取失败时返回 null。 */
  async getUrlPreview(url: string, ts?: number): Promise<MediaUrlPreview | null> {
    return fetchUrlPreview(() => this.getMedia(), url, ts)
  }
}

export const matrixMediaService = new MatrixMediaServiceClass()
