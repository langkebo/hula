import type {
  RoomJoinRuleContent,
  RoomTopicContent,
  RoomAvatarContent,
  ExtendedRoomMemberForGroup
} from '@/types/matrix-api'
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'
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

class MatrixGroupService extends BaseManager {
  async createRoom(options: CreateRoomOptions, throwOnError = false): Promise<Room> {
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
      return this.handleError(err, 'createRoom', null as unknown as Room, throwOnError)
    }
  }

  async createGroupChat(userIds: string[], name?: string, throwOnError = false): Promise<Room> {
    return this.createRoom(
      {
        name,
        preset: 'private_chat',
        invite: userIds
      },
      throwOnError
    )
  }

  async joinRoom(roomIdOrAlias: string, throwOnError = false): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.joinRoom(roomIdOrAlias)
      info(`[MatrixGroup] Joined room: ${roomIdOrAlias}`)
    } catch (err) {
      this.handleError(err, 'joinRoom', undefined as void, throwOnError)
    }
  }

  async leaveRoom(roomId: string, throwOnError = false): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.leave(roomId)
      info(`[MatrixGroup] Left room: ${roomId}`)
    } catch (err) {
      this.handleError(err, 'leaveRoom', undefined as void, throwOnError)
    }
  }

  async inviteToRoom(roomId: string, userId: string, throwOnError = false): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.invite(roomId, userId)
      info(`[MatrixGroup] Invited ${userId} to room ${roomId}`)
    } catch (err) {
      this.handleError(err, 'inviteToRoom', undefined as void, throwOnError)
    }
  }

  async removeFromRoom(roomId: string, userId: string, reason?: string, throwOnError = false): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.kick(roomId, userId, reason)
      info(`[MatrixGroup] Removed ${userId} from room ${roomId}`)
    } catch (err) {
      this.handleError(err, 'removeFromRoom', undefined as void, throwOnError)
    }
  }

  async updateRoomName(roomId: string, name: string, throwOnError = false): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.setRoomName(roomId, name)
      info(`[MatrixGroup] Updated room name for ${roomId}: ${name}`)
    } catch (err) {
      this.handleError(err, 'updateRoomName', undefined as void, throwOnError)
    }
  }

  async updateRoomTopic(roomId: string, topic: string, throwOnError = false): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.setRoomTopic(roomId, topic)
      info(`[MatrixGroup] Updated room topic for ${roomId}: ${topic}`)
    } catch (err) {
      this.handleError(err, 'updateRoomTopic', undefined as void, throwOnError)
    }
  }

  async updateRoomAvatar(roomId: string, avatarUrl: string, throwOnError = false): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.setRoomAvatar(roomId, avatarUrl)
      info(`[MatrixGroup] Updated room avatar for ${roomId}`)
    } catch (err) {
      this.handleError(err, 'updateRoomAvatar', undefined as void, throwOnError)
    }
  }

  async getRoomMembers(roomId: string, throwOnError = true): Promise<RoomMember[]> {
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
      return this.handleError(err, 'getRoomMembers', [] as RoomMember[], throwOnError)
    }
  }

  async getAllRooms(throwOnError = true): Promise<Room[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      return client.getRooms()
    } catch (err) {
      return this.handleError(err, 'getAllRooms', [] as Room[], throwOnError)
    }
  }

  async getJoinedRooms(throwOnError = true): Promise<Room[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      return client.getRooms().filter((room) => room.getMyMembership?.() === 'join')
    } catch (err) {
      return this.handleError(err, 'getJoinedRooms', [] as Room[], throwOnError)
    }
  }

  async getRoom(roomId: string, throwOnError = true): Promise<Room | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      return client.getRoom(roomId)
    } catch (err) {
      return this.handleError(err, 'getRoom', null as Room | null, throwOnError)
    }
  }

  async setRoomPowerLevels(roomId: string, powerLevels: RoomPowerLevels, throwOnError = false): Promise<void> {
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
      this.handleError(err, 'setRoomPowerLevels', undefined as void, throwOnError)
    }
  }

  async getRoomPowerLevels(roomId: string, throwOnError = true): Promise<RoomPowerLevels | null> {
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
      return this.handleError(err, 'getRoomPowerLevels', null as RoomPowerLevels | null, throwOnError)
    }
  }

  async getRoomVisibility(roomId: string, throwOnError = true): Promise<'public' | 'private'> {
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
      if (!joinRule) {
        return 'private'
      }

      const content = joinRule.getContent() as RoomJoinRuleContent
      return content.join_rule === 'public' ? 'public' : 'private'
    } catch (err) {
      return this.handleError(err, 'getRoomVisibility', 'private' as 'public' | 'private', throwOnError)
    }
  }

  async setRoomGuestAccess(roomId: string, allow: boolean, throwOnError = false): Promise<void> {
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
      this.handleError(err, 'setRoomGuestAccess', undefined as void, throwOnError)
    }
  }

  async getGroupList(throwOnError = true): Promise<Room[]> {
    return this.getAllRooms(throwOnError)
  }

  async createGroup(options: CreateRoomOptions, throwOnError = false): Promise<Room> {
    return this.createRoom(options, throwOnError)
  }

  async inviteGroupMember(roomId: string, userId: string, throwOnError = false): Promise<void> {
    return this.inviteToRoom(roomId, userId, throwOnError)
  }

  async applyGroup(roomIdOrAlias: string, throwOnError = false): Promise<void> {
    return this.joinRoom(roomIdOrAlias, throwOnError)
  }

  async removeGroupMember(roomId: string, userId: string, reason?: string, throwOnError = false): Promise<void> {
    return this.removeFromRoom(roomId, userId, reason, throwOnError)
  }

  async getGroupInfo(roomId: string, throwOnError = true): Promise<GroupInfo | null> {
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
      const topicContent = topicEvent?.getContent() as RoomTopicContent | undefined
      const topic = topicContent?.topic || ''
      const avatarEvent = room.currentState.getStateEvents('m.room.avatar')[0]
      const avatarContent = avatarEvent?.getContent() as RoomAvatarContent | undefined
      const avatarUrl = avatarContent?.url || null
      const memberCount = room.getJoinedMemberCount() || 0
      const isPublic = (await this.getRoomVisibility(roomId, throwOnError)) === 'public'
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
      return this.handleError(err, 'getGroupInfo', null as GroupInfo | null, throwOnError)
    }
  }

  async updateGroupInfo(roomId: string, options: UpdateGroupInfoOptions, throwOnError = false): Promise<void> {
    try {
      if (options.name) {
        await this.updateRoomName(roomId, options.name, throwOnError)
      }
      if (options.topic) {
        await this.updateRoomTopic(roomId, options.topic, throwOnError)
      }
      if (options.avatarUrl || options.avatar) {
        await this.updateRoomAvatar(roomId, options.avatarUrl || options.avatar!, throwOnError)
      }
      if (options.allowScanEnter !== undefined) {
        const client = matrixClientService.getClient()
        if (client) {
          await client.setRoomAccountData(roomId, 'm.room.allowed_sender_domains', {
            allow_scan_enter: options.allowScanEnter
          })
        }
      }
      info(`[MatrixGroup] Updated group info for ${roomId}`)
    } catch (err) {
      this.handleError(err, 'updateGroupInfo', undefined as void, throwOnError)
    }
  }

  async searchGroup(query: string, limit: number = 10, throwOnError = true): Promise<GroupSearchResult[]> {
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
      return this.handleError(err, 'searchGroup', [] as GroupSearchResult[], throwOnError)
    }
  }

  async exitGroup(roomId: string, throwOnError = false): Promise<void> {
    return this.leaveRoom(roomId, throwOnError)
  }

  async leaveGroup(roomId: string, throwOnError = false): Promise<void> {
    return this.leaveRoom(roomId, throwOnError)
  }

  async dissolveGroup(roomId: string, throwOnError = false): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error('Room not found')
      }

      const userId = client.getUserId()
      const powerLevels = await this.getRoomPowerLevels(roomId, throwOnError)
      if (!powerLevels || powerLevels[userId || ''] !== 100) {
        throw new Error('Only room creator can dissolve the group')
      }

      await client.sendStateEvent(roomId, 'm.room.power_levels', { users: {} }, '')
      await client.leave(roomId)
    } catch (err) {
      this.handleError(err, 'dissolveGroup', undefined as void, throwOnError)
    }
  }

  async updateGroupName(roomId: string, name: string, throwOnError = false): Promise<void> {
    return this.updateRoomName(roomId, name, throwOnError)
  }

  async updateMyGroupName(roomId: string, displayName: string, throwOnError = false): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      const userId = client.getUserId()
      if (!userId) {
        throw new Error('User not logged in')
      }

      const room = client.getRoom(roomId)
      if (!room) {
        throw new Error('Room not found')
      }

      const currentMember = room.getMember(userId)
      const extendedMember = currentMember as unknown as ExtendedRoomMemberForGroup
      const currentMembership = extendedMember?.events?.member?.getContent() || {}

      await client.sendStateEvent(
        roomId,
        'm.room.member',
        {
          ...currentMembership,
          displayname: displayName,
          membership: 'join'
        },
        userId
      )
      info(`[MatrixGroup] Updated my group name for ${roomId}: ${displayName}`)
    } catch (err) {
      this.handleError(err, 'updateMyGroupName', undefined as void, throwOnError)
    }
  }
}

export const matrixGroupService = new MatrixGroupService()
