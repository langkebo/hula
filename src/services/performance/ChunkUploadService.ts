import type { MatrixClient } from 'matrix-js-sdk'
import { getMatrixClient } from '@/services/matrix/matrixClientAccessor'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ChunkUploadService')

interface ChunkUploadOptions {
  file: File
  chunkSize?: number
  maxRetries?: number
  concurrency?: number
  onProgress?: (progress: UploadProgress) => void
  onChunkComplete?: (chunkIndex: number, total: number) => void
  onComplete?: (result: UploadResult) => void
  onError?: (error: Error) => void
}

interface UploadProgress {
  loaded: number
  total: number
  percentage: number
  speed: number
  remaining: number
  chunkProgress: number[]
}

interface UploadResult {
  mxcUrl: string
  filename: string
  size: number
  mimeType: string
}

interface ChunkInfo {
  index: number
  start: number
  end: number
  retryCount: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
}

interface ChunkUploadContext {
  id: string
  file: File
  chunkSize: number
  maxRetries: number
  concurrency: number
  totalChunks: number
  chunks: ChunkInfo[]
  uploadedSize: number
  startTime: number
  aborted: boolean
  paused?: boolean
  onProgress?: (progress: UploadProgress) => void
  onChunkComplete?: (chunkIndex: number, total: number) => void
  onComplete?: (result: UploadResult) => void
  onError?: (error: Error) => void
}

// Type alias for the MediaManager instance returned by client.getMediaManager()
type MediaManagerInstance = ReturnType<NonNullable<MatrixClient['getMediaManager']>>

class ChunkUploadService {
  private uploads: Map<string, ChunkUploadContext> = new Map()

  /** 获取 MediaManager——失败时抛错 */
  private getMedia(client: MatrixClient): MediaManagerInstance {
    const fn = (client as unknown as { getMediaManager?: () => unknown }).getMediaManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getMediaManager is not available; SDK 未初始化')
    }
    return fn.call(client) as MediaManagerInstance
  }

  async upload(options: ChunkUploadOptions): Promise<UploadResult> {
    const {
      file,
      chunkSize = 5 * 1024 * 1024,
      maxRetries = 3,
      concurrency = 3,
      onProgress,
      onChunkComplete,
      onComplete,
      onError
    } = options

    const client = getMatrixClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }
    const media = this.getMedia(client)

    // 禁用 SDK 层重试：ChunkUploadService 自身已有 maxRetries=3 的重试编排，
    // 若 SDK withRetry 也重试（uploadChunk 默认 idempotent=true 会触发 5xx 重试），
    // 单个 chunk 失败最坏可放大到 16 次 HTTP 请求（SDK 3 次 × 前端 4 次）。
    // 此处设 maxRetries=0 让前端重试成为唯一来源；finally 中恢复默认值 3。
    media.setRetryOptions({ maxRetries: 0 })

    const totalChunks = Math.ceil(file.size / chunkSize)

    // Step 1: Start upload session via MediaManager.startChunkUpload
    const startResp = await media.startChunkUpload(file.name, file.type || 'application/octet-stream', file.size)
    const serverUploadId = startResp.upload_id

    const context: ChunkUploadContext = {
      id: serverUploadId,
      file,
      chunkSize,
      maxRetries,
      concurrency,
      totalChunks,
      chunks: [],
      uploadedSize: 0,
      startTime: Date.now(),
      aborted: false,
      onProgress,
      onChunkComplete,
      onComplete,
      onError
    }

    for (let i = 0; i < totalChunks; i++) {
      context.chunks.push({
        index: i,
        start: i * chunkSize,
        end: Math.min((i + 1) * chunkSize, file.size),
        retryCount: 0,
        status: 'pending'
      })
    }

    this.uploads.set(serverUploadId, context)

    try {
      const result = await this.processUpload(context, media)
      logger.info(`[ChunkUpload] 上传完成: ${file.name}`)
      return result
    } catch (err) {
      logger.error(`[ChunkUpload] 上传失败: ${err}`)
      try {
        await media.cancelChunkUpload(serverUploadId)
      } catch {
        // Ignore cancel errors during cleanup
      }
      throw err
    } finally {
      this.uploads.delete(serverUploadId)
      // 恢复 SDK 默认重试，避免影响后续 MediaManager 操作（uploadContent 等）
      media.setRetryOptions({ maxRetries: 3 })
    }
  }

  private async processUpload(context: ChunkUploadContext, media: MediaManagerInstance): Promise<UploadResult> {
    const uploadPromises: Promise<void>[] = []

    const processNext = async () => {
      while (!context.aborted) {
        if (context.paused) {
          await new Promise((resolve) => setTimeout(resolve, 200))
          continue
        }
        const chunk = context.chunks.find((c) => c.status === 'pending')
        if (!chunk) break

        chunk.status = 'uploading'

        try {
          await this.uploadChunk(context, chunk, media)
          chunk.status = 'completed'
          context.uploadedSize += chunk.end - chunk.start
          this.updateProgress(context)
          context.onChunkComplete?.(chunk.index, context.totalChunks)
        } catch (err) {
          chunk.retryCount++
          if (chunk.retryCount >= context.maxRetries) {
            chunk.status = 'failed'
            context.aborted = true
            throw err
          }
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (chunk.retryCount - 1)))
          chunk.status = 'pending'
        }
      }
    }

    for (let i = 0; i < context.concurrency; i++) {
      uploadPromises.push(processNext())
    }

    await Promise.all(uploadPromises)

    if (context.aborted) {
      throw new Error('Upload aborted')
    }

    return this.completeUpload(context, media)
  }

  /** Upload a single chunk via MediaManager.uploadChunk */
  private async uploadChunk(context: ChunkUploadContext, chunk: ChunkInfo, media: MediaManagerInstance): Promise<void> {
    const slice = context.file.slice(chunk.start, chunk.end)
    const buffer = await slice.arrayBuffer()
    await media.uploadChunk(context.id, chunk.index, buffer)
  }

  private updateProgress(context: ChunkUploadContext): void {
    const elapsed = Date.now() - context.startTime
    const speed = context.uploadedSize / (elapsed / 1000)
    const remaining = speed > 0 ? (context.file.size - context.uploadedSize) / speed : 0

    // Stepwise chunkProgress: completed=1, else=0 (fetch has no upload progress events)
    const chunkProgressArray = context.chunks.map((c) => (c.status === 'completed' ? 1 : 0))

    context.onProgress?.({
      loaded: context.uploadedSize,
      total: context.file.size,
      percentage: (context.uploadedSize / context.file.size) * 100,
      speed,
      remaining,
      chunkProgress: chunkProgressArray
    })
  }

  /** Finalize upload via MediaManager.completeChunkUpload */
  private async completeUpload(context: ChunkUploadContext, media: MediaManagerInstance): Promise<UploadResult> {
    const result = await media.completeChunkUpload(context.id)
    return {
      mxcUrl: result.content_uri,
      filename: context.file.name,
      size: context.file.size,
      mimeType: context.file.type
    }
  }

  /** Get upload progress from server via MediaManager.getChunkUploadProgress */
  async getProgress(uploadId: string): Promise<{
    upload_id: string
    uploaded_chunks: number
    total_chunks: number
    uploaded_size: number
    total_size: number | null
    status: string
  } | null> {
    const client = getMatrixClient()
    if (!client) return null
    try {
      const media = this.getMedia(client)
      const resp = await media.getChunkUploadProgress(uploadId)
      return {
        upload_id: resp.upload_id,
        uploaded_chunks: resp.received_chunks,
        total_chunks: resp.total_chunks,
        uploaded_size: resp.bytes_received,
        total_size: resp.total_bytes,
        status: 'in_progress'
      }
    } catch {
      return null
    }
  }

  abort(uploadId: string): void {
    const context = this.uploads.get(uploadId)
    if (context) {
      context.aborted = true
      const client = getMatrixClient()
      if (client) {
        try {
          const media = this.getMedia(client)
          media.cancelChunkUpload(uploadId).catch(() => {})
        } catch {
          // client 不可用时跳过——服务端最终会过期 session
        }
      }
      logger.info(`[ChunkUpload] 上传已取消: ${uploadId}`)
    }
  }

  pause(uploadId: string): void {
    const context = this.uploads.get(uploadId)
    if (context) {
      context.paused = true
    }
  }

  resume(uploadId: string): void {
    const context = this.uploads.get(uploadId)
    if (context?.paused) {
      context.paused = false
    }
  }
}

export const chunkUploadService = new ChunkUploadService()
export default chunkUploadService
