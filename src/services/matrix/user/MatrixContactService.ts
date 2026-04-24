import { matrixClientService } from '../MatrixClientService'
import { matrixDirectMessageService } from '../MatrixDirectMessageService'
import { matrixFriendService } from '../friends/MatrixFriendService'
import { matrixRoomService } from '../MatrixRoomService'
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
  private toUserItem(user: Partial<User> & { userId?: string }, fallbackUserId: string): UserItem {
    return {
      uid: user.userId || fallbackUserId,
      name: user.displayName || '',
      avatar: user.avatarUrl || '',
      activeStatus: 0,
      lastOptTime: 0
    }
  }

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

      return response.results.map((user: { user_id: string; display_name?: string; avatar_url?: string }) => ({
        userId: user.user_id,
        displayName: user.display_name ?? undefined,
        avatarUrl: user.avatar_url ?? undefined
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
      const roomId = await matrixDirectMessageService.getOrCreateDmRoom(userId)
      info(`[MatrixContact] Direct chat created/accessed: ${roomId}`)
      return { roomId }
    } catch (err) {
      logError(`[MatrixContact] Failed to create direct chat: ${err}`)
      throw err
    }
  }

  async getDMRooms(): Promise<string[]> {
    try {
      const rooms = await matrixDirectMessageService.getDMRooms(false)
      return rooms.map((room) => room.roomId)
    } catch (err) {
      logError(`[MatrixContact] Failed to get DM rooms: ${err}`)
      throw err
    }
  }

  async inviteUser(roomId: string, userId: string): Promise<void> {
    try {
      await matrixRoomService.inviteUser(roomId, userId)
      info(`[MatrixContact] Invited user ${userId} to room ${roomId}`)
    } catch (err) {
      logError(`[MatrixContact] Failed to invite user: ${err}`)
      throw err
    }
  }

  async kickUser(roomId: string, userId: string, reason?: string): Promise<void> {
    try {
      await matrixRoomService.kickUser(roomId, userId, reason)
      info(`[MatrixContact] Kicked user ${userId} from room ${roomId}`)
    } catch (err) {
      logError(`[MatrixContact] Failed to kick user: ${err}`)
      throw err
    }
  }

  async banUser(roomId: string, userId: string, reason?: string): Promise<void> {
    try {
      await matrixRoomService.banUser(roomId, userId, reason)
      info(`[MatrixContact] Banned user ${userId} from room ${roomId}`)
    } catch (err) {
      logError(`[MatrixContact] Failed to ban user: ${err}`)
      throw err
    }
  }

  async unbanUser(roomId: string, userId: string): Promise<void> {
    try {
      await matrixRoomService.unbanUser(roomId, userId)
      info(`[MatrixContact] Unbanned user ${userId} from room ${roomId}`)
    } catch (err) {
      logError(`[MatrixContact] Failed to unban user: ${err}`)
      throw err
    }
  }

  async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    try {
      return await matrixRoomService.getMembers(roomId)
    } catch (err) {
      logError(`[MatrixContact] Failed to get room members: ${err}`)
      throw err
    }
  }

  async getRoomState(roomId: string, eventType: string): Promise<MatrixEvent[]> {
    try {
      const stateEvents = await matrixRoomService.getRoomState(roomId)
      if (eventType === '*') {
        return stateEvents as MatrixEvent[]
      }

      return (stateEvents as MatrixEvent[]).filter((event) => event.getType?.() === eventType)
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
          users.push(this.toUserItem(user, uid))
          continue
        }

        const profile = await this.getUserProfile(uid)
        if (profile) {
          users.push(
            this.toUserItem(
              {
                userId: profile.userId,
                displayName: profile.displayName,
                avatarUrl: profile.avatarUrl
              },
              uid
            )
          )
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
      await matrixFriendService.sendFriendRequest(userId, reason)
      const roomId = (await matrixDirectMessageService.getDmForUser(userId, false)) ?? ''
      return { roomId }
    } catch (err) {
      logError(`[MatrixContact] Failed to send friend request: ${err}`)
      throw err
    }
  }
}

export const matrixContactService = new MatrixContactService()
