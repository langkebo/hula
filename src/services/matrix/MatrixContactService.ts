import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'
import { User, RoomMember, MatrixEvent } from 'matrix-js-sdk'
import { getGlobalCache } from '@/composables/useCache'

export interface UserProfile {
  userId: string
  displayName?: string
  avatarUrl?: string
}

export interface UserItem {
  uid: string
  name: string
  avatar: string
  activeStatus: number
  lastOptTime: number
}

export interface DirectChatResult {
  roomId: string
}

class MatrixContactService extends BaseManager {
  private profileCache = getGlobalCache<UserProfile>('contact-profile', { maxSize: 200, ttl: 60_000 })

  async searchFriend(query: string, limit = 10, throwOnError = true): Promise<UserProfile[]> {
    return this.searchUsers(query, limit, throwOnError)
  }

  async searchUsers(query: string, limit = 10, throwOnError = true): Promise<UserProfile[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const response = await client.searchUserDirectory({
        term: query,
        limit
      })

      return response.results.map((user: User) => ({
        userId: user.userId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl
      }))
    } catch (err) {
      return this.handleError(err, 'searchUsers', [] as UserProfile[], throwOnError)
    }
  }

  async getUserProfile(userId: string, throwOnError = true): Promise<UserProfile | null> {
    const cached = this.profileCache.get(userId)
    if (cached) return cached

    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const profile = await client.getUserProfile(userId)
      const result: UserProfile = {
        userId,
        displayName: profile.displayname,
        avatarUrl: profile.avatar_url
      }
      this.profileCache.set(userId, result)
      return result
    } catch (err) {
      return this.handleError(err, 'getUserProfile', null as UserProfile | null, throwOnError)
    }
  }

  async getOrCreateDirectChat(userId: string, throwOnError = true): Promise<DirectChatResult> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const room = await client.createDirectRoom(userId)
      info(`[MatrixContact] Direct chat created/accessed: ${room.room_id}`)
      return { roomId: room.room_id }
    } catch (err) {
      return this.handleError(err, 'getOrCreateDirectChat', { roomId: '' } as DirectChatResult, throwOnError)
    }
  }

  async getDMRooms(throwOnError = true): Promise<string[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const rooms = client.getRooms()
      return rooms.filter((room) => room.isDirect()).map((room) => room.roomId)
    } catch (err) {
      return this.handleError(err, 'getDMRooms', [] as string[], throwOnError)
    }
  }

  async getJoinedUsers(throwOnError = true): Promise<User[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const users = client.getUsers()
      const myUserId = client.getUserId()

      return users.filter((user: any) => user.userId !== myUserId)
    } catch (err) {
      return this.handleError(err, 'getJoinedUsers', [] as User[], throwOnError)
    }
  }

  async inviteUser(roomId: string, userId: string, throwOnError = false): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.invite(roomId, userId)
      info(`[MatrixContact] Invited user ${userId} to room ${roomId}`)
    } catch (err) {
      this.handleError(err, 'inviteUser', undefined as void, throwOnError)
    }
  }

  async kickUser(roomId: string, userId: string, reason?: string, throwOnError = false): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.kick(roomId, userId, reason)
      info(`[MatrixContact] Kicked user ${userId} from room ${roomId}`)
    } catch (err) {
      this.handleError(err, 'kickUser', undefined as void, throwOnError)
    }
  }

  async banUser(roomId: string, userId: string, reason?: string, throwOnError = false): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.ban(roomId, userId, reason)
      info(`[MatrixContact] Banned user ${userId} from room ${roomId}`)
    } catch (err) {
      this.handleError(err, 'banUser', undefined as void, throwOnError)
    }
  }

  async unbanUser(roomId: string, userId: string, throwOnError = true): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.unban(roomId, userId)
      info(`[MatrixContact] Unbanned user ${userId} from room ${roomId}`)
    } catch (err) {
      this.handleError(err, 'unbanUser', undefined as void, throwOnError)
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

  async setUserAlias(roomId: string, alias: string, throwOnError = false): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.setRoomAlias(roomId, alias)
      info(`[MatrixContact] Set alias ${alias} for room ${roomId}`)
    } catch (err) {
      this.handleError(err, 'setUserAlias', undefined as void, throwOnError)
    }
  }

  async getRoomState(roomId: string, eventType: string, throwOnError = true): Promise<MatrixEvent[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const room = client.getRoom(roomId)
      if (!room) {
        return []
      }

      return room.currentState.getStateEvents(eventType)
    } catch (err) {
      return this.handleError(err, 'getRoomState', [] as MatrixEvent[], throwOnError)
    }
  }

  async getUserByIds(uidList: string[], throwOnError = true): Promise<UserItem[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const users: UserItem[] = []
      for (const uid of uidList) {
        const user = client.getUser(uid)
        if (user) {
          users.push({
            uid: user.userId || uid,
            name: user.displayName || '',
            avatar: user.avatarUrl || '',
            activeStatus: 0,
            lastOptTime: 0
          })
        }
      }
      return users
    } catch (err) {
      return this.handleError(err, 'getUserByIds', [] as UserItem[], throwOnError)
    }
  }

  async addFriend(userId: string, throwOnError = false): Promise<DirectChatResult> {
    return this.getOrCreateDirectChat(userId, throwOnError)
  }

  async sendAddFriendRequest(userId: string, reason?: string, throwOnError = false): Promise<DirectChatResult> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const result = await this.getOrCreateDirectChat(userId, throwOnError)
      const room = client.getRoom(result.roomId)
      if (room) {
        const myUserId = client.getUserId()
        const myDisplayName = myUserId ? client.getUser(myUserId)?.displayName : 'User'
        const content = reason || `Friend request from ${myDisplayName}`
        const txnId = `m${Date.now()}`
        await client.sendTextMessage(result.roomId, content, txnId)
      }
      return result
    } catch (err) {
      return this.handleError(err, 'sendAddFriendRequest', { roomId: '' } as DirectChatResult, throwOnError)
    }
  }
}

export const matrixContactService = new MatrixContactService()
