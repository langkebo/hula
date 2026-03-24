/**
 * Matrix 会话服务
 *
 * 提供会话/对话管理功能，包括获取会话列表、设置置顶、删除会话等操作。
 *
 * @example
 * ```typescript
 * import { matrixSessionService } from '@/services/matrix'
 *
 * // 获取所有会话
 * const sessions = await matrixSessionService.getSessionList()
 *
 * // 获取会话详情
 * const detail = await matrixSessionService.getSessionDetailWithFriends('!roomId:example.org')
 *
 * // 设置会话置顶
 * await matrixSessionService.setSessionTop('!roomId:example.org', true)
 *
 * // 删除会话
 * await matrixSessionService.deleteSession('!roomId:example.org')
 * ```
 */

import type { Room, MatrixEvent, RoomMember } from 'matrix-js-sdk'
import { matrixClientService } from './MatrixClientService'
import { matrixDirectMessageService, type DmRoomInfo } from './MatrixDirectMessageService'
import { matrixFriendService, type Friend } from './MatrixFriendService'
import { info, error as logError } from '@tauri-apps/plugin-log'

export interface SessionInfo {
  roomId: string
  name: string
  avatarUrl?: string
  lastMessage?: {
    content: string
    timestamp: number
    sender?: string
  }
  unreadCount: number
  isPinned: boolean
  isEncrypted: boolean
  isDirect: boolean
  memberCount: number
  lastActiveTime?: number
}

export interface SessionDetail extends SessionInfo {
  friend?: Friend
  members: Array<{
    userId: string
    displayName?: string
    avatarUrl?: string
    isOnline: boolean
  }>
  latestEvents: MatrixEvent[]
  isArchived: boolean
}

class MatrixSessionService {
  private pinnedRoomsCache: Set<string> = new Set()

  /**
   * 获取所有 DM 会话列表
   *
   * @returns 会话信息列表
   * @throws {Error} 如果客户端未初始化
   */
  async getSessionList(): Promise<SessionInfo[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSession] 客户端未初始化')
    }

    try {
      const dmRooms = await matrixDirectMessageService.getDMRooms()
      const rooms = client.getRooms()
      const sessionList: SessionInfo[] = []

      for (const room of rooms) {
        if ((room as any).isDirect?.() || this.isDirectRoom(room, dmRooms)) {
          const session = await this.buildSessionInfo(room, dmRooms)
          if (session) {
            sessionList.push(session)
          }
        }
      }

      sessionList.sort((a, b) => {
        const aTime = a.lastActiveTime ?? 0
        const bTime = b.lastActiveTime ?? 0
        return bTime - aTime
      })

      info(`[MatrixSession] 获取会话列表成功: ${sessionList.length} 个会话`)
      return sessionList
    } catch (err) {
      logError(`[MatrixSession] 获取会话列表失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取会话详情，包含好友信息
   *
   * @param roomIdOrParams - 房间 ID 或包含 id 和 roomType 的对象
   * @returns 会话详情
   * @throws {Error} 如果客户端未初始化或房间不存在
   */
  async getSessionDetailWithFriends(
    roomIdOrParams: string | { id: string; roomType: number }
  ): Promise<SessionDetail | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSession] 客户端未初始化')
    }

    try {
      let roomId: string

      if (typeof roomIdOrParams === 'object') {
        const { id: userId, roomType: _roomType } = roomIdOrParams
        if (_roomType === 1) {
          roomId = userId
        } else {
          const dmRoomId = await matrixDirectMessageService.getDmForUser(userId)
          if (!dmRoomId) {
            logError(`[MatrixSession] 用户 ${userId} 的私聊房间不存在`)
            return null
          }
          roomId = dmRoomId
        }
      } else {
        roomId = roomIdOrParams
      }

      const room = client.getRoom(roomId)
      if (!room) {
        logError(`[MatrixSession] 房间不存在: ${roomId}`)
        return null
      }

      const dmRooms = await matrixDirectMessageService.getDMRooms()
      const sessionInfo = await this.buildSessionInfo(room, dmRooms)
      if (!sessionInfo) {
        return null
      }

      const friend = await this.getFriendForRoom(roomId)
      const members = this.buildMemberList(room)
      const latestEvents = this.getLatestEvents(room)
      const isArchived = this.checkIsArchived(room, client.getUserId()!)

      const detail: SessionDetail = {
        ...sessionInfo,
        friend,
        members,
        latestEvents,
        isArchived
      }

      info(`[MatrixSession] 获取会话详情成功: ${roomId}`)
      return detail
    } catch (err) {
      logError(`[MatrixSession] 获取会话详情失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置会话置顶/取消置顶
   *
   * @param roomId - 房间 ID
   * @param isTop - 是否置顶
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async setSessionTop(roomId: string, isTop: boolean): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSession] 客户端未初始化')
    }

    try {
      if (isTop) {
        this.pinnedRoomsCache.add(roomId)
        await client.setRoomAccountData(roomId, 'hula.pinned_rooms' as any, {
          pinned: Array.from(this.pinnedRoomsCache)
        })
        info(`[MatrixSession] 会话已置顶: ${roomId}`)
      } else {
        this.pinnedRoomsCache.delete(roomId)
        await client.setRoomAccountData(roomId, 'hula.pinned_rooms' as any, {
          pinned: Array.from(this.pinnedRoomsCache)
        })
        info(`[MatrixSession] 会话已取消置顶: ${roomId}`)
      }
    } catch (err) {
      logError(`[MatrixSession] 设置会话置顶失败: ${err}`)
      throw err
    }
  }

  /**
   * 删除会话 (忘记/离开房间)
   *
   * @param roomId - 房间 ID
   * @param ignoreLeft - 是否忽略已离开的房间 (默认: false)
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async deleteSession(roomId: string, ignoreLeft = false): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSession] 客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        logError(`[MatrixSession] 房间不存在: ${roomId}`)
        return
      }

      const myMembership = room.getMyMembership?.()
      if (myMembership === 'join') {
        await client.leave(roomId)
        info(`[MatrixSession] 已离开房间: ${roomId}`)
      } else if (myMembership === 'invite') {
        await client.leave(roomId)
        info(`[MatrixSession] 已拒绝邀请并离开: ${roomId}`)
      }

      if (myMembership !== 'leave' || !ignoreLeft) {
        await client.forget(roomId)
        this.pinnedRoomsCache.delete(roomId)
        info(`[MatrixSession] 已忘记房间: ${roomId}`)
      }
    } catch (err) {
      logError(`[MatrixSession] 删除会话失败: ${err}`)
      throw err
    }
  }

  /**
   * 加载已置顶的房间列表
   *
   * @throws {Error} 如果客户端未初始化
   */
  async loadPinnedRooms(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixSession] 客户端未初始化')
    }

    try {
      const userId = client.getUserId()
      if (!userId) {
        return
      }

      const accountData = client.getAccountData('hula.pinned_rooms' as any)
      if (accountData) {
        const content = accountData.getContent()
        if (content?.pinned && Array.isArray(content.pinned)) {
          this.pinnedRoomsCache = new Set(content.pinned)
          info(`[MatrixSession] 已加载置顶列表: ${this.pinnedRoomsCache.size} 个`)
        }
      }
    } catch (err) {
      logError(`[MatrixSession] 加载置顶列表失败: ${err}`)
    }
  }

  /**
   * 获取所有已置顶的房间 ID
   *
   * @returns 置顶房间 ID 列表
   */
  getPinnedRooms(): string[] {
    return Array.from(this.pinnedRoomsCache)
  }

  /**
   * 检查房间是否已置顶
   *
   * @param roomId - 房间 ID
   * @returns 是否已置顶
   */
  isRoomPinned(roomId: string): boolean {
    return this.pinnedRoomsCache.has(roomId)
  }

  private isDirectRoom(room: Room, dmRooms: DmRoomInfo[]): boolean {
    return dmRooms.some((dm) => dm.roomId === room.roomId)
  }

  private checkIsArchived(room: Room, userId: string): boolean {
    const member = room.getMember(userId)
    return member?.membership === 'leave'
  }

  private async buildSessionInfo(room: Room, dmRooms: DmRoomInfo[]): Promise<SessionInfo | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      return null
    }

    const lastMessage = this.getLastMessage(room)
    const unreadCount = room.getUnreadNotificationCount?.() || 0
    const isPinned = this.pinnedRoomsCache.has(room.roomId)
    const isEncrypted = client.isRoomEncrypted(room.roomId)
    const memberCount = room.getJoinedMemberCount()
    const isDirect = (room as any).isDirect?.() || this.isDirectRoom(room, dmRooms)

    let avatarUrl: string | undefined
    const avatarEvent = room.currentState.getStateEvents('m.room.avatar')[0]
    if (avatarEvent) {
      avatarUrl = (avatarEvent.getContent() as any).url
    }

    const name = room.name || this.getDmPartnerName(room) || 'Unknown'
    const directData = room.getAccountData('m.direct')?.getContent() as any
    const lastActiveTime = lastMessage?.timestamp || directData?.[room.roomId]?.lastActiveTime

    return {
      roomId: room.roomId,
      name,
      avatarUrl,
      lastMessage: lastMessage
        ? {
            content: lastMessage.content,
            timestamp: lastMessage.timestamp,
            sender: lastMessage.sender
          }
        : undefined,
      unreadCount,
      isPinned,
      isEncrypted,
      isDirect,
      memberCount,
      lastActiveTime
    }
  }

  private getLastMessage(room: Room): { content: string; timestamp: number; sender?: string } | undefined {
    try {
      const timeline = room.timeline
      if (timeline.length === 0) {
        return undefined
      }

      const lastEvent = timeline[timeline.length - 1]
      if (!lastEvent) {
        return undefined
      }

      const content = lastEvent.getContent()
      let messageContent = ''
      if (content.body) {
        messageContent = content.body
      } else if (content.msgtype === 'm.image') {
        messageContent = '[图片]'
      } else if (content.msgtype === 'm.file') {
        messageContent = '[文件]'
      } else if (content.msgtype === 'm.audio') {
        messageContent = '[语音]'
      } else if (content.msgtype === 'm.video') {
        messageContent = '[视频]'
      } else {
        messageContent = content.body || '[消息]'
      }

      return {
        content: messageContent,
        timestamp: lastEvent.localTimestamp,
        sender: lastEvent.getSender()
      }
    } catch {
      return undefined
    }
  }

  private getDmPartnerName(room: Room): string | undefined {
    try {
      const dmPartner = matrixDirectMessageService.getCachedDmRooms(room.roomId)
      if (dmPartner && dmPartner.length > 0) {
        return dmPartner[0].invitees?.[0] || dmPartner[0].inviter
      }
      return undefined
    } catch {
      return undefined
    }
  }

  private async getFriendForRoom(roomId: string): Promise<Friend | undefined> {
    try {
      const userId = await matrixDirectMessageService.getDmPartner(roomId)
      if (!userId) {
        return undefined
      }

      const syncState = (matrixFriendService as any).syncState as {
        friends: Friend[]
      }

      if (syncState?.friends) {
        return syncState.friends.find((f) => f.userId === userId)
      }

      return undefined
    } catch {
      return undefined
    }
  }

  private buildMemberList(room: Room): Array<{
    userId: string
    displayName?: string
    avatarUrl?: string
    isOnline: boolean
  }> {
    const members = room.getJoinedMembers()
    return members.map((member: RoomMember) => ({
      userId: member.userId,
      displayName: member.rawDisplayName,
      avatarUrl: member.getAvatarUrl(),
      isOnline: (member as any).presence !== 'offline'
    }))
  }

  private getLatestEvents(room: Room, limit = 20): MatrixEvent[] {
    try {
      const timeline = room.timeline
      return timeline.slice(-limit)
    } catch {
      return []
    }
  }
}

export const matrixSessionService = new MatrixSessionService()
export default matrixSessionService
