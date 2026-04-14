import type { MatrixClient } from 'matrix-js-sdk'
import type { UploadContentOptions, UploadContentResponse } from '@/types/matrix-api'
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'
import { compressImage, isImageFile, formatFileSize } from '@/utils/ImageUtils'
import { LRUCache } from '@/utils/LRUCache'

export interface UploadResult {
  contentUri: string
  size: number
  mimetype: string
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

class MatrixMediaServiceClass extends BaseManager {
  private compressOptions: CompressOptions = { ...DEFAULT_COMPRESS_OPTIONS }
  private enableCompression = true
  private mediaManager: any = null
  private mxcUrlCache = new LRUCache<string, string>(500)

  setCompressOptions(options: CompressOptions) {
    this.compressOptions = { ...DEFAULT_COMPRESS_OPTIONS, ...options }
  }

  setEnableCompression(enable: boolean) {
    this.enableCompression = enable
  }

  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }

  private getMediaManager() {
    const client = this.getClient()
    this.mediaManager = (client as any).getMediaManager?.() ?? null
    return this.mediaManager
  }

  async uploadFile(file: File, _onProgress?: (progress: number) => void): Promise<UploadResult> {
    const manager = this.getMediaManager()
    let contentUri: string

    if (manager) {
      const result = await manager.uploadContent(file, { type: file.type })
      contentUri = typeof result === 'string' ? result : result.content_uri
    } else {
      const client = this.getClient()
      const uploadResponse = (await client.uploadContent(file, {
        type: file.type
      } as UploadContentOptions)) as string | UploadContentResponse
      contentUri = typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
    }

    info(`[MatrixMedia] 文件上传成功: ${contentUri}`)

    const telemetry = matrixClientService.getTelemetry()
    if (telemetry) {
      telemetry.trackMediaUploaded(file.size, file.type || 'application/octet-stream')
    }

    return {
      contentUri,
      size: file.size,
      mimetype: file.type || 'application/octet-stream'
    }
  }

  async uploadImage(file: File, _onProgress?: (progress: number) => void): Promise<UploadResult & MediaInfo> {
    const client = this.getClient()
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
      } catch (_compressErr) {}
    }

    const uploadResponse = (await client.uploadContent(fileToUpload, {
      type: fileToUpload.type
    } as UploadContentOptions)) as string | UploadContentResponse

    const contentUri = typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
    info(`[MatrixMedia] 图片上传成功: ${contentUri}`)
    return {
      contentUri,
      size: compressedSize,
      mimetype: fileToUpload.type || 'image/png',
      width: dimensions.width,
      height: dimensions.height
    }
  }

  async uploadVideo(file: File, _onProgress?: (progress: number) => void): Promise<UploadResult & MediaInfo> {
    const client = this.getClient()
    const metadata = await this.getVideoMetadata(file)

    const uploadResponse = (await client.uploadContent(file, {
      type: file.type
    } as UploadContentOptions)) as string | UploadContentResponse

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
  }

  async uploadAudio(file: File, _onProgress?: (progress: number) => void): Promise<UploadResult & MediaInfo> {
    const client = this.getClient()
    const duration = await this.getAudioDuration(file)

    const uploadResponse = (await client.uploadContent(file, {
      type: file.type
    } as UploadContentOptions)) as string | UploadContentResponse

    const contentUri = typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
    info(`[MatrixMedia] 音频上传成功: ${contentUri}`)
    return {
      contentUri,
      size: file.size,
      mimetype: file.type || 'audio/ogg',
      duration
    }
  }

  async uploadBlob(blob: Blob, _filename: string, mimetype: string): Promise<UploadResult> {
    const client = this.getClient()
    const uploadResponse = (await client.uploadContent(blob, {
      type: mimetype
    } as UploadContentOptions)) as string | UploadContentResponse

    const contentUri = typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
    info(`[MatrixMedia] Blob 上传成功: ${contentUri}`)
    return {
      contentUri,
      size: blob.size,
      mimetype
    }
  }

  mxcUrlToHttp(mxcUrl: string, width?: number, height?: number, resizeMethod?: 'scale' | 'crop'): string | null {
    if (!mxcUrl || !mxcUrl.startsWith('mxc://')) {
      return null
    }

    const cacheKey = `${mxcUrl}:${width || 0}:${height || 0}:${resizeMethod || 'scale'}`
    const cached = this.mxcUrlCache.get(cacheKey)
    if (cached !== undefined) return cached

    const client = matrixClientService.getClient()
    if (!client) return null

    let result: string | null
    if (width && height) {
      result = client.mxcUrlToHttp(mxcUrl, width, height, resizeMethod || 'scale') ?? null
    } else {
      result = client.mxcUrlToHttp(mxcUrl) ?? null
    }

    if (result) this.mxcUrlCache.set(cacheKey, result)
    return result
  }

  getMediaUrl(mxcUrl: string, width?: number, height?: number): string | null {
    if (!mxcUrl || !mxcUrl.startsWith('mxc://')) {
      return null
    }

    const cacheKey = `${mxcUrl}:${width || 0}:${height || 0}:scale`
    const cached = this.mxcUrlCache.get(cacheKey)
    if (cached !== undefined) return cached

    const client = this.getClient()

    let result: string | null
    if (width && height) {
      result = client.mxcUrlToHttp(mxcUrl, width, height, 'scale') ?? null
    } else {
      result = client.mxcUrlToHttp(mxcUrl) ?? null
    }

    if (result) this.mxcUrlCache.set(cacheKey, result)
    return result
  }

  getThumbnailUrl(mxcUrl: string, width: number, height: number): string | null {
    if (!mxcUrl || !mxcUrl.startsWith('mxc://')) {
      return null
    }

    const cacheKey = `${mxcUrl}:${width}:${height}:scale`
    const cached = this.mxcUrlCache.get(cacheKey)
    if (cached !== undefined) return cached

    const client = this.getClient()
    const result = client.mxcUrlToHttp(mxcUrl, width, height, 'scale') ?? null
    if (result) this.mxcUrlCache.set(cacheKey, result)
    return result
  }

  async deleteMedia(serverName: string, mediaId: string): Promise<void> {
    const manager = this.getMediaManager()
    if (manager) {
      await manager.deleteMedia(serverName, mediaId)
      info(`[MatrixMedia] 媒体已删除: ${serverName}/${mediaId}`)
    } else {
      throw new Error('MediaManager 不可用，无法删除媒体')
    }
  }

  async previewUrl(url: string): Promise<{ title?: string; description?: string; image?: string } | null> {
    const manager = this.getMediaManager()
    if (manager) {
      return await manager.previewUrl(url)
    }
    return null
  }

  async uploadContentWithId(
    serverName: string,
    mediaId: string,
    content: Blob | File,
    contentType: string,
    throwOnError = false
  ): Promise<string | null> {
    try {
      const manager = this.getMediaManager()
      if (!manager) throw new Error('MediaManager 不可用')
      const result = await manager.uploadContentWithId(serverName, mediaId, content, contentType)
      return result?.content_uri ?? null
    } catch (error) {
      return this.handleError(error, 'uploadContentWithId', null, throwOnError)
    }
  }

  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
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
    })
  }

  private getVideoMetadata(file: File): Promise<{ width: number; height: number; duration: number }> {
    return new Promise((resolve, reject) => {
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
    })
  }

  private getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
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
    })
  }
}

export const matrixMediaService = new MatrixMediaServiceClass()
export default matrixMediaService
