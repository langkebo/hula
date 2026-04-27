import { info, error } from '@tauri-apps/plugin-log'
import { Preset, Visibility } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'

interface DirectRoomsContent {
  [userId: string]: unknown
}

/**
 * Direct-message room domain service.
 *
 * Creates DM rooms, reads `m.direct` account data, and registers
 * new DM rooms into the mapping.
 * Extracted from `MatrixRoomService` as part of the P1-1 split.
 */
export class MatrixRoomDirectMessageService {
  private getClient() {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('客户端未初始化')
    return client
  }

  private parseDirectRoomsContent(content: DirectRoomsContent): Map<string, string[]> {
    const directRooms = new Map<string, string[]>()

    for (const [userId, roomIds] of Object.entries(content)) {
      if (!Array.isArray(roomIds)) {
        continue
      }
      const normalizedRoomIds = roomIds.filter((roomId): roomId is string => typeof roomId === 'string')
      directRooms.set(userId, normalizedRoomIds)
    }

    return directRooms
  }

  async createDirectRoom(userId: string): Promise<string> {
    if (!navigator.onLine) {
      const tempRoomId = `!pending-dm-${Date.now()}`
      offlineQueueService.enqueue('dm_creation', tempRoomId, { userId })
      info(`[MatrixRoom] 离线状态，已将创建直接消息房间入队: ${userId}`)
      return tempRoomId
    }
    const client = this.getClient()
    try {
      const room = await client.createRoom({
        is_direct: true,
        invite: [userId],
        preset: Preset.TrustedPrivateChat,
        visibility: Visibility.Private
      })
      info(`[MatrixRoom] 创建直接消息房间成功: ${room.room_id}`)
      return room.room_id
    } catch (err) {
      error(`[MatrixRoom] 创建直接消息房间失败: ${err}`)
      throw err
    }
  }

  async getDirectRooms(): Promise<Map<string, string[]>>
  async getDirectRooms(throwOnError: true): Promise<Map<string, string[]>>
  async getDirectRooms(throwOnError: false): Promise<Map<string, string[]>>
  async getDirectRooms(throwOnError = true): Promise<Map<string, string[]>> {
    const client = this.getClient()
    try {
      const accountData = client.getAccountData('m.direct')
      if (accountData) {
        return this.parseDirectRoomsContent(accountData.getContent() as DirectRoomsContent)
      }
      return new Map()
    } catch (err) {
      error(`[MatrixRoom] 获取直接消息房间失败: ${err}`)
      if (throwOnError) {
        throw err
      }
      return new Map()
    }
  }

  async setDirectRoom(userId: string, roomId: string): Promise<void> {
    const client = this.getClient()
    try {
      const directRooms = await this.getDirectRooms()
      const rooms = directRooms.get(userId) || []
      if (!rooms.includes(roomId)) {
        rooms.push(roomId)
        directRooms.set(userId, rooms)
        await client.setAccountData('m.direct', Object.fromEntries(directRooms))
      }
      info(`[MatrixRoom] 设置直接消息房间成功: ${userId} -> ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 设置直接消息房间失败: ${err}`)
      throw err
    }
  }
}

export const matrixRoomDirectMessageService = new MatrixRoomDirectMessageService()
