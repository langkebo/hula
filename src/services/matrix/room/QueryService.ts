import type { Room, RoomMember } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('RoomQueryService')

export interface GroupSearchResult {
  account: string
  name: string
  avatar?: string
  deleteStatus?: boolean
  extJson?: string
  roomId: string
}

class MatrixRoomQueryService extends BaseMatrixService {
  async searchGroup(keyword: string): Promise<GroupSearchResult[]> {
    try {
      const normalizedKeyword = keyword.trim()
      if (!normalizedKeyword) return []

      const client = this.getClient()
      const rooms = client.getRooms()
      const lowerKeyword = normalizedKeyword.toLowerCase()
      const results = rooms
        .filter((room) => {
          const name = room.name?.toLowerCase() ?? ''
          const roomId = room.roomId?.toLowerCase() ?? ''
          return name.includes(lowerKeyword) || roomId.includes(lowerKeyword)
        })
        .map((room) => ({
          account: room.roomId,
          name: room.name || room.roomId,
          avatar: room.getMxcAvatarUrl?.() ?? undefined,
          roomId: room.roomId
        }))

      if (results.length === 0) {
        logger.warn(`搜索群组未找到匹配: ${normalizedKeyword}`)
      } else {
        logger.info(`搜索群组成功: ${normalizedKeyword}, ${results.length} 条`)
      }
      return results
    } catch (err) {
      logger.error(`搜索群组失败: ${err}`)
      return []
    }
  }

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
