/**
 * Message-related type definitions.
 *
 * Moved from @/stores/domains/chat/chat/types to break circular dependencies
 * between service layer and store layer. Services should import types from here;
 * stores re-export from this file for backward compatibility.
 */
import type { MessageStatusEnum, MsgEnum } from '@/enums'

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
  clientKey?: string
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

/**
 * Synapse-Rust 扩展 capability 值类型，与 SDK `ICapability` 对齐。
 * FT-099: 后端 GET /capabilities 返回的扩展能力声明。
 */
export interface SynapseRustCapability {
  enabled: boolean
}

/**
 * Synapse-Rust 扩展 capability key 声明。
 * FT-099: 与 SDK `Capabilities` 接口中的扩展 key 保持一致。
 * 运行时通过 `HULA_CAPABILITY_ALIASES` 解析（见 MatrixCapabilityService.ts）。
 */
export interface SynapseRustCapabilities {
  /** 阅后即焚（burn-after-read feature） */
  'io.hula.burn_after_read'?: SynapseRustCapability
  /** 好友系统（friends feature） */
  'io.hula.friends'?: SynapseRustCapability
  /** 语音消息扩展（voice-extended feature），与 m.voice 别名等价 */
  'io.hula.voice_extended'?: SynapseRustCapability
  /** Matrix 标准语音（与 io.hula.voice_extended 别名等价） */
  'm.voice'?: SynapseRustCapability
  /** OpenClaw 路由（openclaw-routes feature） */
  openclaw?: SynapseRustCapability
  /** AI 连接（ai-connection feature） */
  ai_connection?: SynapseRustCapability
}

export interface MatrixCapabilities {
  unstable_features: Record<string, boolean>
  capabilities: SynapseRustCapabilities & Record<string, unknown>
  client_config: Record<string, unknown>
}
