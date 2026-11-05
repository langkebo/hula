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
  member_count?: number | undefined
  created_at?: number | undefined
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

/**
 * 归好好友展示名：后端可能只给 `displayname`（无下划线）或 `username`。
 *
 * 从 `SynapseFriendExtensionService` 抽出——纯函数，与本节其它 normalizer 同源。
 */
export function normalizeFriendInfo(friend: SynapseFriendInfo): SynapseFriendInfo {
  const displayName = friend.display_name || friend.displayname || friend.username || friend.user_id
  return {
    ...friend,
    display_name: displayName,
    displayname: displayName,
    username: friend.username || displayName
  }
}

/** 批量归一好友列表 */
export function normalizeFriendInfoList(friends: SynapseFriendInfo[]): SynapseFriendInfo[] {
  return friends.map(normalizeFriendInfo)
}

/** 规范化 Synapse 好友请求数据
 *
 * 需要同时吃两种形状：
 *
 * 1. **REST 回退（真实契约）**：`{user_id, message, timestamp, status}`
 *    —— 实测 `GET /_matrix/vendor/v1/friends/requests/{incoming,outgoing}`
 *    后端按对端视角建模，不返回 `requester`/`recipient`/`created_ts`。
 * 2. **旧形状 / FriendManager**：`{requester, recipient, created_ts, request_id}`
 *
 * 历史缺陷：只读第 2 种 ⇒ REST 回退路径下 `user_id` 与 `timestamp` 恒为 undefined，
 * 而 `MatrixFriendSync.pollFriendRequests` 又用 `user_id` 做「新增请求」差集，
 * 导致好友申请列表与新请求提示同时失效。
 */
export function normalizeSynapseFriendRequest(
  req: SynapseFriendRequest,
  direction: 'incoming' | 'outgoing' = 'incoming'
): FriendRequest {
  // incoming: 对方发起，对端 = requester；outgoing: 本方发起，对端 = recipient。
  // 新形状没有这两个字段，直接取后端给的对端 `user_id`。
  const counterpart =
    (direction === 'incoming' ? req.requester : req.recipient) || req.user_id || req.requester || req.recipient || ''

  return {
    user_id: counterpart,
    ...(req.message !== undefined ? { message: req.message } : {}),
    status: req.status === 'declined' ? 'rejected' : req.status,
    // 后端 REST 给 `timestamp`（毫秒），旧形状给 `created_ts`；两者都缺时用 0
    // （不伪造当前时间：那会让「三天前的请求」显示成「刚刚」）。
    timestamp: req.created_ts ?? req.timestamp ?? 0,
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

/**
 * 生成好友请求的幂等键（审计 §7 批次 B-4 / §8 B-4）。
 *
 * 同一 (操作, 目标用户) 恒定返回同一键，使「SDK 通道失败 → REST 降级重发」的两次请求
 * 在服务端可被识别为同一逻辑操作并去重，避免重复提交。
 *
 * @param userId 目标好友用户 ID
 * @returns 确定性幂等键
 */
export function buildFriendRequestIdempotencyKey(userId: string): string {
  return `friend-request:${userId}`
}
