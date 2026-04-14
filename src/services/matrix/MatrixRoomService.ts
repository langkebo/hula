import type { Room, RoomMember } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { BaseManager, NotFoundError } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'

class MatrixRoomService extends BaseManager {
  private getClient() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('客户端未初始化')
    return client
  }

  private getRoomManager() {
    return (this.getClient() as any).getRoomManager()
  }

  private getRoomSettingsManager() {
    return (this.getClient() as any).getRoomSettingsManager()
  }

  private getRoomJoiningManager() {
    return (this.getClient() as any).getRoomJoiningManager()
  }

  private getRoomCreationManager() {
    return (this.getClient() as any).getRoomCreationManager()
  }

  private getDirectMessageManager() {
    return (this.getClient() as any).getDirectMessageManager()
  }

  private getPushManager() {
    return (this.getClient() as any).getPushManager()
  }

  private getPowerLevelsManager() {
    return (this.getClient() as any).getPowerLevelsManager()
  }

  private getRoomSummaryManager() {
    return (this.getClient() as any).getRoomSummaryManager()
  }

  async getRooms(throwOnError = true): Promise<Room[]> {
    try {
      const manager = this.getRoomManager()
      return manager.getRooms()
    } catch (error) {
      return this.handleError(error, 'getRooms', [] as Room[], throwOnError)
    }
  }

  async getRoom(roomId: string, throwOnError = true): Promise<Room | null> {
    try {
      const manager = this.getRoomManager()
      const room = manager.getRoom(roomId) ?? null
      if (!room && throwOnError) {
        throw new NotFoundError(`Room not found: ${roomId}`)
      }
      return room
    } catch (error) {
      return this.handleError(error, 'getRoom', null, throwOnError)
    }
  }

  async createRoom(options: Record<string, unknown>, throwOnError = false): Promise<{ room_id: string }> {
    try {
      const manager = this.getRoomCreationManager()
      const result = await manager.createRoom(options)
      info(`[MatrixRoom] 创建房间成功: ${result.room_id}`)
      return result
    } catch (error) {
      return this.handleError(error, 'createRoom', { room_id: '' }, throwOnError)
    }
  }

  async createDirectRoom(userId: string, throwOnError = true): Promise<string> {
    try {
      const manager = this.getDirectMessageManager()
      const roomId = await manager.createDmRoom(userId)
      info(`[MatrixRoom] 创建直接消息房间成功: ${roomId}`)
      return roomId
    } catch (error) {
      return this.handleError(error, 'createDirectRoom', '', throwOnError)
    }
  }

  async joinRoom(roomId: string, throwOnError = true): Promise<Room> {
    try {
      const manager = this.getRoomJoiningManager()
      return await manager.joinRoom(roomId)
    } catch (error) {
      return this.handleError(error, 'joinRoom', null as unknown as Room, throwOnError)
    }
  }

  async leaveRoom(roomId: string, throwOnError = true): Promise<void> {
    try {
      const manager = this.getRoomJoiningManager()
      await manager.leaveRoom(roomId)
      info(`[MatrixRoom] 离开房间成功: ${roomId}`)
    } catch (error) {
      this.handleError(error, 'leaveRoom', undefined, throwOnError)
    }
  }

  async getMembers(roomId: string, throwOnError = true): Promise<RoomMember[]> {
    try {
      const room = await this.getRoom(roomId, throwOnError)
      if (!room) {
        if (throwOnError) throw new NotFoundError(`Room not found: ${roomId}`)
        return []
      }
      return room.getJoinedMembers()
    } catch (error) {
      return this.handleError(error, 'getMembers', [] as RoomMember[], throwOnError)
    }
  }

  async inviteUser(roomId: string, userId: string, throwOnError = true): Promise<void> {
    try {
      const manager = this.getRoomJoiningManager()
      await manager.inviteUser(userId, roomId)
      info(`[MatrixRoom] 邀请用户成功: ${userId} -> ${roomId}`)
    } catch (error) {
      this.handleError(error, 'inviteUser', undefined, throwOnError)
    }
  }

  async kickUser(roomId: string, userId: string, reason?: string, throwOnError = true): Promise<void> {
    try {
      const manager = this.getRoomJoiningManager()
      await manager.kickUser(userId, roomId, reason)
      info(`[MatrixRoom] 踢出用户成功: ${userId} <- ${roomId}`)
    } catch (error) {
      this.handleError(error, 'kickUser', undefined, throwOnError)
    }
  }

  async banUser(roomId: string, userId: string, reason?: string, throwOnError = true): Promise<void> {
    try {
      const manager = this.getRoomJoiningManager()
      await manager.banUser(userId, roomId, reason)
      info(`[MatrixRoom] 封禁用户成功: ${userId} <- ${roomId}`)
    } catch (error) {
      this.handleError(error, 'banUser', undefined, throwOnError)
    }
  }

  async unbanUser(roomId: string, userId: string, throwOnError = true): Promise<void> {
    try {
      const manager = this.getRoomJoiningManager()
      await manager.unbanUser(userId, roomId)
      info(`[MatrixRoom] 解封用户成功: ${userId} <- ${roomId}`)
    } catch (error) {
      this.handleError(error, 'unbanUser', undefined, throwOnError)
    }
  }

  async setRoomName(roomId: string, name: string, throwOnError = true): Promise<void> {
    try {
      const manager = this.getRoomSettingsManager()
      await manager.setRoomName(roomId, name)
      info(`[MatrixRoom] 设置房间名称成功: ${roomId} -> ${name}`)
    } catch (error) {
      this.handleError(error, 'setRoomName', undefined, throwOnError)
    }
  }

  async setRoomTopic(roomId: string, topic: string, throwOnError = true): Promise<void> {
    try {
      const manager = this.getRoomSettingsManager()
      await manager.setRoomTopic(roomId, topic)
      info(`[MatrixRoom] 设置房间主题成功: ${roomId}`)
    } catch (error) {
      this.handleError(error, 'setRoomTopic', undefined, throwOnError)
    }
  }

  async setRoomAvatar(roomId: string, avatarUrl: string, throwOnError = true): Promise<void> {
    try {
      const manager = this.getRoomSettingsManager()
      await manager.setRoomAvatar(roomId, avatarUrl)
      info(`[MatrixRoom] 设置房间头像成功: ${roomId}`)
    } catch (error) {
      this.handleError(error, 'setRoomAvatar', undefined, throwOnError)
    }
  }

  async getRoomState(roomId: string, throwOnError = true): Promise<unknown[]> {
    try {
      const manager = this.getRoomManager()
      return await manager.getState(roomId)
    } catch (error) {
      return this.handleError(error, 'getRoomState', [] as unknown[], throwOnError)
    }
  }

  async setPushRule(roomId: string, enabled: boolean, throwOnError = true): Promise<void> {
    try {
      const manager = this.getPushManager()
      if (enabled) {
        await manager.deletePushRule('global', 'override', roomId)
      } else {
        await manager.createPushRule('global', 'override', roomId, {
          conditions: [
            {
              kind: 'event_match',
              key: 'room_id',
              pattern: roomId
            }
          ],
          actions: []
        })
      }
      info(`[MatrixRoom] 设置推送规则成功: ${roomId} -> ${enabled}`)
    } catch (error) {
      this.handleError(error, 'setPushRule', undefined, throwOnError)
    }
  }

  async getDirectRooms(throwOnError = true): Promise<Map<string, string[]>> {
    try {
      const manager = this.getDirectMessageManager()
      const directMap = await manager.getDirectRoomsByUser()
      const result = new Map<string, string[]>()
      if (directMap && typeof directMap === 'object') {
        for (const [userId, roomIds] of Object.entries(directMap)) {
          if (Array.isArray(roomIds)) {
            result.set(userId, roomIds as string[])
          }
        }
      }
      return result
    } catch (error) {
      return this.handleError(error, 'getDirectRooms', new Map<string, string[]>(), throwOnError)
    }
  }

  async setDirectRoom(userId: string, roomId: string, throwOnError = true): Promise<void> {
    try {
      const manager = this.getDirectMessageManager()
      await manager.setDmRoom(roomId, userId)
      info(`[MatrixRoom] 设置直接消息房间成功: ${userId} -> ${roomId}`)
    } catch (error) {
      this.handleError(error, 'setDirectRoom', undefined, throwOnError)
    }
  }

  async setMemberDisplayName(roomId: string, displayName: string, throwOnError = true): Promise<void> {
    const client = this.getClient()
    try {
      const userId = client.getUserId()
      if (!userId) throw new Error('用户未登录')

      const room = client.getRoom(roomId)
      if (!room) throw new Error(`房间不存在: ${roomId}`)

      const currentMember = room.getMember(userId)
      const memberEvent = (currentMember as { events?: { member?: { getContent: () => Record<string, unknown> } } })
        ?.events?.member
      const currentMembership = memberEvent?.getContent() || {}

      const manager = this.getRoomManager()
      await manager.sendStateEvent(
        roomId,
        'm.room.member',
        {
          ...currentMembership,
          displayname: displayName,
          membership: 'join'
        },
        userId
      )

      info(`[MatrixRoom] 设置成员昵称成功: ${roomId} -> ${displayName}`)
    } catch (error) {
      this.handleError(error, 'setMemberDisplayName', undefined, throwOnError)
    }
  }

  async getMemberDisplayName(roomId: string, userId: string, throwOnError = true): Promise<string | null> {
    try {
      const room = await this.getRoom(roomId, throwOnError)
      if (!room) return null
      const member = room.getMember(userId)
      return member?.rawDisplayName || member?.name || null
    } catch (error) {
      return this.handleError(error, 'getMemberDisplayName', null, throwOnError)
    }
  }

  async setMemberPowerLevel(roomId: string, userId: string, powerLevel: number, throwOnError = true): Promise<void> {
    try {
      const manager = this.getPowerLevelsManager()
      await manager.setUserPowerLevel(userId, roomId, powerLevel)
      info(`[MatrixRoom] 成功设置用户 ${userId} 的权力等级为 ${powerLevel}`)
    } catch (error) {
      this.handleError(error, 'setMemberPowerLevel', undefined, throwOnError)
    }
  }

  async setMemberAsAdmin(roomId: string, userId: string, throwOnError = true): Promise<void> {
    await this.setMemberPowerLevel(roomId, userId, 100, throwOnError)
  }

  async removeMemberAsAdmin(roomId: string, userId: string, throwOnError = true): Promise<void> {
    await this.setMemberPowerLevel(roomId, userId, 0, throwOnError)
  }

  async getRoomSummary(
    roomId: string,
    throwOnError = true
  ): Promise<{
    roomId: string
    roomType: string | null
    name: string | null
    topic: string | null
    avatarUrl: string | null
    canonicalAlias: string | null
    joinRule: string
    historyVisibility: string
    guestAccess: string
    isDirect: boolean
    isSpace: boolean
    isEncrypted: boolean
    isPublic: boolean
    memberCount: number
    joinedCount: number
    invitedCount: number
    heroes: Array<{ userId: string; displayName?: string; avatarUrl?: string }>
    lastEventTs: number | null
    lastMessageTs: number | null
  } | null> {
    try {
      const manager = this.getRoomSummaryManager()
      const summary = await manager.getRoomSummary(roomId)
      if (!summary) return null

      return {
        roomId: summary.room_id,
        roomType: summary.room_type ?? null,
        name: summary.name ?? null,
        topic: summary.topic ?? null,
        avatarUrl: summary.avatar_url ?? null,
        canonicalAlias: summary.canonical_alias ?? null,
        joinRule: summary.join_rule ?? '',
        historyVisibility: summary.history_visibility ?? '',
        guestAccess: summary.guest_access ?? '',
        isDirect: summary.is_direct ?? false,
        isSpace: summary.is_space ?? false,
        isEncrypted: summary.is_encrypted ?? false,
        isPublic: summary.join_rule === 'public',
        memberCount: summary.member_count ?? 0,
        joinedCount: summary.joined_member_count ?? 0,
        invitedCount: summary.invited_member_count ?? 0,
        heroes: (summary.heroes || []).map((h: any) => ({
          userId: h.user_id ?? '',
          displayName: h.display_name ?? undefined,
          avatarUrl: h.avatar_url ?? undefined
        })),
        lastEventTs: summary.last_event_ts ?? null,
        lastMessageTs: summary.last_message_ts ?? null
      }
    } catch (error) {
      if (throwOnError) {
        return this.handleError(error, 'getRoomSummary', null, true)
      }
      const room = await this.getRoom(roomId)
      if (!room) return null

      const topicEvent = room.currentState.getStateEvents('m.room.topic', '')
      const topic = (topicEvent?.getContent()?.topic as string | undefined) ?? null
      const joinRulesEvent = room.currentState.getStateEvents('m.room.join_rules', '')
      const joinRule = (joinRulesEvent?.getContent()?.join_rule as string) ?? ''
      const historyVisEvent = room.currentState.getStateEvents('m.room.history_visibility', '')
      const historyVisibility = (historyVisEvent?.getContent()?.history_visibility as string) ?? ''
      const guestAccessEvent = room.currentState.getStateEvents('m.room.guest_access', '')
      const guestAccess = (guestAccessEvent?.getContent()?.guest_access as string) ?? ''
      const isEncrypted = room.currentState.getStateEvents('m.room.encryption', '') !== null

      return {
        roomId: room.roomId,
        roomType: null,
        name: room.name,
        topic,
        avatarUrl: room.getMxcAvatarUrl() ?? null,
        canonicalAlias: room.getCanonicalAlias() ?? null,
        joinRule,
        historyVisibility,
        guestAccess,
        isDirect: false,
        isSpace: false,
        isEncrypted,
        isPublic: joinRule === 'public',
        memberCount: room.getJoinedMembers().length,
        joinedCount: room.getJoinedMembers().length,
        invitedCount: 0,
        heroes: [],
        lastEventTs: null,
        lastMessageTs: null
      }
    }
  }

  async getRoomSummaries(
    roomIds: string[],
    _throwOnError = true
  ): Promise<
    Map<string, { name: string | null; topic: string | null; avatarUrl: string | null; memberCount: number }>
  > {
    const results = new Map<
      string,
      { name: string | null; topic: string | null; avatarUrl: string | null; memberCount: number }
    >()
    const client = this.getClient()

    const settled = await Promise.allSettled(
      roomIds.map(async (roomId) => {
        try {
          const manager = this.getRoomSummaryManager()
          const summary = await manager.getRoomSummary(roomId)
          if (summary) {
            return {
              roomId,
              data: {
                name: summary.name ?? null,
                topic: summary.topic ?? null,
                avatarUrl: summary.avatar_url ?? null,
                memberCount: summary.member_count ?? 0
              }
            }
          }
        } catch {
          // fallback to local room
        }

        const room = client.getRoom(roomId)
        if (room) {
          const topicEvent = room.currentState.getStateEvents('m.room.topic', '')
          const topic = (topicEvent?.getContent()?.topic as string | undefined) ?? null
          return {
            roomId,
            data: {
              name: room.name,
              topic,
              avatarUrl: room.getMxcAvatarUrl() ?? null,
              memberCount: room.getJoinedMembers().length
            }
          }
        }
        return null
      })
    )

    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) {
        results.set(result.value.roomId, result.value.data)
      }
    }

    return results
  }

  async deleteRoomFromStore(roomId: string, throwOnError = true): Promise<void> {
    try {
      const manager = this.getRoomManager()
      await manager.leave(roomId)
      await manager.forget(roomId)
      info(`[MatrixRoom] 已从存储删除房间: ${roomId}`)
    } catch (error) {
      this.handleError(error, 'deleteRoomFromStore', undefined, throwOnError)
    }
  }

  async setRoomPinStatus(roomId: string, pinned: boolean, throwOnError = true): Promise<void> {
    try {
      const manager = this.getRoomManager()
      await manager.setRoomAccountData(roomId, 'm.fully_read', { pinned })
      info(`[MatrixRoom] 设置房间置顶状态: ${roomId} -> ${pinned}`)
    } catch (error) {
      this.handleError(error, 'setRoomPinStatus', undefined, throwOnError)
    }
  }

  async setRoomNotificationStatus(
    roomId: string,
    _notificationType: number,
    shield: boolean,
    throwOnError = true
  ): Promise<void> {
    try {
      const manager = this.getPushManager()
      if (shield) {
        await manager.muteRoom(roomId)
      } else {
        await manager.unmuteRoom(roomId)
      }
      info(`[MatrixRoom] 设置房间通知状态: ${roomId} -> shield=${shield}`)
    } catch (error) {
      this.handleError(error, 'setRoomNotificationStatus', undefined, throwOnError)
    }
  }

  async translateText(text: string, targetLanguage: string, throwOnError = true): Promise<string | null> {
    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`
      )
      const data = await response.json()
      if (data && data[0]) {
        return data[0].map((item: string[]) => item[0]).join('')
      }
      return null
    } catch (error) {
      return this.handleError(error, 'translateText', null, throwOnError)
    }
  }
}

export const matrixRoomService = new MatrixRoomService()
export default matrixRoomService
