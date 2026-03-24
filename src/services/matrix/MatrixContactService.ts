import { matrixClientService } from './MatrixClientService'
import { info, error as logError } from '@tauri-apps/plugin-log'
import { User, RoomMember, MatrixEvent } from 'matrix-js-sdk'

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

class MatrixContactService {
  async searchFriend(query: string, limit = 10): Promise<UserProfile[]> {
    return this.searchUsers(query, limit)
  }

  async searchUsers(query: string, limit = 10): Promise<UserProfile[]> {
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
      logError(`[MatrixContact] Failed to search users: ${err}`)
      throw err
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const profile = await client.getUserProfile(userId)
      return {
        userId,
        displayName: profile.displayname,
        avatarUrl: profile.avatar_url
      }
    } catch (err) {
      logError(`[MatrixContact] Failed to get user profile: ${err}`)
      return null
    }
  }

  async getOrCreateDirectChat(userId: string): Promise<DirectChatResult> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const room = await client.createDirectRoom(userId)
      info(`[MatrixContact] Direct chat created/accessed: ${room.room_id}`)
      return { roomId: room.room_id }
    } catch (err) {
      logError(`[MatrixContact] Failed to create direct chat: ${err}`)
      throw err
    }
  }

  async getDMRooms(): Promise<string[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const rooms = client.getRooms()
      return rooms.filter((room) => room.isDirect()).map((room) => room.roomId)
    } catch (err) {
      logError(`[MatrixContact] Failed to get DM rooms: ${err}`)
      throw err
    }
  }

  async getJoinedUsers(): Promise<User[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const users = client.getUsers()
      const myUserId = client.getUserId()

      return users.filter((user: any) => user.userId !== myUserId)
    } catch (err) {
      logError(`[MatrixContact] Failed to get joined users: ${err}`)
      throw err
    }
  }

  async inviteUser(roomId: string, userId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.invite(roomId, userId)
      info(`[MatrixContact] Invited user ${userId} to room ${roomId}`)
    } catch (err) {
      logError(`[MatrixContact] Failed to invite user: ${err}`)
      throw err
    }
  }

  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.kick(roomId, userId, reason)
      info(`[MatrixContact] Kicked user ${userId} from room ${roomId}`)
    } catch (err) {
      logError(`[MatrixContact] Failed to kick user: ${err}`)
      throw err
    }
  }

  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.ban(roomId, userId, reason)
      info(`[MatrixContact] Banned user ${userId} from room ${roomId}`)
    } catch (err) {
      logError(`[MatrixContact] Failed to ban user: ${err}`)
      throw err
    }
  }

  async unbanUser(roomId: string, userId: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.unban(roomId, userId)
      info(`[MatrixContact] Unbanned user ${userId} from room ${roomId}`)
    } catch (err) {
      logError(`[MatrixContact] Failed to unban user: ${err}`)
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
      logError(`[MatrixContact] Failed to get room members: ${err}`)
      throw err
    }
  }

  async setUserAlias(roomId: string, alias: string): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      await client.setRoomAlias(roomId, alias)
      info(`[MatrixContact] Set alias ${alias} for room ${roomId}`)
    } catch (err) {
      logError(`[MatrixContact] Failed to set room alias: ${err}`)
      throw err
    }
  }

  async getRoomState(roomId: string, eventType: string): Promise<MatrixEvent[]> {
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
      logError(`[MatrixContact] Failed to get room state: ${err}`)
      throw err
    }
  }

  async getUserByIds(uidList: string[]): Promise<UserItem[]> {
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
      logError(`[MatrixContact] Failed to get users by ids: ${err}`)
      throw err
    }
  }

  async addFriend(userId: string): Promise<DirectChatResult> {
    return this.getOrCreateDirectChat(userId)
  }

  async sendAddFriendRequest(userId: string, reason?: string): Promise<DirectChatResult> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('Matrix client not initialized')
      }

      const result = await this.getOrCreateDirectChat(userId)
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
      logError(`[MatrixContact] Failed to send friend request: ${err}`)
      throw err
    }
  }
}

export const matrixContactService = new MatrixContactService()
