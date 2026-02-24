import type { MatrixClient } from 'matrix-js-sdk'
import { matrixClientService } from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

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

class MatrixMediaServiceClass {
  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }

  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<UploadResult> {
    const client = this.getClient()

    try {
      const uploadResponse = await client.uploadContent(file, {
        name: file.name,
        type: file.type,
        progressHandler: onProgress
          ? (ev: ProgressEvent) => {
              onProgress(Math.round((ev.loaded / ev.total) * 100))
            }
          : undefined
      })

      const contentUri = typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
      info(`[MatrixMedia] 文件上传成功: ${contentUri}`)
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

  async uploadImage(file: File, onProgress?: (progress: number) => void): Promise<UploadResult & MediaInfo> {
    const client = this.getClient()

    try {
      const dimensions = await this.getImageDimensions(file)

      const uploadResponse = await client.uploadContent(file, {
        name: file.name,
        type: file.type,
        progressHandler: onProgress
          ? (ev: ProgressEvent) => {
              onProgress(Math.round((ev.loaded / ev.total) * 100))
            }
          : undefined
      })

      const contentUri = typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
      info(`[MatrixMedia] 图片上传成功: ${contentUri}`)
      return {
        contentUri,
        size: file.size,
        mimetype: file.type || 'image/png',
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

      const uploadResponse = await client.uploadContent(file, {
        name: file.name,
        type: file.type,
        progressHandler: onProgress
          ? (ev: ProgressEvent) => {
              onProgress(Math.round((ev.loaded / ev.total) * 100))
            }
          : undefined
      })

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

      const uploadResponse = await client.uploadContent(file, {
        name: file.name,
        type: file.type,
        progressHandler: onProgress
          ? (ev: ProgressEvent) => {
              onProgress(Math.round((ev.loaded / ev.total) * 100))
            }
          : undefined
      })

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

  async uploadBlob(blob: Blob, filename: string, mimetype: string): Promise<UploadResult> {
    const client = this.getClient()

    try {
      const uploadResponse = await client.uploadContent(blob, {
        name: filename,
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
