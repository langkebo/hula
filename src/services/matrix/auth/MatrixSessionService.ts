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

export interface SessionInfo {
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

export interface SessionDetail extends SessionInfo {}

export interface SessionDetailQuery {
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

      return client.getRooms().map((room) => {
        const dmRoomInfo = dmRoomMap.get(room.roomId) ?? null
        return this.buildSessionFromRoom(room, dmRoomInfo)
      })
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
    const detailId = dmRoomInfo?.invitees?.[0] || dmRoomInfo?.inviter
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
    const accountData = room.getAccountData?.('hula.room.notification_settings')
    const content = accountData?.getContent()
    if (!content || typeof content !== 'object') {
      return {}
    }
    return content as RoomNotificationSettings
  }
}

export const matrixSessionService = new MatrixSessionService()
export default matrixSessionService
