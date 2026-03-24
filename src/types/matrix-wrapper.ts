// =============================================================================
// Matrix SDK 类型包装层
// =============================================================================
// 核心思想：适配器模式 - 创建稳定的内部类型层，隔离 SDK 变化
//
// 使用方式：
// 1. 内部代码使用 StableMessageContent 等稳定类型
// 2. 调用 SDK 时使用 as unknown as X 进行安全类型转换
// 3. SDK 返回值通过类型守卫进行安全处理
// =============================================================================

import type { MatrixEvent, Room, User, RoomMember } from 'matrix-js-sdk'

// =============================================================================
// 稳定的 MsgType 枚举 (避免依赖 SDK)
// =============================================================================
export enum StableMsgType {
  Text = 'm.text',
  Emote = 'm.emote',
  Notice = 'm.notice',
  Image = 'm.image',
  Audio = 'm.audio',
  Video = 'm.video',
  Location = 'm.location',
  File = 'm.file'
}

// =============================================================================
// 稳定的 EventType 枚举
// =============================================================================
export enum StableEventType {
  RoomMessage = 'm.room.message',
  RoomCreate = 'm.room.create',
  RoomMember = 'm.room.member',
  RoomEncryption = 'm.room.encryption',
  Reaction = 'm.reaction',
  Redaction = 'm.redaction',
  Typing = 'm.typing',
  Receipt = 'm.receipt',
  Presence = 'm.presence',
  RoomRedact = 'm.room.redact'
}

// =============================================================================
// 消息内容类型 (稳定内部类型)
// =============================================================================
export interface StableMessageContent {
  msgtype?: string
  body: string
  format?: string
  formatted_body?: string
  url?: string
  file?: StableFileInfo
  info?: StableFileInfo
  'm.relates_to'?: StableRelatesTo
  // 扩展字段
  reply?: StableReplyInfo
  content?: string
  atUidList?: string[]
  translatedText?: StableTranslatedText | null
  // 位置消息
  geo_uri?: string
  'm.location'?: {
    uri?: string
    description?: string
  }
  'org.matrix.msc3488.asset'?: {
    type?: string
  }
  'org.matrix.msc3488.ts'?: number
  // 阅后即焚
  burnAfterRead?: boolean
  burnRemainingSeconds?: number
  // 冻结
  frozen?: boolean
  freeze?: boolean
  // 元数据
  [key: string]: unknown
}

export interface StableFileInfo {
  mimetype?: string
  size?: number
  w?: number
  h?: number
  duration?: number
  thumbnail_url?: string
  thumbnail_info?: StableFileInfo
}

export interface StableRelatesTo {
  rel_type: string
  event_id?: string
  'm.in_reply_to'?: {
    event_id?: string
  }
}

export interface StableReplyInfo {
  id: string
  roomId: string
  body?: string
  uid?: string
  username?: string
  imgCount?: number
}

export interface StableTranslatedText {
  text: string
  provider?: string
  from?: string
  to?: string
}

// =============================================================================
// 房间成员类型
// =============================================================================
export interface StableRoomMember {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  membership: string
  isDirect: boolean
  roomId: string
}

// =============================================================================
// 用户类型
// =============================================================================
export interface StableUser {
  userId: string
  displayName: string | null
  avatarUrl: string | null
}

// =============================================================================
// SDK 调用安全包装器
// =============================================================================
export class MatrixSDKWrapper {
  // 安全的发送消息
  static sendMessage(client: unknown, roomId: string, content: StableMessageContent): Promise<{ event_id: string }> {
    return (
      client as { sendEvent: (roomId: string, eventType: string, content: unknown) => Promise<{ event_id: string }> }
    ).sendEvent(roomId, StableEventType.RoomMessage, content as unknown)
  }

  // 安全的获取房间
  static getRoom(client: unknown, roomId: string): Room | null {
    return (client as { getRoom: (roomId: string) => Room | null }).getRoom(roomId)
  }

  // 安全的获取用户
  static getUser(client: unknown, userId: string): User | null | undefined {
    return (client as { getUser: (userId: string) => User | null | undefined }).getUser(userId)
  }

  // 安全的获取事件内容
  static getEventContent(event: MatrixEvent): StableMessageContent {
    return event.getContent() as StableMessageContent
  }

  // 安全的获取房间成员
  static getRoomMembers(room: Room): RoomMember[] {
    return room.getMembers()
  }

  // 安全的获取事件
  static getRoomEvent(client: unknown, roomId: string, eventId: string): Promise<MatrixEvent> {
    return (client as { getRoomEvent: (roomId: string, eventId: string) => Promise<MatrixEvent> }).getRoomEvent(
      roomId,
      eventId
    )
  }

  // 安全的发送状态事件
  static sendStateEvent(
    client: unknown,
    roomId: string,
    eventType: string,
    content: unknown,
    stateKey: string = ''
  ): Promise<{ event_id: string }> {
    return (
      client as {
        sendStateEvent: (
          roomId: string,
          eventType: string,
          content: unknown,
          stateKey: string
        ) => Promise<{ event_id: string }>
      }
    ).sendStateEvent(roomId, eventType, content, stateKey)
  }
}

// =============================================================================
// 类型守卫函数
// =============================================================================
export function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

export function isString(val: unknown): val is string {
  return typeof val === 'string'
}

export function isNumber(val: unknown): val is number {
  return typeof val === 'number'
}

export function isBoolean(val: unknown): val is boolean {
  return typeof val === 'boolean'
}

export function isArray(val: unknown): val is unknown[] {
  return Array.isArray(val)
}

export function isMessageContent(val: unknown): val is StableMessageContent {
  if (!isObject(val)) return false
  const obj = val as Record<string, unknown>
  return isString(obj.body) || obj.body === undefined
}

export function hasProperty<T extends object, K extends string>(obj: T, key: K): obj is T & { [P in K]: unknown } {
  return key in obj
}

export function safeGet<T = unknown>(obj: unknown, path: string, defaultValue?: T): T | undefined {
  if (!isObject(obj)) return defaultValue

  const keys = path.split('.')
  let current: unknown = obj

  for (const key of keys) {
    if (!isObject(current) || !(key in current)) {
      return defaultValue
    }
    current = (current as Record<string, unknown>)[key]
  }

  return current as T
}

export function unknownToString(value: unknown, defaultValue = ''): string {
  if (isString(value)) return value
  if (isNumber(value)) return String(value)
  return defaultValue
}

export function unknownToNumber(value: unknown, defaultValue = 0): number {
  if (isNumber(value)) return value
  if (isString(value)) {
    const parsed = parseFloat(value)
    return isNaN(parsed) ? defaultValue : parsed
  }
  return defaultValue
}

export function unknownToBoolean(value: unknown, defaultValue = false): boolean {
  if (isBoolean(value)) return value
  if (isString(value)) return value.toLowerCase() === 'true'
  return defaultValue
}

// =============================================================================
// 消息内容工具函数
// =============================================================================
export function toMessageContent(body: unknown): StableMessageContent {
  if (isObject(body)) {
    return body as StableMessageContent
  }
  return { body: String(body) }
}

export function extractTextFromContent(content: StableMessageContent): string {
  return content.content || content.body || ''
}

export function extractUrlFromContent(content: StableMessageContent): string | undefined {
  return content.url || ((content.file as Record<string, unknown>)?.url as string | undefined)
}

export function isReplyContent(content: StableMessageContent): boolean {
  return content['m.relates_to']?.rel_type === 'm.thread' || !!content['m.relates_to']?.['m.in_reply_to']
}

export function extractReplyFromContent(content: StableMessageContent): StableRelatesTo | undefined {
  return content['m.relates_to']
}

export function isBurnAfterReadContent(content: StableMessageContent): boolean {
  return content.burnAfterRead === true
}

export function isLocationContent(content: StableMessageContent): boolean {
  return content.msgtype === StableMsgType.Location || !!content.geo_uri
}

// =============================================================================
// 事件工具函数
// =============================================================================
export function extractSender(event: MatrixEvent): string {
  return event.getSender() || ''
}

export function extractRoomId(event: MatrixEvent): string {
  return event.getRoomId() || ''
}

export function extractEventId(event: MatrixEvent): string {
  return event.getId() || ''
}

export function extractTimestamp(event: MatrixEvent): number {
  return event.getTs() || 0
}

export function extractType(event: MatrixEvent): string {
  return event.getType() || ''
}

export function isMessageEvent(event: MatrixEvent): boolean {
  return event.getType() === StableEventType.RoomMessage
}
