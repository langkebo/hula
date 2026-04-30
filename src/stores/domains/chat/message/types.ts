/**
 * Message Store 类型定义
 */
import type { MessageStatusEnum, MsgEnum } from '@/enums'

/**
 * 消息数据结构
 */
export interface MessageType {
  message: {
    id: string
    roomId: string
    sendTime: number
    type: MsgEnum
    body: Record<string, unknown>
    status?: MessageStatusEnum
    messageMarks?: Record<string, { count: number; userMarked: boolean }>
    loading?: boolean
    /** 是否阅后即焚 */
    burnAfterRead?: boolean
    /** 阅后即焚剩余秒数 */
    burnRemainingSeconds?: number
    /** 是否正在销毁中 */
    isBurning?: boolean
    /** 是否已销毁 */
    isBurned?: boolean
  }
  fromUser: {
    uid: string
    username?: string
    avatar?: string
    locPlace?: string
  }
  timeBlock?: number
  uploadProgress?: number
  isCheck?: boolean
  sendTime?: number
  loading?: boolean
}

/**
 * 已撤回消息
 */
export type RecalledMessage = {
  messageId: string
  content: string
  recallTime: number
  originalType: MsgEnum
}

/**
 * 自定义转发任务
 */
export type CustomForwardTask = {
  id: string
  type: MsgEnum.IMAGE
  fileName: string
  mimeType: string
  bytes: Uint8Array
  previewUrl: string
  width: number
  height: number
  size: number
}

/**
 * 消息选项配置
 */
export interface MessageOptions {
  isLast: boolean
  isLoading: boolean
  cursor: string
}

/**
 * 新消息计数
 */
export interface NewMsgCount {
  count: number
  isStart: boolean
}

/**
 * 回复映射
 */
export type ReplyMapping = Record<string, string[]>
