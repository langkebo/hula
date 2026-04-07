import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

const SPECIAL_FRIENDS_EVENT_TYPE = 'm.special_friends' as const

interface SpecialFriendsContent {
  special_friends?: string[]
}

class MatrixSpecialFriendService {
  private listeners: Set<() => void> = new Set()

  constructor() {
    this.setupSyncListener()
  }

  private setupSyncListener(): void {
    const client = matrixClientService.getClient()
    if (client) {
      client.on('accountData', (event: MatrixEvent) => {
        if (event.getType() === SPECIAL_FRIENDS_EVENT_TYPE) {
          this.cache = null
          this.notifyListeners()
        }
      })
    }
  }

  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener())
  }

  async getSpecialFriends(): Promise<string[]> {
    try {
      const client = this.getClient()
      const content = client.getAccountData(SPECIAL_FRIENDS_EVENT_TYPE) as SpecialFriendsContent | undefined

      if (content && content.special_friends) {
        return content.special_friends
      }
      return []
    } catch (err) {
      error(`[SpecialFriend] 获取特别关注好友失败: ${err}`)
      return []
    }
  }

  async addSpecialFriend(userId: string): Promise<void> {
    try {
      const client = this.getClient()
      const currentList = await this.getSpecialFriends()

      if (currentList.includes(userId)) {
        info(`[SpecialFriend] 用户已是特别关注: ${userId}`)
        return
      }

      const newList = [...currentList, userId]
      await client.setAccountData(SPECIAL_FRIENDS_EVENT_TYPE, {
        special_friends: newList
      } as SpecialFriendsContent)

      this.cache = new Set(newList)
      info(`[SpecialFriend] 添加特别关注好友成功: ${userId}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '添加特别关注好友失败'
      error(`[SpecialFriend] ${errorMessage}`)
      throw new Error(errorMessage)
    }
  }

  async removeSpecialFriend(userId: string): Promise<void> {
    try {
      const client = this.getClient()
      const currentList = await this.getSpecialFriends()

      if (!currentList.includes(userId)) {
        info(`[SpecialFriend] 用户不在特别关注列表中: ${userId}`)
        return
      }

      const newList = currentList.filter((id) => id !== userId)
      await client.setAccountData(SPECIAL_FRIENDS_EVENT_TYPE, {
        special_friends: newList
      } as SpecialFriendsContent)

      this.cache = new Set(newList)
      info(`[SpecialFriend] 移除特别关注好友成功: ${userId}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '移除特别关注好友失败'
      error(`[SpecialFriend] ${errorMessage}`)
      throw new Error(errorMessage)
    }
  }

  async isSpecialFriend(userId: string): Promise<boolean> {
    const list = await this.getSpecialFriends()
    return list.includes(userId)
  }

  async toggleSpecialFriend(userId: string): Promise<boolean> {
    const isSpecial = await this.isSpecialFriend(userId)
    if (isSpecial) {
      await this.removeSpecialFriend(userId)
      return false
    } else {
      await this.addSpecialFriend(userId)
      return true
    }
  }

  async getSpecialFriendStatus(userIds: string[]): Promise<Map<string, boolean>> {
    const specialFriends = await this.getSpecialFriends()
    const result = new Map<string, boolean>()

    for (const userId of userIds) {
      result.set(userId, specialFriends.includes(userId))
    }

    return result
  }

  onSpecialFriendsChange(callback: () => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  clearCache(): void {
    this.cache = null
  }
}

export const matrixSpecialFriendService = new MatrixSpecialFriendService()
export default matrixSpecialFriendService
