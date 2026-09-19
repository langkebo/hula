import { readFile } from '@tauri-apps/plugin-fs'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import matrixVoiceService from '@/services/matrix/media/MatrixVoiceService'
import { getAudioDuration } from '@/services/matrix/media/mediaMetadata'

type VoiceUploadResult = Awaited<ReturnType<typeof matrixVoiceService.uploadVoice>>

interface VoiceInputHook {
  /**
   * 读取本地语音文件后交给 `matrixVoiceService.uploadVoice` 或加密上传。
   *
   * Phase 2.3: 加密房间语音现在走两步：
   * 1. 使用 `matrixMediaService.uploadEncryptedFile` 上传加密文件到标准 media 端点
   * 2. 调用 `matrixVoiceService.registerEncryptedVoice` 登记到 voice_usage_stats 表
   */
  uploadVoiceToMatrix: (
    roomId: string,
    localPath: string,
    filename: string,
    mimeType: string
  ) => Promise<VoiceUploadResult>
}

/**
 * 从 mxc:// URL 中提取 media_id
 * 格式: mxc://server_name/media_id -> 返回 media_id
 */
function extractMediaIdFromMxc(mxcUrl: string): string {
  const match = mxcUrl.match(/^mxc:\/\/[^/]+\/(.+)$/)
  return match ? match[1] : mxcUrl
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
      // 加密房间：使用加密上传 + 登记到 voice_usage_stats 表
      const result = await matrixMediaService.uploadEncryptedFile(file)

      // Phase 2.3: 注册到 voice_usage_stats 表，使其出现在列表中
      const mediaId = extractMediaIdFromMxc(result.contentUri)
      const durationMs = await getAudioDuration(file)

      await matrixVoiceService.registerEncryptedVoice(
        roomId,
        mediaId,
        durationMs,
        result.size,
        result.mimetype
      )

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
