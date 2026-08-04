import type { Ref } from 'vue'
import { AppException } from '@/common/exception.ts'
import type { UploadOptions, UploadProviderEnum } from '@/composables/common/useUpload'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { useGroupStore } from '@/stores/domains/chat/group'
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

/** 消息上下文菜单支持的动作 */
export type MessageAction = 'recall' | 'edit' | 'reply' | 'forward' | 'mark' | 'pin' | 'copy' | 'delete'

/** 动作可见性上下文 */
export interface MessageActionContext {
  isMe: boolean
  canModerate: boolean
  isPinned: boolean
}

export interface MessageStrategy {
  /** 消息类型标识 */
  readonly msgType: MsgEnum
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
  /** 返回该消息类型在给定上下文下可见的菜单动作列表 */
  getAllowedActions?: (context: MessageActionContext) => MessageAction[]
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
      clientKey: messageId,
      fromUser: {
        uid: userUid.value || '',
        username: groupStore.getUserInfo(userUid.value)?.name || '',
        avatar: groupStore.getUserInfo(userUid.value)?.avatar || ''
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

  /**
   * 默认动作集：可被具体策略覆盖。
   * - 系统/撤回/未知消息：返回空数组（无任何操作）
   * - 文本：可复制（EMOJI 仅有 url，无可复制文本，故排除）
   * - 其他媒体类型：不可复制
   * - 编辑/撤回：仅 own 消息（撤回还需 canModerate）
   * - 置顶/删除：仅 canModerate
   * - 回复/转发/标记：所有可见消息
   */
  getAllowedActions(context: MessageActionContext): MessageAction[] {
    const actions: MessageAction[] = ['reply', 'forward', 'mark']

    // 可复制类型：仅 TEXT（EMOJI body 仅含 url，无可复制文本）
    if (this.msgType === MsgEnum.TEXT) {
      actions.push('copy')
    }

    // 仅自己消息可编辑
    if (context.isMe) {
      actions.push('edit')
      // 撤回需要管理权限（防止普通用户撤回他人消息；自己的消息也走此通道）
      if (context.canModerate) {
        actions.push('recall')
      }
    }

    // 置顶/删除需要管理权限
    if (context.canModerate) {
      actions.push('pin')
      actions.push('delete')
    }

    return actions
  }
}
