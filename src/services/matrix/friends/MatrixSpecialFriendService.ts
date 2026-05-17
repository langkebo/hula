import { error, info } from '@tauri-apps/plugin-log'
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'

const SPECIAL_FRIENDS_EVENT_TYPE = 'm.special_friends' as const

interface SpecialFriendsContent {
  special_friends?: string[]
}

class MatrixSpecialFriendService extends BaseMatrixService {
  private listeners: Set<() => void> = new Set()
  private cache: Set<string> | null = null
  private observedClient: MatrixClient | null = null
  private hasWarnedBeforeClientReady = false

  constructor() {
    super()
    this.ensureSyncListener()
  }

  private readonly accountDataListener = (event: MatrixEvent): void => {
    if (event.getType() === SPECIAL_FRIENDS_EVENT_TYPE) {
      this.cache = null
      this.notifyListeners()
    }
  }

  private ensureSyncListener(): void {
    const client = matrixClientService.getClient()
    if (this.observedClient === client) {
      return
    }

    if (this.observedClient) {
      this.observedClient.off('accountData', this.accountDataListener)
    }

    this.cache = null
    this.observedClient = client
    if (!client) {
      return
    }

    this.hasWarnedBeforeClientReady = false
    client.on('accountData', this.accountDataListener)
  }

  protected getClient(): MatrixClient {
    this.ensureSyncListener()
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(this.t('matrix_error.common.client_not_initialized'))
    }
    return client
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener())
  }

  private readSpecialFriendsContent(event: MatrixEvent | null | undefined): string[] {
    if (!event) {
      return []
    }

    const content = event.getContent() as SpecialFriendsContent
    if (!Array.isArray(content.special_friends)) {
      return []
    }

    return content.special_friends.filter((userId): userId is string => typeof userId === 'string')
  }

  async getSpecialFriends(): Promise<string[]> {
    try {
      const client = this.getClient()
      if (this.cache) {
        return [...this.cache]
      }

      const accountDataEvent = client.getAccountData(SPECIAL_FRIENDS_EVENT_TYPE)
      const specialFriends = this.readSpecialFriendsContent(accountDataEvent)
      this.cache = new Set(specialFriends)

      return specialFriends
    } catch (err) {
      if (err instanceof Error && err.message === '客户端未初始化') {
        if (!this.hasWarnedBeforeClientReady) {
          this.hasWarnedBeforeClientReady = true
          info('[SpecialFriend] Matrix 客户端未就绪，返回空特别关注列表')
        }
        return []
      }

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
      } satisfies SpecialFriendsContent)

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
      } satisfies SpecialFriendsContent)

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
    this.hasWarnedBeforeClientReady = false
  }
}

export const matrixSpecialFriendService = new MatrixSpecialFriendService()
export default matrixSpecialFriendService
