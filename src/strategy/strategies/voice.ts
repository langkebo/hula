import type { Ref } from 'vue'
import { AppException } from '@/common/exception.ts'
import { MsgEnum, UploadSceneEnum } from '@/enums'
import { type UploadOptions, UploadProviderEnum, useUpload } from '@/hooks/useUpload'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { AbstractMessageStrategy } from './base'

export class VoiceMessageStrategyImpl extends AbstractMessageStrategy {
  constructor() {
    super(MsgEnum.VOICE)
  }

  getMsg(): Record<string, unknown> {
    const voiceMessageDivs = document.querySelectorAll('.voice-message-placeholder')
    const lastVoiceDiv = voiceMessageDivs[voiceMessageDivs.length - 1] as HTMLElement

    const localPath = lastVoiceDiv.dataset.url || ''
    const assetUrl = `asset://${localPath}`

    return {
      type: MsgEnum.VOICE,
      localPath,
      url: assetUrl,
      size: parseInt(lastVoiceDiv.dataset.size || '0', 10),
      duration: parseFloat(lastVoiceDiv.dataset.duration || '0'),
      filename: lastVoiceDiv.dataset.filename || 'voice.mp3',
      mimeType: lastVoiceDiv.dataset.mimeType || 'audio/mpeg'
    }
  }

  buildMessageBody(msg: Record<string, unknown>): Record<string, unknown> {
    return {
      url: msg.url,
      size: msg.size,
      second: Math.round(msg.duration as number),
      fileName: msg.filename,
      mimeType: msg.mimeType
    }
  }

  buildMessageType(
    messageId: string,
    messageBody: Record<string, unknown>,
    globalStore: { currentSessionRoomId: string },
    userUid: Ref<string>
  ): MessageType {
    const baseMessage = super.buildMessageType(messageId, messageBody, globalStore, userUid)
    return {
      ...baseMessage,
      message: {
        ...baseMessage.message,
        type: MsgEnum.VOICE,
        body: {
          url: messageBody.url as string,
          size: messageBody.size as number,
          second: messageBody.second as number,
          fileName: messageBody.fileName as string,
          mimeType: messageBody.mimeType as string
        }
      }
    }
  }

  async uploadFile(
    path: string,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string; config?: Record<string, unknown> }> {
    const uploadHook = useUpload()

    try {
      const uploadOptions: UploadOptions = {
        provider: options?.provider || UploadProviderEnum.DEFAULT,
        scene: UploadSceneEnum.CHAT
      }

      const result = await uploadHook.getUploadAndDownloadUrl(path, uploadOptions)
      if (!result) {
        throw new AppException('获取语音上传链接失败，上传服务不可用')
      }
      return result
    } catch {
      throw new AppException('获取语音上传链接失败，请重试')
    }
  }

  async doUpload(path: string, uploadUrl: string, options?: UploadOptions): Promise<string | void> {
    const uploadHook = useUpload()

    try {
      return await uploadHook.doUpload(path, uploadUrl, { ...options, enableDeduplication: true })
    } catch {
      throw new AppException('语音文件上传失败，请重试')
    }
  }
}
