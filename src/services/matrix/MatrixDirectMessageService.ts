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

    this.refreshCache()
    info('[MatrixDM] DirectMessageService 初始化完成')
  }

  private refreshCache(): void {
    this.dmRoomsCache.clear()
    const dmRooms = this.getDmRoomInfos()
    for (const roomInfo of dmRooms) {
      const existing = this.dmRoomsCache.get(roomInfo.partnerId) || []
      existing.push(roomInfo)
      this.dmRoomsCache.set(roomInfo.partnerId, existing)
    }
  }

  async createDmRoom(userId: string, options?: CreateDmOptions): Promise<Room> {
    if (!this.dmManager) {
      throw new Error('DirectMessageManager 未初始化')
    }

    try {
      const room = await this.dmManager.createDmRoom(userId, options)
      this.refreshCache()
      info(`[MatrixDM] 创建私聊房间成功: ${room.roomId} -> ${userId}`)
      return room
    } catch (err) {
      error(`[MatrixDM] 创建私聊房间失败: ${err}`)
      throw err
    }
  }

  async createTrustedDmRoom(userId: string): Promise<Room> {
    if (!this.dmManager) {
      throw new Error('DirectMessageManager 未初始化')
    }

    try {
      const room = await this.dmManager.createTrustedDmRoom(userId)
      this.refreshCache()
      info(`[MatrixDM] 创建加密私聊房间成功: ${room.roomId} -> ${userId}`)
      return room
    } catch (err) {
      error(`[MatrixDM] 创建加密私聊房间失败: ${err}`)
      throw err
    }
  }

  getDmRooms(): Map<string, Room[]> {
    return this.dmManager?.getDmRooms() ?? new Map()
  }

  getDmRoomsForUser(userId: string): Room[] {
    return this.dmManager?.getDmRoomsForUser(userId) ?? []
  }

  getDmRoom(userId: string): Room | undefined {
    return this.dmManager?.getDmRoom(userId)
  }

  async setRoomAsDirect(roomId: string, userId: string): Promise<void> {
    if (!this.dmManager) {
      throw new Error('DirectMessageManager 未初始化')
    }

    try {
      await this.dmManager.setRoomAsDirect(roomId, userId)
      this.refreshCache()
      info(`[MatrixDM] 设置房间为私聊: ${roomId} -> ${userId}`)
    } catch (err) {
      error(`[MatrixDM] 设置房间为私聊失败: ${err}`)
      throw err
    }
  }

  async removeRoomFromDirect(roomId: string): Promise<void> {
    if (!this.dmManager) {
      throw new Error('DirectMessageManager 未初始化')
    }

    try {
      await this.dmManager.removeRoomFromDirect(roomId)
      this.refreshCache()
      info(`[MatrixDM] 从私聊列表移除房间: ${roomId}`)
    } catch (err) {
      error(`[MatrixDM] 从私聊列表移除房间失败: ${err}`)
      throw err
    }
  }

  isDmRoom(roomId: string): boolean {
    return this.dmManager?.isDmRoom(roomId) ?? false
  }

  getDmPartner(roomId: string): string | undefined {
    return this.dmManager?.getDmPartner(roomId)
  }

  getDmRoomInfos(): DmRoomInfo[] {
    return this.dmManager?.getDmRoomInfos() ?? []
  }

  getCachedDmRooms(userId: string): DmRoomInfo[] {
    return this.dmRoomsCache.get(userId) ?? []
  }

  getAllCachedDmRooms(): Map<string, DmRoomInfo[]> {
    return new Map(this.dmRoomsCache)
  }

  async getOrCreateDmRoom(userId: string, encrypted = false): Promise<Room> {
    const existingRoom = this.getDmRoom(userId)
    if (existingRoom) {
      info(`[MatrixDM] 使用现有私聊房间: ${existingRoom.roomId}`)
      return existingRoom
    }

    if (encrypted) {
      return this.createTrustedDmRoom(userId)
    }
    return this.createDmRoom(userId)
  }

  getDmRoomList(): DmRoomInfo[] {
    const roomInfos = this.getDmRoomInfos()
    return roomInfos.sort((a, b) => {
      const aTime = a.lastMessageTimestamp ?? 0
      const bTime = b.lastMessageTimestamp ?? 0
      return bTime - aTime
    })
  }

  getUnreadDmRooms(): DmRoomInfo[] {
    return this.getDmRoomInfos().filter((room) => room.unreadCount > 0)
  }

  getTotalUnreadCount(): number {
    return this.getDmRoomInfos().reduce((sum, room) => sum + room.unreadCount, 0)
  }

  stop(): void {
    this.dmManager = null
    this.dmRoomsCache.clear()
    info('[MatrixDM] DirectMessageService 已停止')
  }
}

export const matrixDirectMessageService = new MatrixDirectMessageService()
export default matrixDirectMessageService
