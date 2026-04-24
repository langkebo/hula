import { MessageStatusEnum, MsgEnum } from '@/enums'

export interface MessageBody {
  content?: string
  body?: string
  atUidList?: string[]
  url?: string
  text?: string
  fileName?: string
  msgtype?: string
  translatedText?: { text: string; provider?: string; from?: string; to?: string } | null
  mimetype?: string
  size?: number
  duration?: number
  w?: number
  h?: number
  thumbnail_url?: string
  thumbnail_info?: {
    w?: number
    h?: number
    size?: number
    mimetype?: string
  }
  file?: {
    url?: string
    mimetype?: string
    size?: number
  }
  info?: {
    type?: string
    w?: number
    h?: number
    duration?: number
    size?: number
    mimetype?: string
  }
  reply?: {
    id: string
    roomId: string
    body?: string
    uid?: string
    username?: string
    imgCount?: number
  }
  [key: string]: unknown
}

export interface MessageType {
  message: {
    id: string
    roomId: string
    sendTime: number
    type: MsgEnum
    body: MessageBody
    status?: MessageStatusEnum
    messageMarks?: Record<string, { count: number; userMarked: boolean }>
    loading?: boolean
    burnAfterRead?: boolean
    burnRemainingSeconds?: number
    isBurning?: boolean
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

export type RecalledMessage = {
  messageId: string
  content: string
  recallTime: number
  originalType: MsgEnum
}

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

export const pageSize = 20
export const ROOM_MESSAGE_CACHE_LIMIT = 40
export const RECALL_EXPIRATION_TIME = 2 * 60 * 1000
