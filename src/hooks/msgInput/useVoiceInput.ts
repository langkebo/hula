import { readFile } from '@tauri-apps/plugin-fs'
import matrixVoiceService from '@/services/matrix/media/MatrixVoiceService'

type VoiceUploadResult = Awaited<ReturnType<typeof matrixVoiceService.uploadVoice>>

export interface VoiceInputHook {
  /**
   * 读取本地语音文件后交给 `matrixVoiceService.uploadVoice` 上传。
   *
   * 封装原 `useMsgInput.ts` 中的 `uploadVoiceToMatrix`，便于：
   * - 在 `send` / `sendVoiceDirect` 两处共用；
   * - 单测可直接替换 `matrixVoiceService`。
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
    return await matrixVoiceService.uploadVoice(roomId, new File([fileBytes], filename, { type: mimeType }))
  }

  return { uploadVoiceToMatrix }
}
