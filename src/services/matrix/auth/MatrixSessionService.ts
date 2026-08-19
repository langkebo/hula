import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk'
import { NotificationTypeEnum, RoomTypeEnum } from '@/enums'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixDirectMessageService } from '../room/MatrixDirectMessageService'

const logger = createLogger('MatrixSessionService')

interface RoomNotificationSettings {
  shield?: boolean
  muteNotification?: NotificationTypeEnum
}

interface SessionTagContent {
  tags?: Record<string, unknown>
}

interface SessionInfo {
  id?: string
  roomId: string
  name: string
  avatar: string
  type: RoomTypeEnum
  unreadCount: number
  activeTime: number
  top: boolean
  shield: boolean
  muteNotification: NotificationTypeEnum
  detailId?: string
  remark?: string
  account?: string
  text?: string
  isFavorite?: boolean
}

interface SessionDetail extends SessionInfo {}

interface SessionDetailQuery {
  id: string
  roomType?: number
}

type MatrixClientWithTags = MatrixClient & {
  setRoomTag?: (roomId: string, tagName: string, metadata?: Record<string, unknown>) => Promise<unknown>
  deleteRoomTag?: (roomId: string, tagName: string) => Promise<unknown>
  removeRoomTag?: (roomId: string, tagName: string) => Promise<unknown>
}

const DIRECT_ROOM_READY_TIMEOUT_MS = 3000
const DIRECT_ROOM_READY_POLL_INTERVAL_MS = 100

class MatrixSessionService extends BaseMatrixService {
  /**
   * Get all sessions for the current user.
   *
   * @throws Never throws (returns empty array on error).
   */
  async getSessionList(): Promise<SessionInfo[]> {
    try {
      const client = this.getClient()
      const dmRooms = await matrixDirectMessageService.getDMRooms(false)
      const dmRoomMap = new Map(dmRooms.map((roomInfo) => [roomInfo.roomId, roomInfo]))

      const sessions = client.getRooms().map((room) => {
        const dmRoomInfo = dmRoomMap.get(room.roomId) ?? null
        return this.buildSessionFromRoom(room, dmRoomInfo)
      })

      // 防御性去重：按 counterpart 用户去重，保留最新活跃的
      const seen = new Map<string, SessionInfo>()
      for (const session of sessions) {
        if (session.type !== RoomTypeEnum.SINGLE) {
          seen.set(session.roomId, session)
          continue
        }
        const counterpartId = session.detailId || session.roomId
        const existing = seen.get(counterpartId)
        if (!existing || session.activeTime > existing.activeTime) {
          seen.set(counterpartId, session)
        }
      }
      return Array.from(seen.values())
    } catch (err) {
      logger.error(`[MatrixSession] 获取会话列表失败: ${err}`)
      return []
    }
  }

  /**
   * Toggle the pinned/favourite state of a session.
   *
   * @throws Never throws (returns false on error).
   */
  async setSessionTop(roomId: string, top: boolean): Promise<boolean> {
    try {
      const client = this.getClient() as MatrixClientWithTags
      const tagName = 'm.favourite'

      if (top) {
        if (typeof client.setRoomTag === 'function') {
          await client.setRoomTag(roomId, tagName, { order: '0.5' })
          logger.info(`[MatrixSession] 设置会话置顶成功: ${roomId}`)
          return true
        }
      } else {
        if (typeof client.deleteRoomTag === 'function') {
          await client.deleteRoomTag(roomId, tagName)
          logger.info(`[MatrixSession] 取消会话置顶成功: ${roomId}`)
          return true
        }
        if (typeof client.removeRoomTag === 'function') {
          await client.removeRoomTag(roomId, tagName)
          logger.info(`[MatrixSession] 取消会话置顶成功: ${roomId}`)
          return true
        }
      }

      logger.warn(`[MatrixSession] 当前 SDK 未暴露房间标签接口，跳过置顶同步: ${roomId}`)
      return false
    } catch (err) {
      logger.error(`[MatrixSession] 设置会话置顶失败: ${err}`)
      return false
    }
  }

  /**
   * Get detailed session information by room ID or query object.
   *
   * @throws Never throws (returns null on error).
   */
  async getSessionDetailWithFriends(query: string | SessionDetailQuery): Promise<SessionDetail | null> {
    try {
      const normalized = this.normalizeQuery(query)
      if (normalized.roomType === RoomTypeEnum.GROUP) {
        return this.getGroupSessionDetail(normalized.id)
      }
      return this.getDirectSessionDetail(normalized.id)
    } catch (err) {
      logger.error(`[MatrixSession] 获取会话详情失败: ${err}`)
      return null
    }
  }

  private normalizeQuery(query: string | SessionDetailQuery): Required<SessionDetailQuery> {
    if (typeof query === 'string') {
      return {
        id: query,
        roomType: RoomTypeEnum.SINGLE
      }
    }
    return {
      id: query.id,
      roomType: query.roomType ?? RoomTypeEnum.SINGLE
    }
  }

  private async getGroupSessionDetail(roomId: string): Promise<SessionDetail | null> {
    const room = this.getClient().getRoom(roomId)
    if (!room) {
      return null
    }
    return this.buildSessionFromRoom(room, null)
  }

  private async getDirectSessionDetail(userId: string): Promise<SessionDetail | null> {
    const client = this.getClient()

    // 1) 优先从本地已同步的房间中按"对方成员"直接定位 DM 房间。
    //    这样即使 DirectMessageManager 扩展尚未加载、或 m.direct 映射未同步，
    //    也能正确跳转到已存在的私聊，避免"进入聊天/加密聊天"按钮点击无反应。
    const localRoom = this.findLocalDirectRoom(userId)
    if (localRoom) {
      const dmRoomInfo = await matrixDirectMessageService.getDmRoomInfo(localRoom.roomId, false)
      return this.buildSessionFromRoom(localRoom, dmRoomInfo)
    }

    // 2) 走 DM 管理器查找/创建（需要 manager 就绪）
    try {
      const existingRoomId = await matrixDirectMessageService.getDmForUser(userId, false)
      const roomId = existingRoomId ?? (await matrixDirectMessageService.createDm(userId))
      const room = (await this.waitForRoomAvailable(roomId)) ?? client.getRoom(roomId)

      if (room) {
        const dmRoomInfo = await matrixDirectMessageService.getDmRoomInfo(roomId, false)
        return this.buildSessionFromRoom(room, dmRoomInfo)
      }

      return {
        roomId,
        name: userId,
        avatar: '',
        type: RoomTypeEnum.SINGLE,
        unreadCount: 0,
        activeTime: 0,
        top: false,
        shield: false,
        muteNotification: NotificationTypeEnum.RECEPTION,
        detailId: userId,
        account: userId,
        id: userId
      }
    } catch (err) {
      // 3) 兜底：manager 未就绪导致创建失败时，再次尝试本地定位，
      //    尽可能让按钮仍能在已有会话上跳转，而不是静默失败。
      logger.warn(`[MatrixSession] DM 管理器不可用，尝试本地兜底定位: ${err}`)
      const fallback = this.findLocalDirectRoom(userId)
      if (fallback) {
        const dmRoomInfo = await matrixDirectMessageService.getDmRoomInfo(fallback.roomId, false)
        return this.buildSessionFromRoom(fallback, dmRoomInfo)
      }
      logger.error(`[MatrixSession] 获取会话详情失败: ${err}`)
      return null
    }
  }

  /**
   * 从本地已同步的房间列表中查找与目标用户的一对一私聊房间。
   * 用于不依赖 DirectMessageManager / m.direct 映射即可跳转到已有会话。
   */
  private findLocalDirectRoom(userId: string): Room | null {
    const client = this.getClient()
    const selfId = client.getUserId() ?? undefined
    if (!selfId) {
      return null
    }
    for (const room of client.getRooms() ?? []) {
      try {
        if (room.isSpaceRoom?.()) {
          continue
        }
        const memberCount = typeof room.getJoinedMemberCount === 'function' ? room.getJoinedMemberCount() : 0
        if (memberCount !== 2) {
          continue
        }
        const members = room.getJoinedMembers?.() ?? []
        const other = members.find((m) => m.userId !== selfId)
        if (other && other.userId === userId) {
          return room
        }
      } catch {
        // 单个房间解析失败不影响其它房间
      }
    }
    return null
  }

  private async waitForRoomAvailable(roomId: string): Promise<Room | null> {
    const client = this.getClient()
    let room = client.getRoom(roomId)
    if (room) {
      return room
    }

    const deadline = Date.now() + DIRECT_ROOM_READY_TIMEOUT_MS
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, DIRECT_ROOM_READY_POLL_INTERVAL_MS))
      room = client.getRoom(roomId)
      if (room) {
        return room
      }
    }

    logger.info(`[MatrixSession] 目标会话在等待窗口内仍未同步到本地房间列表，先返回占位会话: ${roomId}`)
    return null
  }

  private buildSessionFromRoom(
    room: Room,
    dmRoomInfo: { invitees?: string[]; inviter?: string; roomId?: string } | null
  ): SessionDetail {
    // 优先用 m.direct 映射的对方身份；若房间未注册进 m.direct（历史/重复创建的 DM 房间常见），
    // 则从房间成员中解析"除自己外的另一名成员"作为 counterpart，确保 detailId 始终填充，
    // 否则下游按 detailId 的去重会退回 roomId，导致同一联系人的多个 DM 房间在消息列表重复出现。
    const selfId = this.getClient().getUserId() || undefined
    const otherMember = (() => {
      try {
        const members = room.getJoinedMembers?.() ?? []
        return members.find((m) => m.userId !== selfId)?.userId
      } catch {
        return undefined
      }
    })()
    const detailId = dmRoomInfo?.invitees?.[0] || dmRoomInfo?.inviter || otherMember
    const isSingle =
      !!detailId || (typeof room.getJoinedMemberCount === 'function' ? room.getJoinedMemberCount() === 2 : false)
    const notificationSettings = this.getRoomNotificationSettings(room)

    return {
      id: detailId ?? room.roomId,
      roomId: room.roomId,
      name: this.resolveRoomName(room, detailId),
      avatar: room.getMxcAvatarUrl() || '',
      type: isSingle ? RoomTypeEnum.SINGLE : RoomTypeEnum.GROUP,
      unreadCount: this.getUnreadCount(room),
      activeTime: this.getLastActiveTime(room),
      top: this.isTopSession(room),
      shield: notificationSettings.shield ?? false,
      muteNotification: notificationSettings.muteNotification ?? NotificationTypeEnum.RECEPTION,
      detailId,
      account: detailId,
      text: this.getLastMessagePreview(room)
    }
  }

  private resolveRoomName(room: Room, fallbackName?: string): string {
    const roomName = room.name?.trim()
    if (roomName) {
      return roomName
    }
    return fallbackName || room.roomId
  }

  private getUnreadCount(room: Room): number {
    if (typeof room.getUnreadNotificationCount !== 'function') {
      return 0
    }
    return room.getUnreadNotificationCount() ?? 0
  }

  private getLastActiveTime(room: Room): number {
    const events = typeof room.getLiveTimeline === 'function' ? room.getLiveTimeline().getEvents() : []
    const lastEvent = events[events.length - 1]
    return this.getEventTimestamp(lastEvent)
  }

  private getLastMessagePreview(room: Room): string {
    const events = typeof room.getLiveTimeline === 'function' ? room.getLiveTimeline().getEvents() : []
    const lastEvent = events[events.length - 1]
    if (!lastEvent || typeof lastEvent.getContent !== 'function') {
      return ''
    }
    const content = lastEvent.getContent()
    if (!content || typeof content !== 'object') {
      return ''
    }
    const body = Reflect.get(content, 'body')
    return typeof body === 'string' ? body : ''
  }

  private getEventTimestamp(event: MatrixEvent | undefined): number {
    if (!event || typeof event.getTs !== 'function') {
      return 0
    }
    return event.getTs() ?? 0
  }

  private isTopSession(room: Room): boolean {
    const accountData = room.getAccountData?.('m.tag')
    const content = accountData?.getContent() as SessionTagContent | undefined
    return !!content?.tags && Object.hasOwn(content.tags, 'm.favourite')
  }

  private getRoomNotificationSettings(room: Room): RoomNotificationSettings {
    const accountData = room.getAccountData?.('tjg.room.notification_settings')
    const content = accountData?.getContent()
    if (!content || typeof content !== 'object') {
      return {}
    }
    return content as RoomNotificationSettings
  }
}

export const matrixSessionService = new MatrixSessionService()
