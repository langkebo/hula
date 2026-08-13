import type { Friend, FriendManager, FriendRequest } from '@/services/matrix/sdk'

import type { SynapseFriendInfo, SynapseFriendRequest } from '../extensions/SynapseFriendExtensionService'

// 好友请求状态（发送/接受/拒绝流程中的状态）
export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected'

// 好友关系状态（已建立好友关系后的分类标记）
export type FriendRelationStatus = 'favorite' | 'normal' | 'blocked' | 'hidden'

/**
 * @deprecated 请使用 `FriendRequestStatus` 或 `FriendRelationStatus` 替代。
 * 该类型混合了请求状态和关系状态，语义不清晰，将在未来版本中移除。
 */
export type FriendStatus = FriendRequestStatus | FriendRelationStatus

export interface FriendGroup {
  group_id: string
  name: string
  member_count?: number
  created_at?: number
}

export interface FriendSyncState {
  friends: Friend[]
  incomingRequests: FriendRequest[]
  outgoingRequests: FriendRequest[]
}

export type FriendServiceEventHandler = (data?: unknown) => void

/**
 * FriendManager 兼容类型：在 SDK FriendManager 基础上补充可选的扩展方法，
 * 便于在运行时探测后端是否支持 note/status 等扩展能力。
 */
export type FriendManagerCompat = FriendManager & {
  updateFriendNote?: (userId: string, note: string) => Promise<void>
  setFriendNote?: (userId: string, note: string) => Promise<void>
  setFriendStatus?: (userId: string, status: FriendStatus) => Promise<void>
}

/** 获取好友的用户 ID
 */
export function getFriendUserId(friend: Friend): string {
  return friend.user_id ?? ''
}

/** 获取好友请求的用户 ID
 */
export function getRequestUserId(request: FriendRequest): string {
  return request.user_id ?? ''
}

/** 规范化 Synapse 好友请求数据
 */
export function normalizeSynapseFriendRequest(
  req: SynapseFriendRequest,
  direction: 'incoming' | 'outgoing' = 'incoming'
): FriendRequest {
  // incoming: 对方发起，user_id 取 requester
  // outgoing: 本方发起，user_id 取 recipient
  return {
    user_id: direction === 'incoming' ? req.requester : req.recipient,
    message: req.message,
    status: req.status === 'declined' ? 'rejected' : req.status,
    timestamp: req.created_ts,
    direction
  }
}

/** 规范化好友数据
 */
export function normalizeFriend(friend: Friend | SynapseFriendInfo): Friend {
  const source = friend as Friend & {
    displayname?: string
    username?: string
    online?: boolean
    presence?: string
    last_active_ts?: number
  }

  return {
    ...source,
    user_id: source.user_id,
    display_name: source.display_name ?? source.displayname ?? source.username,
    avatar_url: source.avatar_url,
    since: source.since ?? source.last_active_ts,
    note: source.note,
    status: source.status,
    dm_room_id: source.dm_room_id,
    // 保留后端真实字段，供上层做 presence 初始值兜底
    ...(source.online !== undefined ? { online: source.online } : {}),
    ...(source.presence ? { presence: source.presence } : {}),
    ...(source.username ? { username: source.username } : {})
  } as Friend
}

/** 转换为用户 ID
 */
export function toUserId(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** 转换为目标好友请求格式
 */
export function toFriendRequest(value: unknown): FriendRequest | null {
  return value && typeof value === 'object' ? (value as FriendRequest) : null
}
