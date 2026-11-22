import type { Room, RoomMember } from 'matrix-js-sdk'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import { matrixClientService } from '../MatrixClientService'

const logger = createLogger('MembershipService')

/** 房间成员关系变更事件（ROOM-03）。 */
export interface RoomMembershipEvent {
  eventId: string
  /** 发起变更的用户 */
  sender: string
  /** 被变更的成员 */
  userId: string
  /** join / leave / invite / ban / knock 等 */
  membership: string
  /** 事件时间戳（毫秒），缺失时为 0 */
  timestamp: number
}

export type MembershipEventsOutcome =
  /** 端点存在且返回了至少一条事件 */
  | { status: 'ok'; events: RoomMembershipEvent[] }
  /** 端点存在但房间没有成员变更记录 */
  | { status: 'empty' }
  /** 端点不存在（该 homeserver 不支持） */
  | { status: 'unsupported' }
  /** 端点存在但本次读取失败（无权限、网络错误等） */
  | { status: 'error' }

const DEFAULT_MEMBERSHIP_EVENTS_LIMIT = 100
const MAX_MEMBERSHIP_EVENTS_LIMIT = 1000

/** 房间最近成员变更条目（ROOM-03 `GET …/members/recent`）。 */
export interface RoomRecentMemberChange {
  userId: string
  displayName: string
  avatarUrl: string
  /** join / leave / invite / ban / knock 等 */
  membership: string
  eventId: string
  /** 发起变更的用户 */
  sender: string
  /** 变更时间戳（毫秒），缺失时为 0 */
  timestamp: number
}

export type RecentMemberChangesOutcome =
  /** 端点存在且返回了至少一条变更 */
  | { status: 'ok'; changes: RoomRecentMemberChange[] }
  /** 端点存在但最近没有成员变更记录 */
  | { status: 'empty' }
  /** 端点不存在（该 homeserver 不支持） */
  | { status: 'unsupported' }
  /** 端点存在但本次读取失败（无权限、网络错误等） */
  | { status: 'error' }

const DEFAULT_RECENT_MEMBER_CHANGES_LIMIT = 8
const MAX_RECENT_MEMBER_CHANGES_LIMIT = 50

/** 从 SDK 抛出的错误中提取 Matrix errcode（部分错误把 errcode 塞在 message 的 JSON 里）。 */
function readErrcode(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null
  const record = err as { errcode?: unknown; code?: unknown; message?: unknown }
  if (typeof record.errcode === 'string') return record.errcode
  if (typeof record.code === 'string') return record.code
  if (typeof record.message === 'string') {
    const jsonMatch = record.message.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { errcode?: unknown }
        if (typeof parsed.errcode === 'string') return parsed.errcode
      } catch {
        return null
      }
    }
  }
  return null
}

function normalizeMembershipEvent(raw: unknown): RoomMembershipEvent | null {
  const record = unknownToObject(raw)
  if (!record) return null
  const content = unknownToObject(record.content)
  const eventId = typeof record.event_id === 'string' ? record.event_id : ''
  const sender = typeof record.sender === 'string' ? record.sender : ''
  const userId = typeof record.state_key === 'string' ? record.state_key : ''
  const membership = content && typeof content.membership === 'string' ? content.membership : ''
  if (!eventId || !userId || !membership) return null
  const timestamp =
    typeof record.origin_server_ts === 'number' && Number.isFinite(record.origin_server_ts)
      ? record.origin_server_ts
      : 0
  return { eventId, sender, userId, membership, timestamp }
}

function normalizeRecentMemberChange(raw: unknown): RoomRecentMemberChange | null {
  const record = unknownToObject(raw)
  if (!record) return null
  const userId = typeof record.user_id === 'string' ? record.user_id : ''
  const membership = typeof record.membership === 'string' ? record.membership : ''
  if (!userId || !membership) return null
  return {
    userId,
    displayName: typeof record.display_name === 'string' ? record.display_name : '',
    avatarUrl: typeof record.avatar_url === 'string' ? record.avatar_url : '',
    membership,
    eventId: typeof record.event_id === 'string' ? record.event_id : '',
    sender: typeof record.sender === 'string' ? record.sender : '',
    timestamp:
      typeof record.origin_server_ts === 'number' && Number.isFinite(record.origin_server_ts)
        ? record.origin_server_ts
        : 0
  }
}

/**
 * Room membership domain service.
 *
 * Covers the join/leave/invite/kick/ban/unban/forget/knock lifecycle.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomMembershipService {
  private getClient(prefix = true) {
    const client = matrixClientService.getClient()
    if (!client) throw new Error(prefix ? '[MatrixRoom] 客户端未初始化' : '客户端未初始化')
    return client
  }

  async joinRoom(roomId: string): Promise<Room> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('membership', roomId, { roomId, type: 'join' })
      logger.info(`[MatrixRoom] 离线状态，已将加入房间入队: ${roomId}`)
      // 返回一个模拟的 Room 对象或抛出特定错误供上层处理
      return { roomId } as Room
    }

    try {
      return await matrixClientService.joinRoom(roomId)
    } catch (err) {
      logger.error(`[MatrixRoom] 加入房间失败: ${err}`)
      throw err
    }
  }

  async leaveRoom(roomId: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('membership', roomId, { roomId, type: 'leave' })
      logger.info(`[MatrixRoom] 离线状态，已将离开房间入队: ${roomId}`)
      return
    }

    try {
      await matrixClientService.leaveRoom(roomId)
    } catch (err) {
      logger.error(`[MatrixRoom] 离开房间失败: ${err}`)
      throw err
    }
  }

  async inviteUser(roomId: string, userId: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('membership', roomId, { roomId, userId, type: 'invite' })
      logger.info(`[MatrixRoom] 离线状态，已将邀请用户入队: ${userId} -> ${roomId}`)
      return
    }

    const client = this.getClient(false)
    try {
      await client.invite(roomId, userId)
      logger.info(`[MatrixRoom] 邀请用户成功: ${userId} -> ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 邀请用户失败: ${err}`)
      throw err
    }
  }

  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('membership', roomId, { roomId, userId, reason, type: 'kick' })
      logger.info(`[MatrixRoom] 离线状态，已将踢出用户入队: ${userId} <- ${roomId}`)
      return
    }

    const client = this.getClient(false)
    try {
      await client.kick(roomId, userId, reason)
      logger.info(`[MatrixRoom] 踢出用户成功: ${userId} <- ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 踢出用户失败: ${err}`)
      throw err
    }
  }

  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('membership', roomId, { roomId, userId, reason, type: 'ban' })
      logger.info(`[MatrixRoom] 离线状态，已将封禁用户入队: ${userId} <- ${roomId}`)
      return
    }

    const client = this.getClient(false)
    try {
      await client.ban(roomId, userId, reason)
      logger.info(`[MatrixRoom] 封禁用户成功: ${userId} <- ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 封禁用户失败: ${err}`)
      throw err
    }
  }

  async unbanUser(roomId: string, userId: string): Promise<void> {
    if (!navigator.onLine) {
      offlineQueueService.enqueue('membership', roomId, { roomId, userId, type: 'unban' })
      logger.info(`[MatrixRoom] 离线状态，已将解封用户入队: ${userId} <- ${roomId}`)
      return
    }

    const client = this.getClient(false)
    try {
      await client.unban(roomId, userId)
      logger.info(`[MatrixRoom] 解封用户成功: ${userId} <- ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 解封用户失败: ${err}`)
      throw err
    }
  }

  async forgetRoom(roomId: string): Promise<void> {
    const client = this.getClient()
    try {
      await client.forget(roomId)
      logger.info(`[MatrixRoom] 忘记房间成功: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 忘记房间失败: ${err}`)
      throw err
    }
  }

  async knockRoom(roomId: string, reason?: string, viaServers?: string[]): Promise<{ room_id: string }> {
    const client = this.getClient()
    try {
      const result = await client.knockRoom(roomId, {
        ...(reason !== undefined ? { reason } : {}),
        ...(viaServers !== undefined ? { viaServers } : {})
      })
      logger.info(`[MatrixRoom] 敲门房间成功: ${roomId}`)
      return result
    } catch (err) {
      logger.error(`[MatrixRoom] 敲门房间失败: ${err}`)
      throw err
    }
  }

  async joinRoomByAlias(roomIdOrAlias: string, serverName?: string[]): Promise<{ room_id: string }> {
    const client = this.getClient()
    try {
      const room = await client.joinRoom(
        roomIdOrAlias,
        serverName && serverName.length > 0 ? { viaServers: serverName } : undefined
      )
      logger.info(`[MatrixRoom] 通过别名加入房间成功: ${roomIdOrAlias}`)
      return { room_id: room.roomId }
    } catch (err) {
      logger.error(`[MatrixRoom] 通过别名加入房间失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取房间中已邀请（invite）的成员列表
   *
   * @param roomId - 房间 ID
   * @returns 已邀请成员列表，房间不存在时返回空数组
   */
  async getInvitedMembers(roomId: string): Promise<RoomMember[]> {
    const client = this.getClient(false)
    const room = client.getRoom(roomId)
    if (!room) {
      logger.warn(`[MatrixRoom] 获取邀请成员列表时房间不存在: ${roomId}`)
      return []
    }
    return room.getMembersWithMembership('invite')
  }

  /**
   * 获取房间中被封禁（ban）的成员列表
   *
   * @param roomId - 房间 ID
   * @returns 被封禁成员列表，房间不存在时返回空数组
   */
  async getBannedMembers(roomId: string): Promise<RoomMember[]> {
    const client = this.getClient(false)
    const room = client.getRoom(roomId)
    if (!room) {
      logger.warn(`[MatrixRoom] 获取封禁成员列表时房间不存在: ${roomId}`)
      return []
    }
    return room.getMembersWithMembership('ban')
  }

  /**
   * 获取房间成员关系变更历史（ROOM-03，只读）。
   *
   * 走 SDK `RoomMemberManager.getMembershipEvents`（POST 端点），`limit` 收敛到
   * 1..1000；端点缺失（`M_UNRECOGNIZED`）归 `unsupported`，其余失败归 `error`，
   * 与「没有变更记录」的空态严格区分。
   */
  async getMembershipEvents(
    roomId: string,
    limit: number = DEFAULT_MEMBERSHIP_EVENTS_LIMIT
  ): Promise<MembershipEventsOutcome> {
    const safeLimit = Math.min(
      MAX_MEMBERSHIP_EVENTS_LIMIT,
      Math.max(1, Math.trunc(Number.isFinite(limit) ? limit : DEFAULT_MEMBERSHIP_EVENTS_LIMIT))
    )
    try {
      const client = this.getClient()
      const result = await client.getRoomMemberManager().getMembershipEvents(roomId, { limit: safeLimit })
      const record = unknownToObject(result)
      const list = record && Array.isArray(record.events) ? record.events : []
      const events = list.map(normalizeMembershipEvent).filter((item): item is RoomMembershipEvent => item !== null)
      return events.length > 0 ? { status: 'ok', events } : { status: 'empty' }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持成员变更历史查询: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取成员变更历史失败: ${err}`)
      return { status: 'error' }
    }
  }

  /**
   * 获取房间最近的成员关系变更（ROOM-03，只读）。
   *
   * 走 SDK `RoomMemberManager.getRoomMembersRecent`（GET 端点），返回的 `chunk` 已带
   * `display_name` / `avatar_url`，适合列表直出；`limit` 收敛到 1..50（提示区用途）。
   * 端点缺失（`M_UNRECOGNIZED`）归 `unsupported`，其余失败归 `error`，与「最近无变更」严格区分。
   */
  async getRecentMemberChanges(
    roomId: string,
    limit: number = DEFAULT_RECENT_MEMBER_CHANGES_LIMIT
  ): Promise<RecentMemberChangesOutcome> {
    const safeLimit = Math.min(
      MAX_RECENT_MEMBER_CHANGES_LIMIT,
      Math.max(1, Math.trunc(Number.isFinite(limit) ? limit : DEFAULT_RECENT_MEMBER_CHANGES_LIMIT))
    )
    try {
      const client = this.getClient()
      const result = await client.getRoomSummaryManager().members.getRoomMembersRecent(roomId, { limit: safeLimit })
      const record = unknownToObject(result)
      const list = record && Array.isArray(record.chunk) ? record.chunk : []
      const changes = list
        .map(normalizeRecentMemberChange)
        .filter((item): item is RoomRecentMemberChange => item !== null)
      return changes.length > 0 ? { status: 'ok', changes } : { status: 'empty' }
    } catch (err) {
      if (readErrcode(err) === 'M_UNRECOGNIZED') {
        logger.warn(`[MatrixRoom] 服务器不支持最近成员变更查询: ${err}`)
        return { status: 'unsupported' }
      }
      logger.warn(`[MatrixRoom] 获取最近成员变更失败: ${err}`)
      return { status: 'error' }
    }
  }
}

export const matrixRoomMembershipService = new MatrixRoomMembershipService()
