import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'

const logger = createLogger('MatrixMultimediaService')

export interface VoiceMessageConfig {
  maxDuration: number
  sampleRate: number
  mimeType: string
}

export interface RecordingState {
  isRecording: boolean
  duration: number
  audioLevel: number
}

export interface MediaDownload {
  mxcUrl: string
  filename: string
  mimetype: string
  size: number
  progress: number
  status: 'pending' | 'downloading' | 'completed' | 'error'
}

export interface ImageThumbnail {
  url: string
  width: number
  height: number
  size: number
  mimetype: string
}

class MatrixMultimediaService extends BaseMatrixService {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private recordingStartTime: number = 0
  private analyser: AnalyserNode | null = null
  private audioContext: AudioContext | null = null
  private stream: MediaStream | null = null

  private defaultVoiceConfig: VoiceMessageConfig = {
    maxDuration: 120000,
    sampleRate: 48000,
    mimeType: 'audio/ogg;codecs=opus'
  }

  async startVoiceRecording(config: Partial<VoiceMessageConfig> = {}): Promise<void> {
    const finalConfig = { ...this.defaultVoiceConfig, ...config }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      this.audioContext = new AudioContext({ sampleRate: finalConfig.sampleRate })
      const source = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 256
      source.connect(this.analyser)

      const mimeType = MediaRecorder.isTypeSupported(finalConfig.mimeType) ? finalConfig.mimeType : 'audio/webm'

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType })
      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.start(100)
      this.recordingStartTime = Date.now()
      logger.info('[Multimedia] 开始语音录制')
    } catch (err) {
      logger.error(`[Multimedia] 启动语音录制失败: ${err}`)
      throw err
    }
  }

  async stopVoiceRecording(): Promise<{ blob: Blob; duration: number }> {
    if (!this.mediaRecorder) {
      throw new Error(this.t('matrix_error.media.no_active_recording'))
    }

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('[Multimedia] 录制器不可用'))
        return
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/ogg'
        const blob = new Blob(this.audioChunks, { type: mimeType })
        const duration = Date.now() - this.recordingStartTime

        this.cleanup()
        logger.info(`[Multimedia] 语音录制完成: ${duration}ms`)
        resolve({ blob, duration })
      }

      this.mediaRecorder.stop()
    })
  }

  cancelVoiceRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    this.cleanup()
    logger.info('[Multimedia] 取消语音录制')
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.mediaRecorder = null
    this.audioChunks = []
    this.analyser = null
  }

  getAudioLevel(): number {
    if (!this.analyser) return 0

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(dataArray)

    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    return Math.round(sum / dataArray.length)
  }

  getRecordingDuration(): number {
    if (!this.recordingStartTime) return 0
    return Date.now() - this.recordingStartTime
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  async generateThumbnail(file: File, maxWidth: number = 320, maxHeight: number = 240): Promise<ImageThumbnail | null> {
    if (!file.type.startsWith('image/')) {
      return null
    }

    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('[Multimedia] 无法创建 Canvas 上下文'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('[Multimedia] 无法生成缩略图'))
              return
            }

            const url = URL.createObjectURL(blob)
            resolve({
              url,
              width,
              height,
              size: blob.size,
              mimetype: file.type
            })
          },
          file.type,
          0.8
        )

        URL.revokeObjectURL(img.src)
      }
      img.onerror = () => {
        reject(new Error('[Multimedia] 无法加载图片'))
        URL.revokeObjectURL(img.src)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  async generateVideoThumbnail(
    file: File,
    timeOffset: number = 0,
    maxWidth: number = 320,
    maxHeight: number = 240
  ): Promise<ImageThumbnail | null> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.currentTime = timeOffset

      video.onloadeddata = () => {
        const canvas = document.createElement('canvas')
        let { videoWidth: width, videoHeight: height } = video

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('[Multimedia] 无法创建 Canvas 上下文'))
          return
        }

        ctx.drawImage(video, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('[Multimedia] 无法生成视频缩略图'))
              return
            }

            const url = URL.createObjectURL(blob)
            resolve({
              url,
              width,
              height,
              size: blob.size,
              mimetype: 'image/jpeg'
            })
          },
          'image/jpeg',
          0.8
        )

        URL.revokeObjectURL(video.src)
      }
      video.onerror = () => {
        reject(new Error('[Multimedia] 无法加载视频'))
        URL.revokeObjectURL(video.src)
      }
      video.src = URL.createObjectURL(file)
    })
  }

  async downloadMedia(mxcUrl: string, filename: string): Promise<Blob> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }

    try {
      const httpUrl = client.mxcUrlToHttp(mxcUrl)
      if (!httpUrl) {
        throw new Error(this.t('matrix_error.media.invalid_mxc_url'))
      }

      const response = await fetch(httpUrl)
      if (!response.ok) {
        throw new Error(`[Multimedia] 下载失败: ${response.status}`)
      }

      const blob = await response.blob()
      logger.info(`[Multimedia] 下载媒体成功: ${filename}`)
      return blob
    } catch (err) {
      logger.error(`[Multimedia] 下载媒体失败: ${err}`)
      throw err
    }
  }

  async downloadAndSave(mxcUrl: string, filename: string): Promise<void> {
    const blob = await this.downloadMedia(mxcUrl, filename)

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    logger.info(`[Multimedia] 保存文件成功: ${filename}`)
  }

  getMediaDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('image/')) {
        const img = new Image()
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight })
          URL.revokeObjectURL(img.src)
        }
        img.onerror = () => {
          reject(new Error('[Multimedia] 无法加载图片'))
          URL.revokeObjectURL(img.src)
        }
        img.src = URL.createObjectURL(file)
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.onloadedmetadata = () => {
          resolve({ width: video.videoWidth, height: video.videoHeight })
          URL.revokeObjectURL(video.src)
        }
        video.onerror = () => {
          reject(new Error('[Multimedia] 无法加载视频'))
          URL.revokeObjectURL(video.src)
        }
        video.src = URL.createObjectURL(file)
      } else {
        reject(new Error('[Multimedia] 不支持的媒体类型'))
      }
    })
  }

  getMediaDuration(file: File): Promise<number> {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
        const media = file.type.startsWith('video/') ? document.createElement('video') : new Audio()

        media.preload = 'metadata'
        media.onloadedmetadata = () => {
          resolve(Math.round(media.duration * 1000))
          URL.revokeObjectURL(media.src)
        }
        media.onerror = () => {
          reject(new Error('[Multimedia] 无法加载媒体'))
          URL.revokeObjectURL(media.src)
        }
        media.src = URL.createObjectURL(file)
      } else {
        reject(new Error('[Multimedia] 不支持的媒体类型'))
      }
    })
  }

  async compressImage(
    file: File,
    maxWidth: number = 1920,
    maxHeight: number = 1080,
    quality: number = 0.8
  ): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('[Multimedia] 无法创建 Canvas 上下文'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('[Multimedia] 压缩图片失败'))
              return
            }

            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            })
            resolve(compressedFile)
          },
          file.type,
          quality
        )

        URL.revokeObjectURL(img.src)
      }
      img.onerror = () => {
        reject(new Error('[Multimedia] 无法加载图片'))
        URL.revokeObjectURL(img.src)
      }
      img.src = URL.createObjectURL(file)
    })
  }

  getFileIcon(mimetype: string): string {
    if (mimetype.startsWith('image/')) return 'image'
    if (mimetype.startsWith('video/')) return 'video'
    if (mimetype.startsWith('audio/')) return 'audio'
    if (mimetype === 'application/pdf') return 'pdf'
    if (mimetype.includes('word') || mimetype.includes('document')) return 'document'
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return 'spreadsheet'
    if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return 'presentation'
    if (mimetype.startsWith('text/')) return 'text'
    if (mimetype.includes('zip') || mimetype.includes('rar') || mimetype.includes('tar')) return 'archive'
    return 'file'
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i]
  }

  formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }
}

export const matrixMultimediaService = new MatrixMultimediaService()
export default matrixMultimediaService
