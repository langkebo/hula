import type { Ref } from 'vue'
import { AppException } from '@/common/exception.ts'
import type { UploadOptions, UploadProviderEnum } from '@/composables/common/useUpload'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat/message'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'

export const strategyLogger = createLogger('MessageStrategy')

export interface ReplyRef {
  content: string
  key: string
}

/** UI 侧引用状态（扁平结构） */
export interface ReplyStateLike {
  content: string
  key: string | number
  accountName?: string
}

/** 引用输入：兼容 UI 扁平结构与本项目历史单测使用的 MessageType 结构 */
export interface ReplyInput extends Partial<ReplyStateLike> {
  message?: { id?: string; body?: { content?: string } }
  fromUser?: { username?: string }
}

export interface ReplyTarget {
  content: string
  key: string
  username: string
}

/**
 * 归一化引用输入：UI 传入的是扁平 ReplyState，历史单测传的是 MessageType 结构，
 * 策略层只依赖归一化后的 { content, key, username }，避免运行时读到 undefined 导致引用丢失。
 * content 缺失或 key 为空视为未引用。
 */
export function resolveReplyTarget(reply: ReplyInput | null | undefined): ReplyTarget | null {
  const content = reply?.content ?? reply?.message?.body?.content
  const key = reply?.key ?? reply?.message?.id
  if (!content || key === undefined || key === null || key === '') {
    return null
  }
  return {
    content,
    key: String(key),
    username: reply?.accountName ?? reply?.fromUser?.username ?? ''
  }
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
    replyValue: ReplyInput | null,
    fileList?: File[]
  ) => Record<string, unknown> | Promise<Record<string, unknown>>
  buildMessageBody: (msg: Record<string, unknown>, reply: ReplyInput | null) => Record<string, unknown>
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
  getUploadProgress?: () => {
    progress: Ref<number>
    /** 返回取消监听函数，避免上传多次后监听器累积 */
    onChange: (callback: (progress: number) => void) => () => void
  }
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
    // 本地回显的身份必须用会话权威 userId 兜底：切换账号后 userInfo.uid 可能滞后为空，
    // 回显消息 uid 一旦为空会被 useMessageUser 判成「非本人」，自己的消息被渲染成对方消息
    // （左对齐 + 作者显示「未知用户」）。用户名/头像同样回退到本人资料，避免空名。
    const selfUid = userUid.value || useMatrixStore().userId || ''
    const cachedUser = selfUid ? groupStore.getUserInfo(selfUid) : null
    const userStore = useUserStore()
    const ownProfile = selfUid && userStore.userInfo?.uid === selfUid ? userStore.userInfo : undefined
    return {
      clientKey: messageId,
      fromUser: {
        uid: selfUid,
        username: cachedUser?.name || ownProfile?.name || '',
        avatar: cachedUser?.avatar || ownProfile?.avatar || ''
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

  abstract buildMessageBody(msg: Record<string, unknown>, reply: ReplyInput | null): Record<string, unknown>

  abstract getMsg(
    msgInputValue: string,
    replyValue: ReplyInput | null,
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
