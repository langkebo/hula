import type { Room, RoomMember, ICreateRoomOpts } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

/**
 * Matrix 房间服务
 *
 * 提供房间管理功能，包括创建、加入、离开房间，以及成员管理等操作。
 *
 * @example
 * ```typescript
 * import { matrixRoomService } from '@/services/matrix'
 *
 * // 获取所有房间
 * const rooms = await matrixRoomService.getRooms()
 *
 * // 创建房间
 * const room = await matrixRoomService.createRoom({
 *   name: 'My Room',
 *   preset: 'private_chat'
 * })
 *
 * // 邀请用户
 * await matrixRoomService.inviteUser(room.roomId, '@user:example.org')
 * ```
 */
class MatrixRoomService {
  /**
   * 获取所有房间
   *
   * @returns 房间列表
   * @throws {Error} 如果客户端未初始化
   */
  async getRooms(): Promise<Room[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client.getRooms()
  }

  /**
   * 获取指定房间
   *
   * @param roomId - 房间 ID
   * @returns 房间实例，如果不存在则返回 null
   * @throws {Error} 如果客户端未初始化
   */
  async getRoom(roomId: string): Promise<Room | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client.getRoom(roomId) ?? null
  }

  /**
   * 创建房间
   *
   * @param options - 房间创建选项
   * @returns 创建的房间
   * @throws {Error} 如果客户端未初始化或创建失败
   */
  async createRoom(options: ICreateRoomOpts): Promise<Room> {
    return matrixClientService.createRoom(options)
  }

  /**
   * 创建直接消息房间
   *
   * @param userId - 目标用户 ID
   * @returns 创建的房间 ID
   * @throws {Error} 如果客户端未初始化或创建失败
   */
  async createDirectRoom(userId: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const room = await client.createRoom({
        is_direct: true,
        invite: [userId],
        preset: 'trusted_private_chat' as any,
        visibility: 'private' as any
      })
      info(`[MatrixRoom] 创建直接消息房间成功: ${room.room_id}`)
      return room.room_id
    } catch (err) {
      error(`[MatrixRoom] 创建直接消息房间失败: ${err}`)
      throw err
    }
  }

  /**
   * 加入房间
   *
   * @param roomId - 房间 ID 或别名
   * @returns 加入的房间
   * @throws {Error} 如果客户端未初始化或加入失败
   */
  async joinRoom(roomId: string): Promise<Room> {
    return matrixClientService.joinRoom(roomId)
  }

  /**
   * 离开房间
   *
   * @param roomId - 房间 ID
   * @throws {Error} 如果客户端未初始化或离开失败
   */
  async leaveRoom(roomId: string): Promise<void> {
    return matrixClientService.leaveRoom(roomId)
  }

  /**
   * 获取房间成员列表
   *
   * @param roomId - 房间 ID
   * @returns 成员列表
   * @throws {Error} 如果客户端未初始化或房间不存在
   */
  async getMembers(roomId: string): Promise<RoomMember[]> {
    const room = await this.getRoom(roomId)
    if (!room) {
      throw new Error(`房间不存在: ${roomId}`)
    }
    return room.getJoinedMembers()
  }

  /**
   * 邀请用户加入房间
   *
   * @param roomId - 房间 ID
   * @param userId - 用户 ID
   * @throws {Error} 如果客户端未初始化或邀请失败
   */
  async inviteUser(roomId: string, userId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      await client.invite(roomId, userId)
      info(`[MatrixRoom] 邀请用户成功: ${userId} -> ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 邀请用户失败: ${err}`)
      throw err
    }
  }

  /**
   * 将用户踢出房间
   *
   * @param roomId - 房间 ID
   * @param userId - 用户 ID
   * @param reason - 踢出原因 (可选)
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      await client.kick(roomId, userId, reason)
      info(`[MatrixRoom] 踢出用户成功: ${userId} <- ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 踢出用户失败: ${err}`)
      throw err
    }
  }

  /**
   * 封禁用户
   *
   * @param roomId - 房间 ID
   * @param userId - 用户 ID
   * @param reason - 封禁原因 (可选)
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      await client.ban(roomId, userId, reason)
      info(`[MatrixRoom] 封禁用户成功: ${userId} <- ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 封禁用户失败: ${err}`)
      throw err
    }
  }

  /**
   * 解封用户
   *
   * @param roomId - 房间 ID
   * @param userId - 用户 ID
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async unbanUser(roomId: string, userId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      await client.unban(roomId, userId)
      info(`[MatrixRoom] 解封用户成功: ${userId} <- ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 解封用户失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置房间名称
   *
   * @param roomId - 房间 ID
   * @param name - 新名称
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async setRoomName(roomId: string, name: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      await (client as any).setRoomName(roomId, name)
      info(`[MatrixRoom] 设置房间名称成功: ${roomId} -> ${name}`)
    } catch (err) {
      error(`[MatrixRoom] 设置房间名称失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置房间主题
   *
   * @param roomId - 房间 ID
   * @param topic - 主题内容
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async setRoomTopic(roomId: string, topic: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      await (client as any).setRoomTopic(roomId, topic)
      info(`[MatrixRoom] 设置房间主题成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 设置房间主题失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置房间头像
   *
   * @param roomId - 房间 ID
   * @param avatarUrl - 头像 URL (mxc://)
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async setRoomAvatar(roomId: string, avatarUrl: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      await (client as any).sendStateEvent(roomId, 'm.room.avatar', { url: avatarUrl }, '')
      info(`[MatrixRoom] 设置房间头像成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 设置房间头像失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取房间状态事件
   *
   * @param roomId - 房间 ID
   * @returns 状态事件列表
   * @throws {Error} 如果客户端未初始化或房间不存在
   */
  async getRoomState(roomId: string): Promise<unknown[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }
      return room.currentState.getStateEvents('*')
    } catch (err) {
      error(`[MatrixRoom] 获取房间状态失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置房间推送规则
   *
   * @param roomId - 房间 ID
   * @param enabled - 是否启用推送
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async setPushRule(roomId: string, enabled: boolean): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      if (enabled) {
        await (client as any).deletePushRule('global', 'override', roomId)
      } else {
        await (client as any).addPushRule('global', 'override', roomId, {
          conditions: [
            {
              kind: 'event_match' as any,
              key: 'room_id',
              pattern: roomId
            }
          ],
          actions: []
        })
      }
      info(`[MatrixRoom] 设置推送规则成功: ${roomId} -> ${enabled}`)
    } catch (err) {
      error(`[MatrixRoom] 设置推送规则失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取直接消息房间映射
   *
   * @returns 用户 ID 到房间 ID 列表的映射
   * @throws {Error} 如果客户端未初始化
   */
  async getDirectRooms(): Promise<Map<string, string[]>> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const accountData = (client as any).getAccountData('m.direct')
      if (accountData) {
        return new Map(Object.entries(accountData.getContent()))
      }
      return new Map()
    } catch (err) {
      error(`[MatrixRoom] 获取直接消息房间失败: ${err}`)
      return new Map()
    }
  }

  /**
   * 设置直接消息房间
   *
   * @param userId - 用户 ID
   * @param roomId - 房间 ID
   * @throws {Error} 如果客户端未初始化或操作失败
   */
  async setDirectRoom(userId: string, roomId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const directRooms = await this.getDirectRooms()
      const rooms = directRooms.get(userId) || []
      if (!rooms.includes(roomId)) {
        rooms.push(roomId)
        directRooms.set(userId, rooms)
        await (client as any).setAccountData('m.direct', Object.fromEntries(directRooms))
      }
      info(`[MatrixRoom] 设置直接消息房间成功: ${userId} -> ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 设置直接消息房间失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置当前用户在房间中的昵称
   *
   * @param roomId - 房间 ID
   * @param displayName - 显示名称
   * @throws {Error} 如果客户端未初始化、用户未登录或房间不存在
   */
  async setMemberDisplayName(roomId: string, displayName: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const userId = client.getUserId()
      if (!userId) {
        throw new Error('用户未登录')
      }

      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }

      const currentMember = room.getMember(userId)
      const currentMembership = (currentMember as any)?.events?.member?.getContent() || {}

      await (client as any).sendStateEvent(
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
    } catch (err) {
      error(`[MatrixRoom] 设置成员昵称失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取成员在房间中的显示名称
   *
   * @param roomId - 房间 ID
   * @param userId - 用户 ID
   * @returns 显示名称，如果不存在则返回 null
   */
  async getMemberDisplayName(roomId: string, userId: string): Promise<string | null> {
    const room = await this.getRoom(roomId)
    if (!room) {
      return null
    }

    const member = room.getMember(userId)
    return member?.rawDisplayName || member?.name || null
  }

  /**
   * 设置成员权力等级（角色）
   * @param roomId - 房间 ID
   * @param userId - 用户 ID
   * @param powerLevel - 权力等级 (0=普通成员, 50=管理员, 100=创建者)
   */
  async setMemberPowerLevel(roomId: string, userId: string, powerLevel: number): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    try {
      await (client as any).setUserPowerLevel(userId, roomId, powerLevel)
      info(`[MatrixRoom] 成功设置用户 ${userId} 的权力等级为 ${powerLevel}`)
    } catch (err) {
      error(`[MatrixRoom] 设置权力等级失败: ${err}`)
      throw err
    }
  }

  /**
   * 将成员设为管理员
   */
  async setMemberAsAdmin(roomId: string, userId: string): Promise<void> {
    await this.setMemberPowerLevel(roomId, userId, 100)
  }

  /**
   * 移除管理员权限
   */
  async removeMemberAsAdmin(roomId: string, userId: string): Promise<void> {
    await this.setMemberPowerLevel(roomId, userId, 0)
  }

  /**
   * 翻译文本
   *
   * @param text - 要翻译的文本
   * @param _provider - 翻译服务提供者 (当前使用 Google Translate)
   * @returns 翻译后的文本
   */
  async translateText(text: string, _provider?: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const response = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`
      )
      const data = await response.json()
      if (data && data[0]) {
        const translatedText = data[0].map((item: unknown[]) => item[0]).join('')
        info(`[MatrixRoom] 翻译成功`)
        return translatedText
      }
      return text
    } catch (err) {
      error(`[MatrixRoom] 翻译失败: ${err}`)
      return text
    }
  }

  // ============================================
  // RoomSummaryService 对应方法
  // ============================================

  /**
   * 获取房间摘要
   * 对应后端 RoomSummaryService.get_summary()
   *
   * @param roomId - 房间 ID
   * @returns 房间摘要信息
   */
  async getRoomSummary(roomId: string): Promise<{
    roomId: string
    name: string | null
    topic: string | null
    avatarUrl: string | null
    memberCount: number
    joinedCount: number
    canonicalAlias: string | null
    isPublic: boolean
  } | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    const room = client.getRoom(roomId)
    if (!room) return null

    return {
      roomId: room.roomId,
      name: room.name,
      topic: room.topic ?? null,
      avatarUrl: room.getMxcAvatarUrl(),
      memberCount: room.getJoinedMembers().length,
      joinedCount: room.getJoinedMembers().length,
      canonicalAlias: room.getCanonicalAlias() ?? null,
      isPublic: room.isPublic()
    }
  }

  /**
   * 批量获取房间摘要
   * 使用本地 Room 对象获取，避免调用可能不存在的后端 API
   */
  async getRoomSummaries(roomIds: string[]): Promise<
    Map<
      string,
      {
        name: string | null
        topic: string | null
        avatarUrl: string | null
        memberCount: number
      }
    >
  > {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      // 直接使用本地 Room 对象获取摘要，避免网络请求
      return this.fallbackGetRoomSummaries(roomIds)
    } catch (err) {
      error(`[MatrixRoom] 获取房间摘要失败: ${err}`)
      throw err
    }
  }

  /**
   * 回退方案：逐个获取房间摘要
   */
  private async fallbackGetRoomSummaries(roomIds: string[]): Promise<
    Map<
      string,
      {
        name: string | null
        topic: string | null
        avatarUrl: string | null
        memberCount: number
      }
    >
  > {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    const results = new Map<
      string,
      {
        name: string | null
        topic: string | null
        avatarUrl: string | null
        memberCount: number
      }
    >()

    for (const roomId of roomIds) {
      const room = client.getRoom(roomId)
      if (room) {
        results.set(roomId, {
          name: room.name,
          topic: room.topic ?? null,
          avatarUrl: room.getMxcAvatarUrl(),
          memberCount: room.getJoinedMembers().length
        })
      }
    }

    return results
  }

  /**
   * 增加未读计数
   * 对应后端 RoomSummaryService.increment_unread()
   *
   * @param roomId - 房间 ID
   * @param highlight - 是否高亮
   */
  async incrementUnread(roomId: string, highlight: boolean = false): Promise<void> {
    const room = await this.getRoom(roomId)
    if (!room) {
      throw new Error(`房间不存在: ${roomId}`)
    }
    info(`[MatrixRoom] 房间 ${roomId} 未读计数增加${highlight ? '（高亮）' : ''}`)
  }

  /**
   * 清除未读计数
   * 对应后端 RoomSummaryService.clear_unread()
   *
   * @param roomId - 房间 ID
   */
  async clearUnread(roomId: string): Promise<void> {
    const room = await this.getRoom(roomId)
    if (!room) {
      throw new Error(`房间不存在: ${roomId}`)
    }
    info(`[MatrixRoom] 房间 ${roomId} 未读计数已清除`)
  }
}

export const matrixRoomService = new MatrixRoomService()
export default matrixRoomService
