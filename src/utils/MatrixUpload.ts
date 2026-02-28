import { matrixMediaService, matrixEventService } from '@/services/matrix'
import { useMatrixStore } from '@/stores/matrix'
import { info, error } from '@tauri-apps/plugin-log'

export interface MatrixUploadOptions {
  onProgress?: (progress: number) => void
  onSuccess?: (eventId: string) => void
  onError?: (error: Error) => void
}

export interface FileUploadResult {
  contentUri: string
  eventId: string
  size: number
  mimetype: string
}

class MatrixUploadService {
  async uploadAndSendImage(roomId: string, file: File, options: MatrixUploadOptions = {}): Promise<FileUploadResult> {
    const matrixStore = useMatrixStore()
    if (!matrixStore.isLoggedIn) {
      throw new Error('未登录，无法上传文件')
    }

    try {
      const uploadResult = await matrixMediaService.uploadImage(file, options.onProgress)

      const eventId = await matrixEventService.sendImageMessage(
        roomId,
        uploadResult.contentUri,
        {
          size: uploadResult.size,
          mimetype: uploadResult.mimetype,
          width: uploadResult.width,
          height: uploadResult.height
        },
        file.name
      )

      options.onSuccess?.(eventId)
      await info(`[MatrixUpload] 图片上传并发送成功: ${eventId}`)

      return {
        contentUri: uploadResult.contentUri,
        eventId,
        size: uploadResult.size,
        mimetype: uploadResult.mimetype
      }
    } catch (err) {
      const uploadError = err instanceof Error ? err : new Error(String(err))
      options.onError?.(uploadError)
      await error(`[MatrixUpload] 图片上传失败: ${err}`)
      throw uploadError
    }
  }

  async uploadAndSendVideo(roomId: string, file: File, options: MatrixUploadOptions = {}): Promise<FileUploadResult> {
    const matrixStore = useMatrixStore()
    if (!matrixStore.isLoggedIn) {
      throw new Error('未登录，无法上传文件')
    }

    try {
      const uploadResult = await matrixMediaService.uploadVideo(file, options.onProgress)

      const eventId = await matrixEventService.sendVideoMessage(
        roomId,
        uploadResult.contentUri,
        {
          size: uploadResult.size,
          mimetype: uploadResult.mimetype,
          width: uploadResult.width,
          height: uploadResult.height,
          duration: uploadResult.duration
        },
        file.name
      )

      options.onSuccess?.(eventId)
      await info(`[MatrixUpload] 视频上传并发送成功: ${eventId}`)

      return {
        contentUri: uploadResult.contentUri,
        eventId,
        size: uploadResult.size,
        mimetype: uploadResult.mimetype
      }
    } catch (err) {
      const uploadError = err instanceof Error ? err : new Error(String(err))
      options.onError?.(uploadError)
      await error(`[MatrixUpload] 视频上传失败: ${err}`)
      throw uploadError
    }
  }

  async uploadAndSendFile(roomId: string, file: File, options: MatrixUploadOptions = {}): Promise<FileUploadResult> {
    const matrixStore = useMatrixStore()
    if (!matrixStore.isLoggedIn) {
      throw new Error('未登录，无法上传文件')
    }

    try {
      const uploadResult = await matrixMediaService.uploadFile(file, options.onProgress)

      const eventId = await matrixEventService.sendFileMessage(
        roomId,
        uploadResult.contentUri,
        {
          size: uploadResult.size,
          mimetype: uploadResult.mimetype
        },
        file.name
      )

      options.onSuccess?.(eventId)
      await info(`[MatrixUpload] 文件上传并发送成功: ${eventId}`)

      return {
        contentUri: uploadResult.contentUri,
        eventId,
        size: uploadResult.size,
        mimetype: uploadResult.mimetype
      }
    } catch (err) {
      const uploadError = err instanceof Error ? err : new Error(String(err))
      options.onError?.(uploadError)
      await error(`[MatrixUpload] 文件上传失败: ${err}`)
      throw uploadError
    }
  }

  async uploadAndSendAudio(roomId: string, file: File, options: MatrixUploadOptions = {}): Promise<FileUploadResult> {
    const matrixStore = useMatrixStore()
    if (!matrixStore.isLoggedIn) {
      throw new Error('未登录，无法上传文件')
    }

    try {
      const uploadResult = await matrixMediaService.uploadAudio(file, options.onProgress)

      const eventId = await matrixEventService.sendAudioMessage(
        roomId,
        uploadResult.contentUri,
        {
          size: uploadResult.size,
          mimetype: uploadResult.mimetype,
          duration: uploadResult.duration
        },
        file.name
      )

      options.onSuccess?.(eventId)
      await info(`[MatrixUpload] 音频上传并发送成功: ${eventId}`)

      return {
        contentUri: uploadResult.contentUri,
        eventId,
        size: uploadResult.size,
        mimetype: uploadResult.mimetype
      }
    } catch (err) {
      const uploadError = err instanceof Error ? err : new Error(String(err))
      options.onError?.(uploadError)
      await error(`[MatrixUpload] 音频上传失败: ${err}`)
      throw uploadError
    }
  }

  async uploadAndSendVoice(
    roomId: string,
    blob: Blob,
    duration: number,
    options: MatrixUploadOptions = {}
  ): Promise<FileUploadResult> {
    const matrixStore = useMatrixStore()
    if (!matrixStore.isLoggedIn) {
      throw new Error('未登录，无法上传文件')
    }

    try {
      const uploadResult = await matrixMediaService.uploadBlob(blob, 'voice.ogg', 'audio/ogg')

      const eventId = await matrixEventService.sendVoiceMessage(
        roomId,
        uploadResult.contentUri,
        {
          size: uploadResult.size,
          duration
        },
        'voice.ogg'
      )

      options.onSuccess?.(eventId)
      await info(`[MatrixUpload] 语音上传并发送成功: ${eventId}`)

      return {
        contentUri: uploadResult.contentUri,
        eventId,
        size: uploadResult.size,
        mimetype: 'audio/ogg'
      }
    } catch (err) {
      const uploadError = err instanceof Error ? err : new Error(String(err))
      options.onError?.(uploadError)
      await error(`[MatrixUpload] 语音上传失败: ${err}`)
      throw uploadError
    }
  }

  getMediaUrl(mxcUrl: string, width?: number, height?: number): string | null {
    return matrixMediaService.getMediaUrl(mxcUrl, width, height)
  }

  getThumbnailUrl(mxcUrl: string, width: number, height: number): string | null {
    return matrixMediaService.getThumbnailUrl(mxcUrl, width, height)
  }
}

export const matrixUploadService = new MatrixUploadService()
export default matrixUploadService
