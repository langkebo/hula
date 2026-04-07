/**
 * Matrix API 类型定义
 * 用于替代服务层的 any[] 和 Record<string, any> 类型
 */

// ==================== AI 服务相关类型 ====================

export interface AIModel {
  id: string
  name: string
  provider: string
  config: {
    apiKey?: string
    baseUrl?: string
    maxTokens?: number
    temperature?: number
  }
  createdAt: number
  updatedAt: number
}

export interface AIModelListResponse {
  list: AIModel[]
  total: number
}

export interface AIImage {
  id: string
  url: string
  width: number
  height: number
  format: 'png' | 'jpg' | 'webp' | 'gif'
  size: number
  createdAt: number
}

export interface AIImageListResponse {
  list: AIImage[]
  total: number
}

export interface AIVideo {
  id: string
  url: string
  width: number
  height: number
  duration: number
  format: 'mp4' | 'webm' | 'mov'
  size: number
  createdAt: number
}

export interface AIVideoListResponse {
  list: AIVideo[]
  total: number
}

export interface AIAudio {
  id: string
  url: string
  duration: number
  format: 'mp3' | 'wav' | 'ogg' | 'm4a'
  size: number
  createdAt: number
}

export interface AIAudioListResponse {
  list: AIAudio[]
  total: number
}

export interface AIVoice {
  id: string
  name: string
  language: string
  gender: 'male' | 'female' | 'neutral'
  preview?: string
}

export interface AIChatRole {
  id: string
  name: string
  description?: string
  avatar?: string
  systemPrompt?: string
  model?: string
  createdAt: number
}

export interface AIChatRoleListResponse {
  list: AIChatRole[]
  total: number
}

// ==================== 搜索服务相关类型 ====================

export interface SearchEventContext {
  eventsBefore: SearchEvent[]
  eventsAfter: SearchEvent[]
}

export interface SearchEvent {
  eventId: string
  roomId: string
  sender: string
  type: string
  content: Record<string, unknown>
  originServerTs: number
}

export interface SearchResult {
  eventId: string
  roomId: string
  sender: string
  content: string
  timestamp: number
  highlights: string[]
  context?: SearchEventContext
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  nextBatch?: string
}

export interface UserSearchResult {
  userId: string
  displayName?: string
  avatarUrl?: string
}

// ==================== 管理服务相关类型 ====================

export interface AdminUser {
  userId: string
  displayName?: string
  avatarUrl?: string
  isAdmin: boolean
  isDeactivated: boolean
  createdAt: number
  lastSeenTs?: number
}

export interface AdminRoom {
  roomId: string
  name?: string
  topic?: string
  avatarUrl?: string
  memberCount: number
  isPublic: boolean
  createdAt: number
  creator: string
}

export interface ServerStats {
  userCount: number
  roomCount: number
  messageCount: number
  storageUsed: number
  uptime: number
  version: string
}

// ==================== 审核服务相关类型 ====================

export interface ModerationRule {
  id: string
  type: 'ban' | 'mute' | 'warn'
  pattern: string
  reason: string
  createdBy: string
  createdAt: number
  isActive: boolean
}

export interface ModerationAction {
  id: string
  type: 'ban' | 'mute' | 'warn' | 'delete'
  targetUserId: string
  targetRoomId?: string
  targetEventId?: string
  reason: string
  duration?: number
  performedBy: string
  performedAt: number
}

// ==================== Widget 服务相关类型 ====================

export interface WidgetData {
  type: string
  url?: string
  name?: string
  data?: Record<string, unknown>
}

export interface WidgetEventContent {
  type?: string
  url?: string
  name?: string
  data?: Record<string, unknown>
}

// ==================== VoIP 服务相关类型 ====================

export interface VoIPFeed {
  id: string
  stream: MediaStream
  purpose: 'usermedia' | 'screenshare'
  audioMuted: boolean
  videoMuted: boolean
}

// ==================== 表情包服务相关类型 ====================

export interface EmojiPackImage {
  url: string
  body: string
  info?: {
    w?: number
    h?: number
    mimetype?: string
    size?: number
  }
  usage?: string[]
}

export interface EmojiPack {
  id: string
  name: string
  avatarUrl?: string
  attribution?: string
  description?: string
  isPublic?: boolean
  images: Record<string, EmojiPackImage>
}

export interface EmojiPackResponse {
  packs: Record<string, EmojiPackData>
}

export interface EmojiPackData {
  name: string
  avatar_url?: string
  attribution?: string
  description?: string
  isPublic?: boolean
  emoticons: Record<string, EmojiImageData>
}

export interface EmojiImageData {
  url: string
  body: string
  info?: {
    w?: number
    h?: number
    mimetype?: string
    size?: number
  }
  usage?: string[]
}

// ==================== 消息服务相关类型 ====================

export interface ReadReceipt {
  eventId: string
  ts: number
  userId: string
}

export interface ReadReceiptResponse {
  [userId: string]: {
    data: {
      [eventId: string]: ReadReceipt
    }
  }
}

// ==================== 服务器通知相关类型 ====================

export interface ServerNotification {
  notificationId: string
  roomId: string
  eventId: string
  userId: string
  type: string
  severity?: 'info' | 'warning' | 'error'
  title?: string
  content?: string
  timestamp: number
  active?: boolean
  read?: boolean
  dismissed?: boolean
  data?: Record<string, unknown>
}

// ==================== 脱水设备相关类型 ====================

export interface DehydratedDeviceData {
  deviceId: string
  deviceData?: Record<string, unknown>
  algorithm?: string
  format?: string
  account?: string
}

export interface DehydratedDeviceKey {
  deviceId: string
  key: string
  deviceData?: Record<string, unknown>
}

// ==================== 扩展服务相关类型 ====================

export interface SynapseExtensionEvent {
  eventId: string
  roomId: string
  sender: string
  type: string
  content: Record<string, unknown>
  originServerTs: number
}

// ==================== 分页请求参数 ====================

export interface PaginationParams {
  pageNo?: number
  pageSize?: number
  nextBatch?: string
  prevBatch?: string
}

export interface PaginationResponse<T> {
  list: T[]
  total: number
  nextBatch?: string
  prevBatch?: string
}

// ==================== 消息服务相关类型 ====================

export interface MessageData {
  msgId: string
  roomId: string
  content: Record<string, unknown>
  sender: string
  timestamp: number
  type: string
}

export interface MessageListByIdsParams {
  msgIds?: string[]
  async?: boolean
}

// ==================== 搜索上下文类型 ====================

export interface SearchEventContext {
  eventsBefore: MessageEvent[]
  eventsAfter: MessageEvent[]
  profileInfo?: {
    displayname?: string
    avatar_url?: string
  }
}
