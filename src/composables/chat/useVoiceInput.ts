import { readFile } from '@tauri-apps/plugin-fs'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import matrixVoiceService from '@/services/matrix/media/MatrixVoiceService'

type VoiceUploadResult = Awaited<ReturnType<typeof matrixVoiceService.uploadVoice>>

interface VoiceInputHook {
  /**
   * 读取本地语音文件后交给 `matrixVoiceService.uploadVoice` 或加密上传。
   */
  uploadVoiceToMatrix: (
    roomId: string,
    localPath: string,
    filename: string,
    mimeType: string
  ) => Promise<VoiceUploadResult>
}

export function useVoiceInput(): VoiceInputHook {
  const uploadVoiceToMatrix = async (
    roomId: string,
    localPath: string,
    filename: string,
    mimeType: string
  ): Promise<VoiceUploadResult> => {
    const fileBytes = await readFile(localPath)
    const file = new File([fileBytes], filename, { type: mimeType })

    // 检查房间是否加密
    const isEncrypted = await cryptoSDKAdapter.isRoomEncrypted(roomId)

    if (isEncrypted) {
      // 加密房间：使用加密上传
      const result = await matrixMediaService.uploadEncryptedFile(file)
      // 返回兼容 VoiceUploadResult 的格式
      return {
        mxcUrl: result.contentUri,
        httpUrl: matrixMediaService.getMediaUrl(result.contentUri) || undefined,
        filename,
        encryptedFile: result.encryptedFile
      }
    }

    // 普通房间
    return await matrixVoiceService.uploadVoice(roomId, file)
  }

  return { uploadVoiceToMatrix }
}
