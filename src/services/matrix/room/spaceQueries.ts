/**
 * Space 服务 — 查询操作模块。
 *
 * 从 MatrixSpaceService 抽离，包含父空间查询、搜索、用户空间列表、公开空间列表。
 * 采用工厂模式，接收 getClient/getSpaceManager 依赖。
 */

import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'
import type { IPublicRoomsChunkRoom, MatrixClient, Room } from '../sdk'
import type { SpaceManager as SdkSpaceManager } from '../sdk-compat'
import type { SpaceInfo } from './MatrixSpaceService'
import { getSpaceChildIds, normalizeSpaceTreePathItems, roomToSpaceInfo, sdkSpaceToSpaceInfo } from './spaceHelpers'

const logger = createLogger('SpaceQueries')

/** 创建空间查询实例
 */
export function createSpaceQueries(getClient: () => MatrixClient, getSpaceManager: () => SdkSpaceManager) {
  return {
    /** 获取房间父空间列表
     */
    async getRoomParentSpaces(roomId: string): Promise<SpaceInfo[]> {
      try {
        const manager = getSpaceManager()
        const spaces = await manager.getRoomParentSpaces(roomId)
        return spaces.map((s) => sdkSpaceToSpaceInfo(s))
      } catch (err) {
        logger.error(`[Space] 获取父空间失败: ${err}`)
        return []
      }
    },

    /** 搜索空间
     */
    async searchSpaces(query: string, limit = 10): Promise<SpaceInfo[]> {
      if (!query.trim()) return []
      try {
        const manager = getSpaceManager()
        const spaces = await manager.searchSpaces(query, limit)
        return spaces.map((s) => sdkSpaceToSpaceInfo(s))
      } catch (err) {
        logger.error(`[Space] 搜索空间失败: ${err}`)
        return []
      }
    },

    /** 获取用户空间列表
     */
    async getUserSpaces(): Promise<SpaceInfo[]> {
      try {
        const manager = getSpaceManager()
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('getUserSpaces timeout')), 3000)
        )
        const spaces = await Promise.race([manager.getUserSpaces(), timeoutPromise])
        return spaces.map((s) => sdkSpaceToSpaceInfo(s))
      } catch (err) {
        const client = matrixClientService.getClient()
        if (!client) return []
        logger.error(`[Space] SpaceManager 获取用户 Spaces 失败，回退: ${err}`)
        try {
          const rooms = client.getRooms()
          return rooms
            .filter((room: Room) => room.isSpaceRoom())
            .map((room: Room) => roomToSpaceInfo(room, getSpaceChildIds))
        } catch (fallbackErr) {
          logger.error(`[Space] 回退获取用户 Spaces 也失败: ${fallbackErr}`)
          return []
        }
      }
    },

    /** 获取公开空间列表
     */
    async getPublicSpaces(limit: number = 50): Promise<SpaceInfo[]> {
      try {
        const manager = getSpaceManager()
        const response = await manager.getPublicSpaces({ limit })
        const rawList = response.spaces ?? response.chunk ?? response.rooms ?? []
        return rawList.map((s) => sdkSpaceToSpaceInfo(s))
      } catch (err) {
        logger.error(`[Space] SpaceManager 获取公开空间失败，回退: ${err}`)
        try {
          const client = getClient()
          const result = await client.publicRooms({ limit, filter: { room_types: ['m.space'] } })
          return (result.chunk ?? []).map((room: IPublicRoomsChunkRoom) => ({
            spaceId: room.room_id,
            name: room.name || '',
            topic: room.topic || undefined,
            avatarUrl: room.avatar_url || undefined,
            memberCount: room.num_joined_members ?? 0,
            childCount: 0
          }))
        } catch (fallbackErr) {
          logger.error(`[Space] 回退获取公开空间也失败: ${fallbackErr}`)
          return []
        }
      }
    },

    normalizeSpaceTreePathItems
  }
}
