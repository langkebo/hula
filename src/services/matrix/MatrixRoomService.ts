import type { Room, RoomMember, ICreateRoomOpts } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

class MatrixRoomService {
  async getRooms(): Promise<Room[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client.getRooms()
  }

  async getRoom(roomId: string): Promise<Room | null> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client.getRoom(roomId) ?? null
  }

  async createRoom(options: ICreateRoomOpts): Promise<Room> {
    return matrixClientService.createRoom(options)
  }

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

  async joinRoom(roomId: string): Promise<Room> {
    return matrixClientService.joinRoom(roomId)
  }

  async leaveRoom(roomId: string): Promise<void> {
    return matrixClientService.leaveRoom(roomId)
  }

  async getMembers(roomId: string): Promise<RoomMember[]> {
    const room = await this.getRoom(roomId)
    if (!room) {
      throw new Error(`房间不存在: ${roomId}`)
    }
    return room.getJoinedMembers()
  }

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

  async setRoomName(roomId: string, name: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      await client.setRoomName(roomId, name)
      info(`[MatrixRoom] 设置房间名称成功: ${roomId} -> ${name}`)
    } catch (err) {
      error(`[MatrixRoom] 设置房间名称失败: ${err}`)
      throw err
    }
  }

  async setRoomTopic(roomId: string, topic: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      await client.setRoomTopic(roomId, topic)
      info(`[MatrixRoom] 设置房间主题成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 设置房间主题失败: ${err}`)
      throw err
    }
  }

  async setRoomAvatar(roomId: string, avatarUrl: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      await client.sendStateEvent(roomId, 'm.room.avatar' as any, { url: avatarUrl }, '')
      info(`[MatrixRoom] 设置房间头像成功: ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 设置房间头像失败: ${err}`)
      throw err
    }
  }

  async getRoomState(roomId: string): Promise<any[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error(`房间不存在: ${roomId}`)
      }
      return room.currentState.getStateEvents([] as any)
    } catch (err) {
      error(`[MatrixRoom] 获取房间状态失败: ${err}`)
      throw err
    }
  }

  async setPushRule(roomId: string, enabled: boolean): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      if (enabled) {
        await client.deletePushRule('global', 'override' as any, roomId)
      } else {
        await client.addPushRule('global', 'override' as any, roomId, {
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

  async getDirectRooms(): Promise<Map<string, string[]>> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    try {
      const accountData = client.getAccountData('m.direct' as any)
      if (accountData) {
        return new Map(Object.entries(accountData.getContent()))
      }
      return new Map()
    } catch (err) {
      error(`[MatrixRoom] 获取直接消息房间失败: ${err}`)
      return new Map()
    }
  }

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
        await client.setAccountData('m.direct' as any, Object.fromEntries(directRooms) as any)
      }
      info(`[MatrixRoom] 设置直接消息房间成功: ${userId} -> ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 设置直接消息房间失败: ${err}`)
      throw err
    }
  }

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
      const currentMembership = currentMember?.events.member?.getContent() || {}

      await client.sendStateEvent(
        roomId,
        'm.room.member' as any,
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

  async getMemberDisplayName(roomId: string, userId: string): Promise<string | null> {
    const room = await this.getRoom(roomId)
    if (!room) {
      return null
    }

    const member = room.getMember(userId)
    return member?.rawDisplayName || member?.name || null
  }

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
        const translatedText = data[0].map((item: any[]) => item[0]).join('')
        info(`[MatrixRoom] 翻译成功`)
        return translatedText
      }
      return text
    } catch (err) {
      error(`[MatrixRoom] 翻译失败: ${err}`)
      return text
    }
  }
}

export const matrixRoomService = new MatrixRoomService()
export default matrixRoomService
