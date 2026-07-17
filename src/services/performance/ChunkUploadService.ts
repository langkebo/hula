import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend/config'
import { getMatrixAccessToken, getMatrixHomeserverUrl } from '@/services/matrix/matrixClientAccessor'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ChunkUploadService')

export interface ChunkUploadOptions {
  file: File
  chunkSize?: number
  maxRetries?: number
  concurrency?: number
  onProgress?: (progress: UploadProgress) => void
  onChunkComplete?: (chunkIndex: number, total: number) => void
  onComplete?: (result: UploadResult) => void
  onError?: (error: Error) => void
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
  speed: number
  remaining: number
  chunkProgress: number[]
}

export interface UploadResult {
  mxcUrl: string
  filename: string
  size: number
  mimeType: string
}

export interface ChunkInfo {
  index: number
  start: number
  end: number
  retryCount: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
}

/** Base URL for Matrix media v1 endpoints */
function getBaseUrl(): string {
  return getMatrixHomeserverUrl() || resolveMatrixRuntimeEndpointConfig().homeserverUrl
}

/** Get the current access token for auth headers */
function getAuthHeaders(): Record<string, string> {
  const token = getMatrixAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function chunkEndpoint(path: string, params?: URLSearchParams): string {
  const url = new URL(`/_matrix/media/v1/upload/chunk${path}`, getBaseUrl())
  if (params) url.search = params.toString()
  return url.toString()
}

class ChunkUploadService {
  private uploads: Map<string, ChunkUploadContext> = new Map()

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

    const totalChunks = Math.ceil(file.size / chunkSize)

    // Step 1: Start upload session on server
    const startResp = await this.startUpload(file.name, file.type, file.size, totalChunks)
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
      const result = await this.processUpload(context)
      logger.info(`[ChunkUpload] 上传完成: ${file.name}`)
      return result
    } catch (err) {
      logger.error(`[ChunkUpload] 上传失败: ${err}`)
      // Try to cancel the upload on server
      try {
        await this.cancelUpload(serverUploadId)
      } catch {
        // Ignore cancel errors during cleanup
      }
      throw err
    } finally {
      this.uploads.delete(serverUploadId)
    }
  }

  /** Call POST /_matrix/media/v1/upload/chunk/start to create a server-side upload session */
  private async startUpload(
    filename: string,
    contentType: string,
    totalSize: number,
    totalChunks: number
  ): Promise<{ upload_id: string; chunk_size_limit: number; max_file_size: number }> {
    const resp = await fetch(chunkEndpoint('/start'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        filename,
        content_type: contentType || 'application/octet-stream',
        total_size: totalSize,
        total_chunks: totalChunks
      })
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`Failed to start chunked upload: ${resp.status} ${text}`)
    }

    return resp.json()
  }

  private async processUpload(context: ChunkUploadContext): Promise<UploadResult> {
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
          await this.uploadChunk(context, chunk)
          chunk.status = 'completed'
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

    return this.completeUpload(context)
  }

  /** Upload a single chunk via POST /_matrix/media/v1/upload/chunk?upload_id=...&chunk_index=... */
  private async uploadChunk(context: ChunkUploadContext, chunk: ChunkInfo): Promise<void> {
    const slice = context.file.slice(chunk.start, chunk.end)
    const buffer = await slice.arrayBuffer()

    const params = new URLSearchParams({
      upload_id: context.id,
      chunk_index: chunk.index.toString(),
      total_chunks: context.totalChunks.toString(),
      total_size: context.file.size.toString()
    })
    if (chunk.index === 0) {
      params.set('filename', context.file.name)
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const chunkProgress = e.loaded / e.total
          this.updateProgress(context, chunk.index, chunkProgress)
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          context.uploadedSize += chunk.end - chunk.start
          resolve()
        } else {
          reject(new Error(`Chunk upload failed: ${xhr.status}`))
        }
      }

      xhr.onerror = () => reject(new Error('Network error'))

      xhr.open('POST', chunkEndpoint('', params))

      // Set auth header
      const token = getMatrixAccessToken()
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }
      // Set content type to the file's mime type or octet-stream
      xhr.setRequestHeader('Content-Type', context.file.type || 'application/octet-stream')

      xhr.send(buffer)
    })
  }

  private updateProgress(context: ChunkUploadContext, chunkIndex: number, chunkProgress: number): void {
    const elapsed = Date.now() - context.startTime
    const speed = context.uploadedSize / (elapsed / 1000)
    const remaining = speed > 0 ? (context.file.size - context.uploadedSize) / speed : 0

    const chunkProgressArray = context.chunks.map((_c, i) => {
      if (i < chunkIndex) return 1
      if (i === chunkIndex) return chunkProgress
      return 0
    })

    context.onProgress?.({
      loaded: context.uploadedSize,
      total: context.file.size,
      percentage: (context.uploadedSize / context.file.size) * 100,
      speed,
      remaining,
      chunkProgress: chunkProgressArray
    })
  }

  /** Call POST /_matrix/media/v1/upload/chunk/complete to finalize the upload */
  private async completeUpload(context: ChunkUploadContext): Promise<UploadResult> {
    const resp = await fetch(chunkEndpoint('/complete'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ upload_id: context.id })
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`Failed to complete chunked upload: ${resp.status} ${text}`)
    }

    const result = await resp.json()

    return {
      mxcUrl: result.content_uri,
      filename: context.file.name,
      size: result.size ?? context.file.size,
      mimeType: context.file.type
    }
  }

  /** Call POST /_matrix/media/v1/upload/chunk/cancel to cancel an in-progress upload */
  private async cancelUpload(uploadId: string): Promise<void> {
    const resp = await fetch(chunkEndpoint('/cancel'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ upload_id: uploadId })
    })

    if (!resp.ok) {
      logger.error(`[ChunkUpload] Failed to cancel upload ${uploadId}: ${resp.status}`)
    }
  }

  /** Get upload progress from server */
  async getProgress(uploadId: string): Promise<{
    upload_id: string
    uploaded_chunks: number
    total_chunks: number
    uploaded_size: number
    total_size: number | null
    status: string
  } | null> {
    const resp = await fetch(chunkEndpoint('/progress', new URLSearchParams({ upload_id: uploadId })), {
      headers: getAuthHeaders()
    })

    if (!resp.ok) return null
    return resp.json()
  }

  abort(uploadId: string): void {
    const context = this.uploads.get(uploadId)
    if (context) {
      context.aborted = true
      // Fire-and-forget cancel on server
      this.cancelUpload(uploadId).catch(() => {})
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

export const chunkUploadService = new ChunkUploadService()
export default chunkUploadService
