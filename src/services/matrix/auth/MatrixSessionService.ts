import { NotificationTypeEnum, RoomTypeEnum } from '@/enums'
import type { DmRoomInfo, MatrixClient, Room } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { resolveDmIdentityKey } from '@/utils/userIdentity'
import { BaseMatrixService } from '../BaseMatrixService'
import { matrixDirectMessageService } from '../room/MatrixDirectMessageService'
import type { SessionDetail, SessionDetailQuery, SessionInfo } from './sessionRoomMapper'
import { buildSessionFromRoom, getUnreadCount, isSystemContainerRoom } from './sessionRoomMapper'

export type {
  RoomNotificationSettings,
  SessionDetail,
  SessionDetailQuery,
  SessionInfo,
  SessionTagContent
} from './sessionRoomMapper'

const logger = createLogger('MatrixSessionService')

type MatrixClientWithTags = MatrixClient & {
  setRoomTag?: (roomId: string, tagName: string, metadata?: Record<string, unknown>) => Promise<unknown>
  deleteRoomTag?: (roomId: string, tagName: string) => Promise<unknown>
  removeRoomTag?: (roomId: string, tagName: string) => Promise<unknown>
}

const DIRECT_ROOM_READY_TIMEOUT_MS = 3_000
const DIRECT_ROOM_READY_POLL_INTERVAL_MS = 100

class MatrixSessionService extends BaseMatrixService {
  /** 会话列表：未登录 → []；执行期异常 → 抛出（旧实现 catch 成 []，把故障伪装成 0 条会话）。 */
  async getSessionList(): Promise<SessionInfo[]> {
    let client: MatrixClient
    try {
      client = this.getClient()
    } catch {
      return []
    }
    try {
      const dmRooms = await matrixDirectMessageService.getDMRooms(false)
      const dmRoomMap = new Map(dmRooms.map((roomInfo) => [roomInfo.roomId, roomInfo]))

      // 死房间过滤：仅剩自己（对方从未加入/已离开）且无未读、非待处理邀请的房间
      // 不进会话列表。这类房间（测试期反复创建的空房间 / 对方已退出的历史 DM）
      // 会以 "Empty room" 或对方用户名的形式在消息列表大量重复刷屏；
      // 且成员仅剩一人导致 DM 判型失败（被判 GROUP），绕过所有同人去重。
      const isDeadRoom = (room: Room): boolean => {
        if (room.getMyMembership?.() === 'invite') return false
        // 有 m.room.name 事件 = 用户主动命名（空间子房间），不是死房间；要过滤的是
        // 无 name 事件的测试空房间（SDK 默认 "Empty room"）与对方已退出的历史 DM
        // （其 room.name 是 fallback 用户名）。误过滤会让子房间从列表消失。
        const nameEvents = room.currentState?.getStateEvents?.('m.room.name')
        if (nameEvents && nameEvents.length > 0) return false
        const joinedCount = typeof room.getJoinedMemberCount === 'function' ? room.getJoinedMemberCount() : 0
        if (joinedCount > 1) return false
        return getUnreadCount(room) === 0
      }

      // 已退出/被封禁的房间不是会话：保留只会让用户点进一个自己已不在的房间，
      // 既收不到新消息（服务端不再向该用户投递），也无法发送。
      const isLeftRoom = (room: Room): boolean => {
        const membership = room.getMyMembership?.()
        return membership === 'leave' || membership === 'ban'
      }

      const sessions = client
        .getRooms()
        .filter((room) => !isSystemContainerRoom(room) && !isLeftRoom(room) && !isDeadRoom(room))
        .map((room) => {
          const dmRoomInfo = dmRoomMap.get(room.roomId) ?? null
          return buildSessionFromRoom(room, dmRoomInfo, client)
        })

      // 防御性去重：按 counterpart 用户去重（resolveDmIdentityKey 统一 localpart 归一化，
      // 避免历史 localpart 与完整 MXID 混存时同一联系人被拆成两条），
      // 保留最新活跃的，未读数累加到保留条目，身份字段互补防丢。
      const seen = new Map<string, SessionInfo>()
      for (const session of sessions) {
        if (session.type !== RoomTypeEnum.SINGLE) {
          seen.set(session.roomId, session)
          continue
        }
        const identityKey = resolveDmIdentityKey({
          detailId: session.detailId ?? null,
          account: session.account ?? null
        })
        const counterpartId = identityKey || session.roomId
        const existing = seen.get(counterpartId)
        if (!existing) {
          seen.set(counterpartId, session)
          continue
        }
        const base = session.activeTime > existing.activeTime ? session : existing
        const other = session.activeTime > existing.activeTime ? existing : session
        seen.set(counterpartId, {
          ...base,
          detailId: base.detailId || other.detailId,
          account: base.account || other.account,
          unreadCount: (base.unreadCount ?? 0) + (other.unreadCount ?? 0)
        })
      }
      return Array.from(seen.values())
    } catch (err) {
      logger.error(`[MatrixSession] 获取会话列表失败: ${err}`)
      throw err
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
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) {
      return null
    }
    return buildSessionFromRoom(room, null, client)
  }

  /**
   * 按已同步的 Room 实例直接构建会话详情（roomId 路径专用）。
   *
   * openMsgSession 兜底场景手里只有 roomId，绝不能走 SINGLE 分支——
   * 那条链路把参数当 userId 喂给 DM 管理器（历史事故：
   * "Invalid user ID format: !xxx" ValidationError）。此方法供其
   * 在房间已同步时同步构建会话，避免异步查询。
   */
  buildSessionFromRoomPublic(room: Room, dmRoomInfo: DmRoomInfo | null): SessionDetail {
    return buildSessionFromRoom(room, dmRoomInfo, this.getClient())
  }

  private async getDirectSessionDetail(userId: string): Promise<SessionDetail | null> {
    const client = this.getClient()

    // 1) 优先从本地已同步的房间中按"对方成员"直接定位 DM 房间。
    //    这样即使 DirectMessageManager 扩展尚未加载、或 m.direct 映射未同步，
    //    也能正确跳转到已存在的私聊，避免"进入聊天/加密聊天"按钮点击无反应。
    const localRoom = this.findLocalDirectRoom(userId)
    if (localRoom) {
      const dmRoomInfo = await matrixDirectMessageService.getDmRoomInfo(localRoom.roomId, false)
      return buildSessionFromRoom(localRoom, dmRoomInfo, client)
    }

    // 2) 走 DM 管理器查找/创建（需要 manager 就绪）
    try {
      const existingRoomId = await matrixDirectMessageService.getDmForUser(userId, false)
      const roomId = existingRoomId ?? (await matrixDirectMessageService.createDm(userId))
      const room = (await this.waitForRoomAvailable(roomId)) ?? client.getRoom(roomId)

      if (room) {
        const dmRoomInfo = await matrixDirectMessageService.getDmRoomInfo(roomId, false)
        return buildSessionFromRoom(room, dmRoomInfo, client)
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
        return buildSessionFromRoom(fallback, dmRoomInfo, client)
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
}

export const matrixSessionService = new MatrixSessionService()
