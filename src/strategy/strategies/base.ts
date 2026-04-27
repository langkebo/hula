import { type Ref } from 'vue'
import { MessageStatusEnum, type MsgEnum } from '@/enums'
import { useGroupStore } from '@/stores/domains/chat/group'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { AppException } from '@/common/exception.ts'
import { type UploadOptions, type UploadProviderEnum } from '@/hooks/useUpload'
import { createLogger } from '@/utils/Logger'

export const strategyLogger = createLogger('MessageStrategy')

export interface ReplyRef {
  content: string
  key: string
}

export interface ImageInfo {
  width: number
  height: number
  size: number
}

export interface CallInfo {
  duration: number
  reason: string
  startTime: number
  endTime: number
  creator: string
  isGroup: boolean
}

export interface MessageStrategy {
  getMsg: (
    msgInputValue: string,
    replyValue: MessageType | null,
    fileList?: File[]
  ) => Record<string, unknown> | Promise<Record<string, unknown>>
  buildMessageBody: (msg: Record<string, unknown>, reply: MessageType | null) => Record<string, unknown>
  buildMessageType: (
    messageId: string,
    messageBody: Record<string, unknown>,
    globalStore: { currentSessionRoomId: string },
    userUid: Ref<string>
  ) => MessageType
  uploadFile: (
    path: string,
    options?: { provider?: UploadProviderEnum }
  ) => Promise<{ uploadUrl: string; downloadUrl: string; config?: Record<string, unknown> }>
  doUpload: (path: string, uploadUrl: string, options?: UploadOptions) => Promise<string | void>
  uploadThumbnail?: (
    thumbnailFile: File,
    options?: { provider?: UploadProviderEnum }
  ) => Promise<{ uploadUrl: string; downloadUrl: string; config?: Record<string, unknown> }>
  doUploadThumbnail?: (thumbnailFile: File, uploadUrl: string, options?: UploadOptions) => Promise<string | void>
  getUploadProgress?: () => { progress: Ref<number>; onChange: (callback: (progress: number) => void) => void }
}

/**
 * 消息策略抽象类，所有消息策略都必须实现这个接口
 */
export abstract class AbstractMessageStrategy implements MessageStrategy {
  public readonly msgType: MsgEnum

  constructor(msgType: MsgEnum) {
    this.msgType = msgType
  }

  buildMessageType(
    messageId: string,
    messageBody: Record<string, unknown>,
    globalStore: { currentSessionRoomId: string },
    userUid: Ref<string>
  ): MessageType {
    const currentTime = new Date().getTime()
    const groupStore = useGroupStore()
    return {
      fromUser: {
        uid: userUid.value || '',
        username: groupStore.getUserInfo(userUid.value)?.name || '',
        avatar: groupStore.getUserInfo(userUid.value)?.avatar || '',
        locPlace: groupStore.getUserInfo(userUid.value)?.locPlace || ''
      },
      message: {
        id: messageId,
        roomId: globalStore.currentSessionRoomId,
        sendTime: currentTime,
        status: MessageStatusEnum.PENDING,
        type: this.msgType,
        body: messageBody,
        messageMarks: {}
      },
      sendTime: Date.now(),
      loading: false
    }
  }

  abstract buildMessageBody(msg: Record<string, unknown>, reply: MessageType | null): Record<string, unknown>

  abstract getMsg(
    msgInputValue: string,
    replyValue: MessageType | null,
    fileList?: File[]
  ): Record<string, unknown> | Promise<Record<string, unknown>>

  uploadFile(
    path: string,
    options?: { provider?: UploadProviderEnum }
  ): Promise<{ uploadUrl: string; downloadUrl: string }> {
    strategyLogger.debug('Base uploadFile method called with:', path, options)
    throw new AppException('该消息类型不支持文件上传')
  }

  doUpload(path: string, uploadUrl: string, options?: UploadOptions): Promise<string | void> {
    strategyLogger.debug('Base doUpload method called with:', path, uploadUrl, options)
    throw new AppException('该消息类型不支持文件上传')
  }
}
