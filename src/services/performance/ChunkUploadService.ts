import { error, info } from '@tauri-apps/plugin-log'

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

    const uploadId = this.generateUploadId()
    const totalChunks = Math.ceil(file.size / chunkSize)

    const context: ChunkUploadContext = {
      id: uploadId,
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

    this.uploads.set(uploadId, context)

    try {
      const result = await this.processUpload(context)
      info(`[ChunkUpload] 上传完成: ${file.name}`)
      return result
    } catch (err) {
      error(`[ChunkUpload] 上传失败: ${err}`)
      throw err
    } finally {
      this.uploads.delete(uploadId)
    }
  }

  private async processUpload(context: ChunkUploadContext): Promise<UploadResult> {
    const uploadPromises: Promise<void>[] = []
    let _activeCount = 0

    const processNext = async () => {
      while (!context.aborted) {
        const chunk = context.chunks.find((c) => c.status === 'pending')
        if (!chunk) break

        chunk.status = 'uploading'
        _activeCount++

        try {
          await this.uploadChunk(context, chunk)
          chunk.status = 'completed'
          context.onChunkComplete?.(chunk.index, context.totalChunks)
        } catch (err) {
          chunk.retryCount++
          if (chunk.retryCount >= context.maxRetries) {
            chunk.status = 'failed'
            throw err
          }
          chunk.status = 'pending'
        } finally {
          _activeCount--
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

  private async uploadChunk(context: ChunkUploadContext, chunk: ChunkInfo): Promise<void> {
    const slice = context.file.slice(chunk.start, chunk.end)
    const formData = new FormData()
    formData.append('chunk', slice)
    formData.append('index', chunk.index.toString())
    formData.append('total', context.totalChunks.toString())
    formData.append('filename', context.file.name)

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

      xhr.open('POST', '/_matrix/media/v1/upload/chunk')
      xhr.setRequestHeader('Content-Type', 'multipart/form-data')
      xhr.send(formData)
    })
  }

  private updateProgress(context: ChunkUploadContext, chunkIndex: number, chunkProgress: number): void {
    const elapsed = Date.now() - context.startTime
    const speed = context.uploadedSize / (elapsed / 1000)
    const remaining = (context.file.size - context.uploadedSize) / speed

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

  private async completeUpload(context: ChunkUploadContext): Promise<UploadResult> {
    return {
      mxcUrl: `mxc://server/${context.id}`,
      filename: context.file.name,
      size: context.file.size,
      mimeType: context.file.type
    }
  }

  abort(uploadId: string): void {
    const context = this.uploads.get(uploadId)
    if (context) {
      context.aborted = true
      info(`[ChunkUpload] 上传已取消: ${uploadId}`)
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

  private generateUploadId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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
