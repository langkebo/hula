import type { Room, RoomMember } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('RoomQueryService')

class MatrixRoomQueryService extends BaseMatrixService {
  async getRooms(): Promise<Room[]> {
    try {
      return this.getClient().getRooms()
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间列表失败: ${err}`)
      throw err
    }
  }

  async getRoom(roomId: string): Promise<Room>
  async getRoom(roomId: string, throwOnError: true): Promise<Room>
  async getRoom(roomId: string, throwOnError: false): Promise<Room | null>
  async getRoom(roomId: string, throwOnError = true): Promise<Room | null> {
    try {
      const room = this.getClient().getRoom(roomId) ?? null
      if (room || !throwOnError) {
        return room
      }

      throw new Error(`房间不存在: ${roomId}`)
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间失败: ${err}`)
      throw err
    }
  }

  async getMembers(roomId: string): Promise<RoomMember[]> {
    try {
      const room = await this.getRoom(roomId)
      return room.getJoinedMembers()
    } catch (err) {
      logger.error(`[MatrixRoom] 获取房间成员失败: ${err}`)
      throw err
    }
  }
}

export const matrixRoomQueryService = new MatrixRoomQueryService()
