import { error, info } from '@tauri-apps/plugin-log'
import { Preset, type Room, Visibility } from 'matrix-js-sdk'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import { BaseMatrixService } from '../BaseMatrixService'

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
export class MatrixRoomDirectMessageService extends BaseMatrixService {
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

  private getRoomById(roomId: string): Room | null {
    const clientWithRooms = this.getClient() as {
      getRoom?: (targetRoomId: string) => Room | null
    }
    return clientWithRooms.getRoom?.(roomId) ?? null
  }

  private shouldPersistDirectRoom(roomId: string): boolean {
    const room = this.getRoomById(roomId)
    if (!room) {
      return true
    }
    return room.getMyMembership?.() === 'join'
  }

  async setDirectRoom(userId: string, roomId: string): Promise<void> {
    const client = this.getClient()
    try {
      const directRooms = await this.getDirectRooms()
      const rooms = directRooms.get(userId) || []
      if (!rooms.includes(roomId)) {
        rooms.push(roomId)

        // 13.4.1: 在写回前过滤掉已离开或无效的房间，防止 crypto SDK 报错
        const validRooms = rooms.filter((id) => this.shouldPersistDirectRoom(id))

        if (validRooms.length > 0) {
          directRooms.set(userId, validRooms)
          await client.setAccountData('m.direct', Object.fromEntries(directRooms))
        }
      }
      info(`[MatrixRoom] 设置直接消息房间成功: ${userId} -> ${roomId}`)
    } catch (err) {
      error(`[MatrixRoom] 设置直接消息房间失败: ${err}`)
      throw err
    }
  }
}

export const matrixRoomDirectMessageService = new MatrixRoomDirectMessageService()
