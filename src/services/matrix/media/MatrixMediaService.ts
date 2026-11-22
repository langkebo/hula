import {
  type EncryptedAttachmentFile,
  matrixAttachmentEncryptionService
} from '@/services/matrix/crypto/MatrixAttachmentEncryptionService'
import { chunkUploadService, type ServerUploadProgress } from '@/services/performance/ChunkUploadService'
import { resolveUploadMimeTypeFromFile } from '@/utils/FileType'
import { formatBytes } from '@/utils/Formatting'
import { compressImage, isImageFile } from '@/utils/ImageUtils'
import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'
import { MatrixMediaConfigMethods } from './MatrixMediaConfigMethods'
import {
  buildSignedMediaDownloadUrl,
  downloadEncryptedFileBytes as dlEncryptedFileBytes,
  downloadFileBytes as dlFileBytes,
  downloadSignedMediaBytes as dlSignedMediaBytes,
  type SignedMediaDownloadParams
} from './mediaDownloadHelpers'
import { getAudioDuration, getImageDimensions, getVideoMetadata } from './mediaMetadata'
import { notifyMediaQuotaChanged } from './mediaQuotaEvents'
import {
  type CompressOptions,
  DEFAULT_COMPRESS_OPTIONS,
  type EncryptedUploadResult,
  MEDIA_CHUNK_UPLOAD_THRESHOLD_BYTES,
  type MediaInfo,
  type UploadResult
} from './mediaTypes'
import { createUploadOptions, uploadContentWithChunkFallback } from './mediaUploadHelpers'

const logger = createLogger('MatrixMediaService')

/**
 * Matrix Media 服务 — 文件上传/下载/媒体配置/配额管理。
 *
 * 实现已拆分为五个子模块：
 * - mediaTypes：类型定义和常量
 * - mediaMetadata：图片/视频/音频元数据提取（纯 DOM 函数）
 * - mediaUploadHelpers：上传选项构造、错误判断、分片回退、直接 XHR 上传
 * - mediaDownloadHelpers：URL 解析、文件下载、加密文件下载
 * - MatrixMediaConfigMethods：mxc 地址解析、媒体配置/配额端点
 *
 * 本文件保留：上传编排、压缩控制、下载委托。
 */
class MatrixMediaServiceClass extends MatrixMediaConfigMethods {
  private compressOptions: CompressOptions = { ...DEFAULT_COMPRESS_OPTIONS }
  private enableCompression = true
  private enableChunkUpload = true

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

  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void,
    onServerProgress?: (progress: ServerUploadProgress) => void
  ): Promise<UploadResult> {
    this.assertClientReady()
    if (this.enableChunkUpload && file.size >= MEDIA_CHUNK_UPLOAD_THRESHOLD_BYTES) {
      return this.uploadLargeFile(file, onProgress, onServerProgress)
    }
    try {
      const mimetype = await resolveUploadMimeTypeFromFile(file, file.name)
      const contentUri = await uploadContentWithChunkFallback(
        () => this.getMedia(),
        file,
        createUploadOptions(mimetype, onProgress, file.name),
        onProgress,
        onServerProgress
      )
      logger.info(`[MatrixMedia] 文件上传成功: ${contentUri}`)
      const telemetry = matrixClientService.getTelemetry()
      if (telemetry) telemetry.trackMediaUploaded(file.size, mimetype)
      return { contentUri, size: file.size, mimetype }
    } catch (err) {
      logger.error(`[MatrixMedia] 文件上传失败: ${err}`)
      throw err
    }
  }

  /**
   * 主动分块上传大文件 (§9.4.1)
   * 阈值：文件 ≥ 10MB 时应优先调用此方法，避免触发 413 后再回退。
   */
  async uploadLargeFile(
    file: File,
    onProgress?: (progress: number) => void,
    onServerProgress?: (progress: ServerUploadProgress) => void
  ): Promise<UploadResult> {
    try {
      const mimetype = await resolveUploadMimeTypeFromFile(file, file.name)
      const result = await chunkUploadService.upload({
        file,
        onProgress: (p) => onProgress?.(p.percentage),
        onServerProgress
      })
      logger.info(`[MatrixMedia] 大文件分块上传成功: ${result.mxcUrl}`)
      const telemetry = matrixClientService.getTelemetry()
      if (telemetry) telemetry.trackMediaUploaded(file.size, mimetype)
      notifyMediaQuotaChanged()
      return { contentUri: result.mxcUrl, size: file.size, mimetype }
    } catch (err) {
      logger.error(`[MatrixMedia] 大文件分块上传失败: ${err}`)
      throw err
    }
  }

  async uploadEncryptedFile(
    file: File,
    onProgress?: (progress: number) => void,
    onServerProgress?: (progress: ServerUploadProgress) => void
  ): Promise<EncryptedUploadResult> {
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
        onProgress,
        onServerProgress
      )
      logger.info(`[MatrixMedia] 加密文件上传成功: ${contentUri}`)
      return {
        contentUri,
        size: file.size,
        mimetype: await resolveUploadMimeTypeFromFile(file, file.name),
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

      const mimetype = await resolveUploadMimeTypeFromFile(fileToUpload, fileToUpload.name, 'image/png')
      const contentUri = await uploadContentWithChunkFallback(
        () => this.getMedia(),
        fileToUpload,
        createUploadOptions(mimetype, onProgress, fileToUpload.name),
        onProgress
      )
      logger.info(`[MatrixMedia][AVATAR_DEBUG] uploadContent 成功: ${contentUri}`)
      return {
        contentUri,
        size: compressedSize,
        mimetype,
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
      const mimetype = await resolveUploadMimeTypeFromFile(file, file.name, 'video/mp4')
      const contentUri = await uploadContentWithChunkFallback(
        () => this.getMedia(),
        file,
        createUploadOptions(mimetype, onProgress, file.name),
        onProgress
      )
      logger.info(`[MatrixMedia] 视频上传成功: ${contentUri}`)
      return {
        contentUri,
        size: file.size,
        mimetype,
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
      const mimetype = await resolveUploadMimeTypeFromFile(file, file.name, 'audio/ogg')
      const contentUri = await uploadContentWithChunkFallback(
        () => this.getMedia(),
        file,
        createUploadOptions(mimetype, onProgress, file.name),
        onProgress
      )
      logger.info(`[MatrixMedia] 音频上传成功: ${contentUri}`)
      return { contentUri, size: file.size, mimetype, duration }
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

  /** 具名上传（服务端指定 mediaId）：与其它上传入口一致，未初始化时立即失败 */
  async uploadContentWithId(
    serverName: string,
    mediaId: string,
    file: File | Blob,
    mimetype?: string
  ): Promise<UploadResult> {
    this.assertClientReady()
    const resolvedMimetype =
      mimetype || (await resolveUploadMimeTypeFromFile(file, file instanceof File ? file.name : ''))
    try {
      const response = await this.getMedia().uploadContentWithId(serverName, mediaId, file, resolvedMimetype)
      logger.info(`[MatrixMedia] 具名上传成功: ${response.content_uri}`)
      notifyMediaQuotaChanged()
      return { contentUri: response.content_uri, size: file.size, mimetype: resolvedMimetype }
    } catch (err) {
      logger.error(`[MatrixMedia] 具名上传失败: ${err}`)
      throw err
    }
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

  /**
   * 构造签名媒体下载地址（`download_signed`，由 SDK 按路由表构建）。
   *
   * 后端不提供「生成签名」的客户端端点，签名与过期时间由链接提供方下发；
   * 因此这里只负责把参数拼成可访问的签名 URL。`expires` 为 Unix 秒。
   */
  getSignedMediaDownloadUrl(params: SignedMediaDownloadParams): string {
    this.assertClientReady()
    try {
      return buildSignedMediaDownloadUrl(this.getClient(), params, (key, tParams) => this.t(key, tParams))
    } catch (err) {
      logger.error(`[MatrixMedia] 签名媒体地址构造失败: ${err}`)
      throw err
    }
  }

  /**
   * 通过后端 `download_signed` 端点下载媒体字节。
   *
   * 后端只返回完整字节流，没有分片/流式下载进度端点，因此不提供 download 进度回调；
   * UI 进度环按「开始 0% / 完成 100%」两级呈现（见 `fileDownload` store）。
   */
  async downloadSignedFileBytes(params: SignedMediaDownloadParams): Promise<Uint8Array> {
    this.assertClientReady()
    try {
      const data = await dlSignedMediaBytes(this.getClient(), params, (key, tParams) => this.t(key, tParams))
      logger.info(`[MatrixMedia] 签名媒体下载成功: ${params.serverName}/${params.mediaId}`)
      return data
    } catch (err) {
      logger.error(`[MatrixMedia] 签名媒体下载失败: ${err}`)
      throw err
    }
  }
}

export const matrixMediaService = new MatrixMediaServiceClass()
