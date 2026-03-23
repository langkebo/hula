import type { Room } from 'matrix-js-sdk'
import { DirectMessageManager, type CreateDmOptions, type DmRoomInfo, type IDirectRoomsMap } from 'matrix-js-sdk/dm'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export type { CreateDmOptions, DmRoomInfo, IDirectRoomsMap }

class MatrixDirectMessageService {
  private dmManager: DirectMessageManager | null = null
  private dmRoomsCache: Map<string, DmRoomInfo[]> = new Map()

  async initialize(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    this.dmManager = (client as any).dmManager as DirectMessageManager
    if (!this.dmManager) {
      error('[MatrixDM] DirectMessageManager 未在客户端上找到')
      return
    }

    await this.refreshCache()
    info('[MatrixDM] DirectMessageService 初始化完成')
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
    if (!this.dmManager) {
      throw new Error('DirectMessageManager 未初始化')
    }

    try {
      const opts = options ?? { userIds: [userId] }
      // 确保 userIds 存在
      if (!opts.userIds) {
        opts.userIds = [userId]
      }
      const roomId = await this.dmManager.createDm(opts as CreateDmOptions)
      await this.refreshCache()
      info(`[MatrixDM] 创建私聊房间成功: ${roomId} -> ${userId}`)
      return roomId
    } catch (err) {
      error(`[MatrixDM] 创建私聊房间失败: ${err}`)
      throw err
    }
  }

  async createTrustedDm(userId: string): Promise<string> {
    if (!this.dmManager) {
      throw new Error('DirectMessageManager 未初始化')
    }

    try {
      const roomId = await this.dmManager.createDm({ userIds: [userId], isEncrypted: true })
      await this.refreshCache()
      info(`[MatrixDM] 创建加密私聊房间成功: ${roomId} -> ${userId}`)
      return roomId
    } catch (err) {
      error(`[MatrixDM] 创建加密私聊房间失败: ${err}`)
      throw err
    }
  }

  async getDMRooms(): Promise<DmRoomInfo[]> {
    return this.dmManager?.getDMRooms() ?? []
  }

  async getDmForUser(userId: string): Promise<string | null> {
    return this.dmManager?.getDmForUser(userId) ?? null
  }

  async checkRoomIsDm(roomId: string): Promise<boolean> {
    const roomInfo = await this.getDmRoomInfo(roomId)
    return !!roomInfo
  }

  async setDmRoom(roomId: string, userId: string): Promise<void> {
    if (!this.dmManager) {
      throw new Error('DirectMessageManager 未初始化')
    }

    try {
      await this.dmManager.setDmRoom(roomId, userId)
      await this.refreshCache()
      info(`[MatrixDM] 设置房间为私聊: ${roomId} -> ${userId}`)
    } catch (err) {
      error(`[MatrixDM] 设置房间为私聊失败: ${err}`)
      throw err
    }
  }

  async removeDmRoom(roomId: string, userId: string): Promise<void> {
    if (!this.dmManager) {
      throw new Error('DirectMessageManager 未初始化')
    }

    try {
      await this.dmManager.removeDmRoom(roomId, userId)
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

  async getDmRoomInfo(roomId: string): Promise<DmRoomInfo | null> {
    if (!this.dmManager) return null
    return this.dmManager.getDmRoomInfo(roomId)
  }

  async getDmRoomInfos(): Promise<DmRoomInfo[]> {
    if (!this.dmManager) return []
    return this.dmManager.getDMRooms()
  }

  /**
   * Get Room objects for specified user IDs
   * @param userIds - Array of user IDs to find DM rooms for
   * @returns Promise resolving to array of Room objects
   */
  async getDmRoomsByUserIds(userIds: string[]): Promise<Room[]> {
    if (!this.dmManager) return []
    const client = matrixClientService.getClient()
    if (!client) return []
    
    const userDmMap = await this.dmManager.getDirectRoomsByUser()
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

  getAllCachedDmRooms(): Map<string, DmRoomInfo[]> {
    return new Map(this.dmRoomsCache)
  }

  async getOrCreateDmRoom(userId: string, encrypted = false): Promise<string> {
    const existingRoomId = await this.getDmForUser(userId)
    if (existingRoomId) {
      info(`[MatrixDM] 使用现有私聊房间: ${existingRoomId}`)
      return existingRoomId
    }

    if (encrypted) {
      return this.createTrustedDm(userId)
    }
    return this.createDm(userId)
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
    this.dmRoomsCache.clear()
    info('[MatrixDM] DirectMessageService 已停止')
  }
}

export const matrixDirectMessageService = new MatrixDirectMessageService()
export default matrixDirectMessageService