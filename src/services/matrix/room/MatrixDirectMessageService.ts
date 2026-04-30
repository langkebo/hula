import { error, info } from '@tauri-apps/plugin-log'
import type { Room } from 'matrix-js-sdk'
import type {
  CreateDmOptions,
  DirectMessageManager,
  DmPartnerResponse,
  DmRoomInfo,
  IDirectRoomsMap
} from 'matrix-js-sdk/dm'
import matrixClientService from '../MatrixClientService'

export type { CreateDmOptions, DmPartnerResponse, DmRoomInfo, IDirectRoomsMap }

class MatrixDirectMessageService {
  private dmManager: DirectMessageManager | null = null
  private observedClient: ReturnType<typeof matrixClientService.getClient> | null = null
  private dmRoomsCache: Map<string, DmRoomInfo[]> = new Map()

  private getManager(): DirectMessageManager | null {
    const client = matrixClientService.getClient()
    if (!client) {
      return null
    }

    if (this.observedClient !== client || !this.dmManager) {
      const manager =
        typeof client.getDirectMessageManager === 'function'
          ? (client.getDirectMessageManager() as DirectMessageManager)
          : (client.dmManager as DirectMessageManager | null)

      this.observedClient = client
      this.dmManager = manager ?? null
      this.dmRoomsCache.clear()
    }

    return this.dmManager
  }

  private requireManager(): DirectMessageManager {
    const manager = this.getManager()
    if (!manager) {
      throw new Error('DirectMessageManager 未初始化')
    }
    return manager
  }

  async initialize(): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('客户端未初始化')
      }

      this.observedClient = client
      this.dmManager =
        typeof client.getDirectMessageManager === 'function'
          ? (client.getDirectMessageManager() as DirectMessageManager)
          : (client.dmManager as DirectMessageManager)
      if (!this.dmManager) {
        error('[MatrixDM] DirectMessageManager 未在客户端上找到')
        return
      }

      await this.refreshCache()
      info('[MatrixDM] DirectMessageService 初始化完成')
    } catch (err) {
      error(`[MatrixDM] 初始化失败: ${err}`)
      throw err
    }
  }

  private async refreshCache(): Promise<void> {
    this.dmRoomsCache.clear()
    const dmRooms = await this.getDMRooms()
    for (const roomInfo of dmRooms) {
      const partnerId = roomInfo.invitees?.[0] || ''
      if (partnerId) {
        const existing = this.dmRoomsCache.get(partnerId) || []
        existing.push(roomInfo)
        this.dmRoomsCache.set(partnerId, existing)
      }
    }
  }

  async createDm(userId: string, options?: Partial<CreateDmOptions>): Promise<string> {
    const manager = this.requireManager()

    try {
      const opts = options ?? { userIds: [userId] }
      // 确保 userIds 存在
      if (!opts.userIds) {
        opts.userIds = [userId]
      }
      const roomId = await manager.createDm(opts as CreateDmOptions)
      await this.refreshCache()
      info(`[MatrixDM] 创建私聊房间成功: ${roomId} -> ${userId}`)
      return roomId
    } catch (err) {
      error(`[MatrixDM] 创建私聊房间失败: ${err}`)
      throw err
    }
  }

  async createTrustedDm(userId: string): Promise<string> {
    const manager = this.requireManager()

    try {
      const roomId = await manager.createDm({ userIds: [userId], isEncrypted: true })
      await this.refreshCache()
      info(`[MatrixDM] 创建加密私聊房间成功: ${roomId} -> ${userId}`)
      return roomId
    } catch (err) {
      error(`[MatrixDM] 创建加密私聊房间失败: ${err}`)
      throw err
    }
  }

  async getDMRooms(): Promise<DmRoomInfo[]>
  async getDMRooms(throwOnError: boolean): Promise<DmRoomInfo[]>
  async getDMRooms(throwOnError: true): Promise<DmRoomInfo[]>
  async getDMRooms(throwOnError: false): Promise<DmRoomInfo[]>
  async getDMRooms(throwOnError = true): Promise<DmRoomInfo[]> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) {
        return []
      }
      throw new Error('DirectMessageManager 未初始化')
    }
    try {
      return await manager.getDMRooms()
    } catch (err) {
      error(`[MatrixDM] 获取DM房间列表失败: ${err}`)
      if (throwOnError) throw err
      return []
    }
  }

  async getDmForUser(userId: string): Promise<string | null>
  async getDmForUser(userId: string, throwOnError: boolean): Promise<string | null>
  async getDmForUser(userId: string, throwOnError: true): Promise<string | null>
  async getDmForUser(userId: string, throwOnError: false): Promise<string | null>
  async getDmForUser(userId: string, throwOnError = true): Promise<string | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) {
        return null
      }
      throw new Error('DirectMessageManager 未初始化')
    }
    try {
      return manager.getDmForUser(userId) ?? null
    } catch (err) {
      error(`[MatrixDM] 获取用户DM房间失败: ${userId} ${err}`)
      if (throwOnError) throw err
      return null
    }
  }

  async checkRoomIsDm(roomId: string): Promise<boolean> {
    const roomInfo = await this.getDmRoomInfo(roomId)
    return !!roomInfo
  }

  async setDmRoom(roomId: string, userId: string): Promise<void> {
    const manager = this.requireManager()

    try {
      await manager.setDmRoom(roomId, userId)
      await this.refreshCache()
      info(`[MatrixDM] 设置房间为私聊: ${roomId} -> ${userId}`)
    } catch (err) {
      error(`[MatrixDM] 设置房间为私聊失败: ${err}`)
      throw err
    }
  }

  async removeDmRoom(roomId: string, userId: string): Promise<void> {
    const manager = this.requireManager()

    try {
      await manager.removeDmRoom(roomId, userId)
      await this.refreshCache()
      info(`[MatrixDM] 从私聊列表移除房间: ${roomId}`)
    } catch (err) {
      error(`[MatrixDM] 从私聊列表移除房间失败: ${err}`)
      throw err
    }
  }

  async getDmPartner(roomId: string): Promise<string | null> {
    const roomInfo = await this.getDmRoomInfo(roomId)
    return roomInfo?.invitees?.[0] ?? roomInfo?.inviter ?? null
  }

  async getDmRoomInfo(roomId: string): Promise<DmRoomInfo | null>
  async getDmRoomInfo(roomId: string, throwOnError: boolean): Promise<DmRoomInfo | null>
  async getDmRoomInfo(roomId: string, throwOnError: true): Promise<DmRoomInfo | null>
  async getDmRoomInfo(roomId: string, throwOnError: false): Promise<DmRoomInfo | null>
  async getDmRoomInfo(roomId: string, throwOnError = true): Promise<DmRoomInfo | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) {
        return null
      }
      throw new Error('DirectMessageManager 未初始化')
    }
    return manager.getDmRoomInfo(roomId)
  }

  async getDmRoomInfos(): Promise<DmRoomInfo[]>
  async getDmRoomInfos(throwOnError: boolean): Promise<DmRoomInfo[]>
  async getDmRoomInfos(throwOnError: true): Promise<DmRoomInfo[]>
  async getDmRoomInfos(throwOnError: false): Promise<DmRoomInfo[]>
  async getDmRoomInfos(throwOnError = true): Promise<DmRoomInfo[]> {
    return this.getDMRooms(throwOnError)
  }

  /**
   * Get Room objects for specified user IDs
   * @param userIds - Array of user IDs to find DM rooms for
   * @returns Promise resolving to array of Room objects
   */
  async getDmRoomsByUserIds(userIds: string[]): Promise<Room[]>
  async getDmRoomsByUserIds(userIds: string[], throwOnError: boolean): Promise<Room[]>
  async getDmRoomsByUserIds(userIds: string[], throwOnError: true): Promise<Room[]>
  async getDmRoomsByUserIds(userIds: string[], throwOnError: false): Promise<Room[]>
  async getDmRoomsByUserIds(userIds: string[], throwOnError = true): Promise<Room[]> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) {
        return []
      }
      throw new Error('DirectMessageManager 未初始化')
    }
    const client = matrixClientService.getClient()
    if (!client) {
      if (!throwOnError) {
        return []
      }
      throw new Error('客户端未初始化')
    }

    try {
      const userDmMap = await manager.getDirectRoomsByUser()
      const rooms: Room[] = []

      for (const userId of userIds) {
        const roomIds = userDmMap[userId] || []
        for (const roomId of roomIds) {
          const room = client.getRoom(roomId)
          if (room) {
            rooms.push(room)
          }
        }
      }
      return rooms
    } catch (err) {
      error(`[MatrixDM] 批量获取DM房间失败: ${err}`)
      if (throwOnError) throw err
      return []
    }
  }

  async getDirectRoomsFromServer(): Promise<IDirectRoomsMap> {
    try {
      return await this.requireManager().getDirectRoomsFromServer()
    } catch (err) {
      error(`[MatrixDM] 从服务器获取DM房间失败: ${err}`)
      throw err
    }
  }

  async updateDirectRoom(roomId: string, userIds: string[]): Promise<void> {
    try {
      await this.requireManager().updateDirectRoom(roomId, userIds)
      await this.refreshCache()
    } catch (err) {
      error(`[MatrixDM] 更新DM房间失败: ${roomId} ${err}`)
      throw err
    }
  }

  async isDmRoomFromServer(roomId: string, throwOnError = true): Promise<boolean> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) {
        return false
      }
      throw new Error('DirectMessageManager 未初始化')
    }

    return manager.isDmRoomFromServer(roomId, throwOnError)
  }

  async getDmPartnerFromServer(roomId: string, throwOnError = true): Promise<DmPartnerResponse | null> {
    const manager = this.getManager()
    if (!manager) {
      if (!throwOnError) {
        return null
      }
      throw new Error('DirectMessageManager 未初始化')
    }

    return manager.getDmPartnerFromServer(roomId, throwOnError)
  }

  /**
   * Get Room object by room ID
   * @param roomId - The room ID to look up
   * @returns Promise resolving to Room object or null
   */
  async getDmRoom(roomId: string): Promise<Room | null> {
    const client = matrixClientService.getClient()
    return client?.getRoom(roomId) ?? null
  }

  getCachedDmRooms(userId: string): DmRoomInfo[] {
    return this.dmRoomsCache.get(userId) ?? []
  }

  getCachedDmRoomInfoByRoomId(roomId: string): DmRoomInfo | null {
    for (const roomInfos of this.dmRoomsCache.values()) {
      const roomInfo = roomInfos.find((item) => item.roomId === roomId)
      if (roomInfo) {
        return roomInfo
      }
    }

    return null
  }

  getAllCachedDmRooms(): Map<string, DmRoomInfo[]> {
    return new Map(this.dmRoomsCache)
  }

  async getOrCreateDmRoom(userId: string, encrypted = false): Promise<string> {
    try {
      const existingRoomId = await this.getDmForUser(userId)
      if (existingRoomId) {
        info(`[MatrixDM] 使用现有私聊房间: ${existingRoomId}`)
        return existingRoomId
      }

      if (encrypted) {
        return this.createTrustedDm(userId)
      }
      return this.createDm(userId)
    } catch (err) {
      error(`[MatrixDM] 获取或创建DM房间失败: ${userId} ${err}`)
      throw err
    }
  }

  async getDmRoomList(): Promise<DmRoomInfo[]> {
    const roomInfos = await this.getDMRooms()
    return roomInfos.sort((a, b) => {
      const aTime = a.lastMessage?.timestamp ?? 0
      const bTime = b.lastMessage?.timestamp ?? 0
      return bTime - aTime
    })
  }

  async getUnreadDmRooms(): Promise<DmRoomInfo[]> {
    const roomInfos = await this.getDMRooms()
    return roomInfos.filter((room) => (room.unreadCount ?? 0) > 0)
  }

  async getTotalUnreadCount(): Promise<number> {
    const roomInfos = await this.getDMRooms()
    return roomInfos.reduce((sum, room) => sum + (room.unreadCount ?? 0), 0)
  }

  stop(): void {
    this.dmManager = null
    this.observedClient = null
    this.dmRoomsCache.clear()
    info('[MatrixDM] DirectMessageService 已停止')
  }
}

export const matrixDirectMessageService = new MatrixDirectMessageService()
export default matrixDirectMessageService
