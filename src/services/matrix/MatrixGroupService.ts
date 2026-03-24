import { matrixClientService } from './MatrixClientService'
import { info, error as logError } from '@tauri-apps/plugin-log'
import { Room, RoomMember } from 'matrix-js-sdk'

export interface CreateRoomOptions {
  name?: string
  topic?: string
  preset?: 'private_chat' | 'public_chat' | 'trusted_private_chat'
  invite?: string[]
  isDirect?: boolean
  visibility?: 'public' | 'private'
}

export interface RoomPowerLevels {
  ban: number
  kick: number
  redact: number
  invite: number
  [key: string]: number
}

export interface GroupInfo {
  roomId: string
  name: string
  topic: string
  avatarUrl: string | null
  memberCount: number
  isPublic: boolean
  isDirect?: boolean
}

export interface GroupSearchResult {
  roomId: string
  name: string
  topic: string
  avatarUrl: string | null
  memberCount: number
  isPublic: boolean
}

export interface UpdateGroupInfoOptions {
  name?: string
  topic?: string
  avatar?: string
  avatarUrl?: string
  allowScanEnter?: boolean
}

class MatrixGroupService {
  async createRoom(options: CreateRoomOptions): Promise<Room> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const createRoomOptions: any = {
        options: {
          preset: options.preset || 'private_chat',
          name: options.name,
          topic: options.topic,
          visibility: options.visibility === 'public' ? 'public' : 'private',
          invite: options.invite,
          is_direct: options.isDirect
        }
      }

      const room = await client.createRoom(createRoomOptions.options)
      info(`[MatrixGroup] Room created: ${room.room_id}`)
      return room
    } catch (err) {
      logError(`[MatrixGroup] Failed to create room: ${err}`)
      throw err
    }
  }

  async createGroupChat(userIds: string[], name?: string): Promise<Room> {
    return this.createRoom({
      name,
      preset: 'private_chat',
      invite: userIds
    })
  }

  async joinRoom(roomIdOrAlias: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.joinRoom(roomIdOrAlias)
      info(`[MatrixGroup] Joined room: ${roomIdOrAlias}`)
    } catch (err) {
      logError(`[MatrixGroup] Failed to join room: ${err}`)
      throw err
    }
  }

  async leaveRoom(roomId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.leave(roomId)
      info(`[MatrixGroup] Left room: ${roomId}`)
    } catch (err) {
      logError(`[MatrixGroup] Failed to leave room: ${err}`)
      throw err
    }
  }

  async inviteToRoom(roomId: string, userId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.invite(roomId, userId)
      info(`[MatrixGroup] Invited ${userId} to room ${roomId}`)
    } catch (err) {
      logError(`[MatrixGroup] Failed to invite to room: ${err}`)
      throw err
    }
  }

  async removeFromRoom(roomId: string, userId: string, reason?: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.kick(roomId, userId, reason)
      info(`[MatrixGroup] Removed ${userId} from room ${roomId}`)
    } catch (err) {
      logError(`[MatrixGroup] Failed to remove from room: ${err}`)
      throw err
    }
  }

  async updateRoomName(roomId: string, name: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.setRoomName(roomId, name)
      info(`[MatrixGroup] Updated room name for ${roomId}: ${name}`)
    } catch (err) {
      logError(`[MatrixGroup] Failed to update room name: ${err}`)
      throw err
    }
  }

  async updateRoomTopic(roomId: string, topic: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.setRoomTopic(roomId, topic)
      info(`[MatrixGroup] Updated room topic for ${roomId}: ${topic}`)
    } catch (err) {
      logError(`[MatrixGroup] Failed to update room topic: ${err}`)
      throw err
    }
  }

  async updateRoomAvatar(roomId: string, avatarUrl: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.setRoomAvatar(roomId, avatarUrl)
      info(`[MatrixGroup] Updated room avatar for ${roomId}`)
    } catch (err) {
      logError(`[MatrixGroup] Failed to update room avatar: ${err}`)
      throw err
    }
  }

  async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const room = client.getRoom(roomId)
      if (!room) {
        return []
      }

      return room.getMembers()
    } catch (err) {
      logError(`[MatrixGroup] Failed to get room members: ${err}`)
      throw err
    }
  }

  async getAllRooms(): Promise<Room[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      return client.getRooms()
    } catch (err) {
      logError(`[MatrixGroup] Failed to get all rooms: ${err}`)
      throw err
    }
  }

  async getJoinedRooms(): Promise<Room[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      return client.getRooms().filter((room) => room.getMyMembership?.() === 'join')
    } catch (err) {
      logError(`[MatrixGroup] Failed to get joined rooms: ${err}`)
      throw err
    }
  }

  async getRoom(roomId: string): Promise<Room | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      return client.getRoom(roomId)
    } catch (err) {
      logError(`[MatrixGroup] Failed to get room: ${err}`)
      throw err
    }
  }

  async setRoomPowerLevels(roomId: string, powerLevels: RoomPowerLevels): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error('Room not found')
      }

      const content = {
        ...room.currentState.getStateEvents('m.room.power_levels')[0]?.getContent(),
        ...powerLevels
      }

      await client.sendStateEvent(roomId, 'm.room.power_levels', content, '')
      info(`[MatrixGroup] Updated power levels for room ${roomId}`)
    } catch (err) {
      logError(`[MatrixGroup] Failed to set power levels: ${err}`)
      throw err
    }
  }

  async getRoomPowerLevels(roomId: string): Promise<RoomPowerLevels | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const room = client.getRoom(roomId)
      if (!room) {
        return null
      }

      const powerLevelsEvent = room.currentState.getStateEvents('m.room.power_levels')[0]
      return (powerLevelsEvent?.getContent() as RoomPowerLevels) || null
    } catch (err) {
      logError(`[MatrixGroup] Failed to get power levels: ${err}`)
      throw err
    }
  }

  async getRoomVisibility(roomId: string): Promise<'public' | 'private'> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const room = client.getRoom(roomId)
      if (!room) {
        return 'private'
      }

      const joinRule = room.currentState.getStateEvents('m.room.join_rules')[0]
      return joinRule ? ((joinRule.getContent() as any).join_rule === 'public' ? 'public' : 'private') : 'private'
    } catch (err) {
      logError(`[MatrixGroup] Failed to get room visibility: ${err}`)
      return 'private'
    }
  }

  async setRoomGuestAccess(roomId: string, allow: boolean): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.sendStateEvent(
        roomId,
        'm.room.guest_access',
        {
          guest_access: allow ? 'can_join' : 'forbidden'
        },
        ''
      )
      info(`[MatrixGroup] Set guest access for room ${roomId}: ${allow}`)
    } catch (err) {
      logError(`[MatrixGroup] Failed to set guest access: ${err}`)
      throw err
    }
  }

  async getGroupList(): Promise<Room[]> {
    return this.getAllRooms()
  }

  async createGroup(options: CreateRoomOptions): Promise<Room> {
    return this.createRoom(options)
  }

  async inviteGroupMember(roomId: string, userId: string): Promise<void> {
    return this.inviteToRoom(roomId, userId)
  }

  async applyGroup(roomIdOrAlias: string): Promise<void> {
    return this.joinRoom(roomIdOrAlias)
  }

  async removeGroupMember(roomId: string, userId: string, reason?: string): Promise<void> {
    return this.removeFromRoom(roomId, userId, reason)
  }

  async getGroupInfo(roomId: string): Promise<GroupInfo | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const room = client.getRoom(roomId)
      if (!room) {
        return null
      }

      const name = room.name || ''
      const topicEvent = room.currentState.getStateEvents('m.room.topic')[0]
      const topic = topicEvent ? (topicEvent.getContent() as any).topic || '' : ''
      const avatarEvent = room.currentState.getStateEvents('m.room.avatar')[0]
      const avatarUrl = avatarEvent ? (avatarEvent.getContent() as any).url || null : null
      const memberCount = room.getJoinedMemberCount() || 0
      const isPublic = (await this.getRoomVisibility(roomId)) === 'public'
      const isDirect = room.isDirect()

      return {
        roomId,
        name,
        topic,
        avatarUrl,
        memberCount,
        isPublic,
        isDirect
      }
    } catch (err) {
      logError(`[MatrixGroup] Failed to get group info: ${err}`)
      throw err
    }
  }

  async updateGroupInfo(roomId: string, options: UpdateGroupInfoOptions): Promise<void> {
    try {
      if (options.name) {
        await this.updateRoomName(roomId, options.name)
      }
      if (options.topic) {
        await this.updateRoomTopic(roomId, options.topic)
      }
      if (options.avatarUrl || options.avatar) {
        await this.updateRoomAvatar(roomId, options.avatarUrl || options.avatar!)
      }
      if (options.allowScanEnter !== undefined) {
        const client = matrixClientService.getClient()
        if (client) {
          await client.setRoomAccountData(roomId, 'm.room.allowed_sender_domains' as any, {
            allow_scan_enter: options.allowScanEnter
          })
        }
      }
      info(`[MatrixGroup] Updated group info for ${roomId}`)
    } catch (err) {
      logError(`[MatrixGroup] Failed to update group info: ${err}`)
      throw err
    }
  }

  async searchGroup(query: string, limit: number = 10): Promise<GroupSearchResult[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const result = await client.publicRooms({
        term: query,
        limit,
        filter: {
          generic_search_term: query
        }
      })

      return (result.chunk || []).map((room: any) => ({
        roomId: room.room_id,
        name: room.name || '',
        topic: room.topic || '',
        avatarUrl: room.avatar_url || null,
        memberCount: room.num_joined_members || 0,
        isPublic: room.world_readable || false
      }))
    } catch (err) {
      logError(`[MatrixGroup] Failed to search groups: ${err}`)
      throw err
    }
  }

  async exitGroup(roomId: string): Promise<void> {
    return this.leaveRoom(roomId)
  }
}

export const matrixGroupService = new MatrixGroupService()
