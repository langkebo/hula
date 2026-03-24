import type { MatrixClient } from 'matrix-js-sdk'
import { matrixClientService } from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'
import { compressImage, isImageFile, formatFileSize } from '@/utils/ImageUtils'

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

class MatrixMediaServiceClass {
  private compressOptions: CompressOptions = { ...DEFAULT_COMPRESS_OPTIONS }
  private enableCompression = true

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

  async uploadFile(file: File, _onProgress?: (progress: number) => void): Promise<UploadResult> {
    const client = this.getClient()

    try {
      const uploadResponse = await client.uploadContent(file, {
        type: file.type
      } as any)

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

  async uploadImage(file: File, _onProgress?: (progress: number) => void): Promise<UploadResult & MediaInfo> {
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

      const uploadResponse = await client.uploadContent(fileToUpload, {
        type: fileToUpload.type
      } as any)

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

  async uploadVideo(file: File, _onProgress?: (progress: number) => void): Promise<UploadResult & MediaInfo> {
    const client = this.getClient()

    try {
      const metadata = await this.getVideoMetadata(file)

      const uploadResponse = await client.uploadContent(file, {
        type: file.type
      } as any)

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

  async uploadAudio(file: File, _onProgress?: (progress: number) => void): Promise<UploadResult & MediaInfo> {
    const client = this.getClient()

    try {
      const duration = await this.getAudioDuration(file)

      const uploadResponse = await client.uploadContent(file, {
        type: file.type
      } as any)

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
      } as any)

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
