import type { Room } from 'matrix-js-sdk'
import { DirectMessageManager, type CreateDmOptions, type DmRoomInfo, type IDirectRoomsMap } from 'matrix-js-sdk/dm'
import matrixClientService from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info, error } from '@tauri-apps/plugin-log'

export type { CreateDmOptions, DmRoomInfo, IDirectRoomsMap }

class MatrixDirectMessageService extends BaseManager {
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

  async createDm(userId: string, options?: Partial<CreateDmOptions>, throwOnError = false): Promise<string> {
    if (!this.dmManager) {
      throw new Error('DirectMessageManager 未初始化')
    }

    try {
      const opts = options ?? { userIds: [userId] }
      if (!opts.userIds) {
        opts.userIds = [userId]
      }
      const roomId = await this.dmManager.createDm(opts as CreateDmOptions)
      await this.refreshCache()
      info(`[MatrixDM] 创建私聊房间成功: ${roomId} -> ${userId}`)
      return roomId
    } catch (err) {
      return this.handleError(err, 'createDm', '' as string, throwOnError)
    }
  }

  async createTrustedDm(userId: string, throwOnError = false): Promise<string> {
    if (!this.dmManager) {
      throw new Error('DirectMessageManager 未初始化')
    }

    try {
      const roomId = await this.dmManager.createDm({ userIds: [userId], isEncrypted: true })
      await this.refreshCache()
      info(`[MatrixDM] 创建加密私聊房间成功: ${roomId} -> ${userId}`)
      return roomId
    } catch (err) {
      return this.handleError(err, 'createTrustedDm', '' as string, throwOnError)
    }
  }

  async getDMRooms(throwOnError = true): Promise<DmRoomInfo[]> {
    try {
      return this.dmManager?.getDMRooms() ?? []
    } catch (err) {
      return this.handleError(err, 'getDMRooms', [] as DmRoomInfo[], throwOnError)
    }
  }

  async getDmForUser(userId: string, throwOnError = true): Promise<string | null> {
    try {
      return this.dmManager?.getDmForUser(userId) ?? null
    } catch (err) {
      return this.handleError(err, 'getDmForUser', null as string | null, throwOnError)
    }
  }

  async checkRoomIsDm(roomId: string, throwOnError = true): Promise<boolean> {
    try {
      const roomInfo = await this.getDmRoomInfo(roomId, throwOnError)
      return !!roomInfo
    } catch (err) {
      return this.handleError(err, 'checkRoomIsDm', false, throwOnError)
    }
  }

  async setDmRoom(roomId: string, userId: string, throwOnError = false): Promise<void> {
    if (!this.dmManager) {
      throw new Error('DirectMessageManager 未初始化')
    }

    try {
      await this.dmManager.setDmRoom(roomId, userId)
      await this.refreshCache()
      info(`[MatrixDM] 设置房间为私聊: ${roomId} -> ${userId}`)
    } catch (err) {
      this.handleError(err, 'setDmRoom', undefined as void, throwOnError)
    }
  }

  async removeDmRoom(roomId: string, userId: string, throwOnError = false): Promise<void> {
    if (!this.dmManager) {
      throw new Error('DirectMessageManager 未初始化')
    }

    try {
      await this.dmManager.removeDmRoom(roomId, userId)
      await this.refreshCache()
      info(`[MatrixDM] 从私聊列表移除房间: ${roomId}`)
    } catch (err) {
      this.handleError(err, 'removeDmRoom', undefined as void, throwOnError)
    }
  }

  async getDmPartner(roomId: string, throwOnError = true): Promise<string | null> {
    try {
      const roomInfo = await this.getDmRoomInfo(roomId, throwOnError)
      return roomInfo?.invitees?.[0] ?? roomInfo?.inviter ?? null
    } catch (err) {
      return this.handleError(err, 'getDmPartner', null as string | null, throwOnError)
    }
  }

  async getDmRoomInfo(roomId: string, throwOnError = true): Promise<DmRoomInfo | null> {
    if (!this.dmManager) return null
    try {
      return this.dmManager.getDmRoomInfo(roomId)
    } catch (err) {
      return this.handleError(err, 'getDmRoomInfo', null as DmRoomInfo | null, throwOnError)
    }
  }

  async getDmRoomInfos(throwOnError = true): Promise<DmRoomInfo[]> {
    if (!this.dmManager) return []
    try {
      return this.dmManager.getDMRooms()
    } catch (err) {
      return this.handleError(err, 'getDmRoomInfos', [] as DmRoomInfo[], throwOnError)
    }
  }

  async getDmRoomsByUserIds(userIds: string[], throwOnError = true): Promise<Room[]> {
    if (!this.dmManager) return []
    const client = matrixClientService.getClient()
    if (!client) return []

    try {
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
    } catch (err) {
      return this.handleError(err, 'getDmRoomsByUserIds', [] as Room[], throwOnError)
    }
  }

  async getDmRoom(roomId: string, throwOnError = true): Promise<Room | null> {
    try {
      const client = matrixClientService.getClient()
      return client?.getRoom(roomId) ?? null
    } catch (err) {
      return this.handleError(err, 'getDmRoom', null as Room | null, throwOnError)
    }
  }

  getCachedDmRooms(userId: string): DmRoomInfo[] {
    return this.dmRoomsCache.get(userId) ?? []
  }

  getAllCachedDmRooms(): Map<string, DmRoomInfo[]> {
    return new Map(this.dmRoomsCache)
  }

  async getOrCreateDmRoom(userId: string, encrypted = false, throwOnError = true): Promise<string> {
    try {
      const existingRoomId = await this.getDmForUser(userId, throwOnError)
      if (existingRoomId) {
        info(`[MatrixDM] 使用现有私聊房间: ${existingRoomId}`)
        return existingRoomId
      }

      if (encrypted) {
        return this.createTrustedDm(userId, throwOnError)
      }
      return this.createDm(userId, undefined, throwOnError)
    } catch (err) {
      return this.handleError(err, 'getOrCreateDmRoom', '' as string, throwOnError)
    }
  }

  async getDmRoomList(throwOnError = true): Promise<DmRoomInfo[]> {
    try {
      const roomInfos = await this.getDMRooms(throwOnError)
      return roomInfos.sort((a, b) => {
        const aTime = a.lastMessage?.timestamp ?? 0
        const bTime = b.lastMessage?.timestamp ?? 0
        return bTime - aTime
      })
    } catch (err) {
      return this.handleError(err, 'getDmRoomList', [] as DmRoomInfo[], throwOnError)
    }
  }

  async getUnreadDmRooms(throwOnError = true): Promise<DmRoomInfo[]> {
    try {
      const roomInfos = await this.getDMRooms(throwOnError)
      return roomInfos.filter((room) => (room.unreadCount ?? 0) > 0)
    } catch (err) {
      return this.handleError(err, 'getUnreadDmRooms', [] as DmRoomInfo[], throwOnError)
    }
  }

  async getTotalUnreadCount(throwOnError = true): Promise<number> {
    try {
      const roomInfos = await this.getDMRooms(throwOnError)
      return roomInfos.reduce((sum, room) => sum + (room.unreadCount ?? 0), 0)
    } catch (err) {
      return this.handleError(err, 'getTotalUnreadCount', 0, throwOnError)
    }
  }

  stop(): void {
    this.dmManager = null
    this.dmRoomsCache.clear()
    info('[MatrixDM] DirectMessageService 已停止')
  }
}

export const matrixDirectMessageService = new MatrixDirectMessageService()
export default matrixDirectMessageService
