/**
 * 消息策略相关类型定义
 */

import type { Ref } from 'vue'
import type { MsgEnum, MessageStatusEnum } from '@/enums'
import type { UploadProviderEnum } from '@/hooks/useUpload'

/**
 * 消息体基础接口
 */
export interface MessageBody {
  msgtype?: string
  body?: string
  format?: string
  formatted_body?: string
  url?: string
  info?: MediaInfo
  'm.relates_to'?: RelatesTo
  [key: string]: unknown
}

/**
 * 媒体信息
 */
export interface MediaInfo {
  size?: number
  mimetype?: string
  w?: number
  h?: number
  duration?: number
  thumbnail_url?: string
  thumbnail_info?: ThumbnailInfo
  address?: string
  timestamp?: number
}

/**
 * 缩略图信息
 */
export interface ThumbnailInfo {
  w?: number
  h?: number
  mimetype?: string
  size?: number
}

/**
 * 关联关系
 */
export interface RelatesTo {
  rel_type?: string
  event_id?: string
  'm.in_reply_to'?: {
    event_id: string
  }
}

/**
 * 回复上下文
 */
export interface ReplyContext {
  eventId: string
  senderId: string
  body: string
  msgtype?: string
}

/**
 * 用户信息
 */
export interface UserInfo {
  uid: string
  username: string
  avatar: string
  locPlace?: string
}

/**
 * 消息信息
 */
export interface MessageInfo {
  id: string
  roomId: string
  sendTime: number
  status: MessageStatusEnum
  type: MsgEnum
  body: MessageBody
  messageMarks: Record<string, unknown>
}

/**
 * 消息类型（完整消息对象）
 */
export interface MessageType {
  fromUser: UserInfo
  message: MessageInfo
  sendTime: number
  loading: boolean
}

/**
 * 上传结果
 */
export interface UploadResult {
  uploadUrl: string
  downloadUrl: string
  config?: UploadConfig
}

/**
 * 上传配置
 */
export interface UploadConfig {
  objectKey?: string
  token?: string
  provider?: UploadProviderEnum
  scene?: string
  [key: string]: unknown
}

/**
 * 上传进度
 */
export interface UploadProgress {
  progress: Ref<number>
  onChange: (callback: (progress: number) => void) => void
}

/**
 * 七牛上传结果
 */
export interface QiniuUploadResult {
  qiniuUrl?: string
}

/**
 * 全局 Store 接口
 */
export interface GlobalStore {
  currentSessionRoomId: string
}

/**
 * 通话信息
 */
export interface CallInfo {
  duration: number
  reason: string
  startTime: number
  endTime: number
  creator: string
  isGroup: boolean
}

/**
 * 语音消息数据
 */
export interface VoiceMessageData {
  type: MsgEnum
  url: string
  size: number
  duration: number
  filename: string
}

/**
 * 语音消息体
 */
export interface VoiceMessageBody {
  url: string
  size: number
  second: number
}

/**
 * 通话消息数据
 */
export interface CallMessageData {
  type: MsgEnum
  duration: number
  reason: string
  startTime: number
  endTime: number
  creator: string
  isGroup: boolean
}

/**
 * 通话消息体
 */
export interface CallMessageBody {
  duration: number
  reason: string
  startTime: number
  endTime: number
  creator: string
  isGroup: boolean
}

/**
 * 消息策略接口
 */
export interface MessageStrategy {
  /**
   * 获取消息内容
   */
  getMsg: (
    msgInputValue: string,
    replyValue: MessageType | null,
    fileList?: File[]
  ) => MessageBody | Promise<MessageBody>

  /**
   * 构建消息体
   */
  buildMessageBody: (msg: MessageBody, reply: MessageType | null) => MessageBody

  /**
   * 构建消息类型
   */
  buildMessageType: (
    messageId: string,
    messageBody: MessageBody,
    globalStore: GlobalStore,
    userUid: Ref<string>
  ) => MessageType

  /**
   * 上传文件
   */
  uploadFile: (path: string, options?: { provider?: UploadProviderEnum }) => Promise<UploadResult>

  /**
   * 执行上传
   */
  doUpload: (path: string, uploadUrl: string, options?: Record<string, unknown>) => Promise<QiniuUploadResult | void>

  /**
   * 上传缩略图（可选）
   */
  uploadThumbnail?: (thumbnailFile: File, options?: { provider?: UploadProviderEnum }) => Promise<UploadResult>

  /**
   * 执行缩略图上传（可选）
   */
  doUploadThumbnail?: (
    thumbnailFile: File,
    uploadUrl: string,
    options?: Record<string, unknown>
  ) => Promise<QiniuUploadResult | void>

  /**
   * 获取上传进度（可选）
   */
  getUploadProgress?: () => UploadProgress
}

/**
 * 文件解析结果
 */
export interface ParsedFileInfo {
  name: string
  size: number
  type: string
  path: string
  width?: number
  height?: number
  duration?: number
  thumbnail?: string
}

/**
 * 视频缩略图生成结果
 */
export interface VideoThumbnailResult {
  thumbnail: string
  width: number
  height: number
}

/**
 * 图片尺寸
 */
export interface ImageDimensions {
  width: number
  height: number
}

/**
 * 视频缩略图文件（扩展 File 类型）
 */
export interface VideoThumbnailFile extends File {
  thumbnail?: string
  width?: number
  height?: number
}
