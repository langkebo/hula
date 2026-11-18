/**
 * matrix-js-sdk 类型扩展 —— 成员/同步/关系/目录等纯类型
 *
 * 从 `matrix-js-sdk-augmentations.d.ts` 拆出。只搬运声明，不新增语义。
 */
/// <reference types="vite/client" />

declare module 'matrix-js-sdk' {
  interface RoomMember {
    userId: string
    roomId: string
    name: string
    rawDisplayName: string
    membership: string
    powerLevel: number
    getAvatarUrl(): string | null
    getMxcAvatarUrl(): string | null | undefined
  }

  // User 类型
  interface User {
    userId: string
    displayName: string | null
    avatarUrl: string | null
    setDisplayName(name: string): Promise<void>
  }

  // synapse-rust 特有：阅后即焚功能管理器
  // 官方 matrix-js-sdk 不包含此功能

  // synapse-rust 特有：在线状态管理器扩展
  // 官方 matrix-js-sdk 不包含此管理器接口

  // RoomState 类型

  // ==================== 搜索类型 ====================
  export interface SearchParams {
    next_batch?: string
    limit?: number
    before_limit?: number
    after_limit?: number
    include_profile?: boolean
  }

  // ==================== 同步类型 ====================
  export interface SyncParams {
    filter?: string | Filter
    since?: string
    full_state?: boolean
    set_presence?: 'online' | 'offline' | 'unavailable'
    timeout?: number
  }

  export interface SyncResponse {
    next_batch: string
    rooms?: {
      join?: Record<string, RoomData>
      invite?: Record<string, InvitedRoom>
      leave?: Record<string, LeftRoom>
    }
    presence?: PresenceUpdate[]
    account_data?: Record<string, unknown>
    to_device?: DeviceMessages[]
    device_lists?: DeviceLists
    device_one_time_keys_count?: Record<string, number>
    org_matrix_msc2656_unread_sticky_messages?: Record<string, number>
  }

  export interface RoomData {
    timeline?: TimelineData
    state?: StateData
    ephemeral?: EphemeralData
    account_data?: Record<string, unknown>
    unread_notifications?: UnreadNotifications
    summary?: RoomSummary
  }

  export interface TimelineData {
    events: MatrixEvent[]
    prev_batch?: string
    limited?: boolean
  }

  export interface StateData {
    events: MatrixEvent[]
  }

  export interface EphemeralData {
    events: MatrixEvent[]
  }

  export interface InvitedRoom {
    invite_state: {
      events: MatrixEvent[]
    }
  }

  export interface LeftRoom {
    timeline?: TimelineData
    state?: StateData
  }

  export interface PresenceUpdate {
    user_id: string
    presence: string
    last_active_ago?: number
    status_msg?: string
    currently_active?: boolean
  }

  export interface DeviceMessages {
    sender: string
    type: string
    content: unknown
  }

  export interface DeviceLists {
    changed?: string[]
    left?: string[]
  }

  export interface UnreadNotifications {
    highlight_count?: number
    total_count?: number
    unread_thread_notifications?: Record<string, UnreadNotifications>
  }

  // ==================== 分页类型 ====================

  export interface PaginatedMessages {
    chunk: MatrixEvent[]
    start: string
    end: string
    state?: MatrixEvent[]
  }

  // ==================== 过滤器类型 ====================

  // ==================== 事件关系类型 ====================
  export interface EventRelation {
    rel_type: 'm.annotation' | 'm.reference' | 'm.replace' | string
    event_id: string
    is_falling_back?: boolean
    'm.relates_to'?: {
      rel_type: string
      event_id: string
      [key: string]: unknown
    }
  }

  // ==================== 消息编辑类型 ====================
  export interface MessageEditContent {
    'm.new_content'?: {
      body: string
      msgtype: string
      [key: string]: unknown
    }
    'm.new_message'?: {
      body: string
      msgtype: string
      [key: string]: unknown
    }
    'm.relates_to'?: {
      rel_type: 'm.replace'
      event_id: string
    }
    body: string
    msgtype?: string
    [key: string]: unknown
  }

  // ==================== 回复类型 ====================
  export interface ReplyContent {
    'm.in_reply_to'?: {
      event_id: string
    }
    'm.relates_to'?: {
      rel_type: 'm.thread'
      event_id: string
      is_falling_back?: boolean
      'm.in_reply_to'?: {
        event_id: string
      }
    }
    body: string
    msgtype?: string
    [key: string]: unknown
  }

  // ==================== 线程类型 ====================
  export interface ThreadBundle {
    thread_id: string
    latest_event: MatrixEvent
    events: MatrixEvent[]
    unread_notification_count?: number
    num_latest?: number
    num_unread?: number
  }

  // ==================== 密钥备份类型 ====================

  // ==================== 设备管理类型 ====================

  // SDK-9: 设备更新请求（display_name ≤100 字符）

  export interface DeviceUpdate {
    device_id: string
    user_id: string
    content: unknown
  }

  export interface DeviceDeletion {
    device_id: string
    user_id: string
  }

  // ==================== 用户目录类型 ====================
  export interface UserDirectorySearchParams {
    term: string
    limit?: number
  }

  export interface UserDirectorySearchResponse {
    results: UserDirectoryResult[]
    limited?: boolean
  }

  export interface UserDirectoryResult {
    user_id: string
    display_name?: string
    avatar_url?: string
    avatar_mxc?: string
  }

  // ==================== 群组/社区类型 ====================
  export interface Group {
    groupId: string
    name: string
    avatarUrl: string
    shortDescription?: string
    longDescription?: string
    user?: GroupUser
    profile?: GroupProfile
  }

  export interface GroupUser {
    is_public: boolean
  }

  export interface GroupProfile {
    name?: string
    avatar_url?: string
    short_description?: string
    long_description?: string
  }

  // ==================== 第三方 API 类型 ====================
  export interface ThirdPartyProtocol {
    protocols: Record<string, ThirdPartyProtocolInstance[]>
  }

  export interface ThirdPartyProtocolInstance {
    instance_id: string
    desc: string
    icon?: string
    fields: Record<string, string>
  }

  export interface ThirdPartyUser {
    user_id: string
    medium: string
    url?: string
    threepid: string
  }

  export interface ThirdPartyLocation {
    alias: string
    description?: string
    icon?: string
    fields: Record<string, string>
  }
}

export {}
