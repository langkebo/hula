import { type ShallowRef, triggerRef } from 'vue'
import { matrixRoomReadFacade } from '@/services/matrix/room/ReadFacade'
import type { RoomDetail, RoomInfo } from '@/services/types'
import { createLogger } from '@/utils/Logger'
import { LRUCache } from '@/utils/LRUCache'

const logger = createLogger('RoomStore.DetailCache')

export type RoomDetailCacheContext = {
  rooms: ShallowRef<Map<string, RoomInfo>>
}

/**
 * 房间详情缓存模块
 *
 * LRU(50) + 进行中请求去重（roomDetailPending），批量加载限流 batchSize=3。
 */
export function createRoomDetailCache(ctx: RoomDetailCacheContext) {
  const { rooms } = ctx

  const roomDetailCache = new LRUCache<string, RoomDetail>(50)
  const roomDetailPending = new Map<string, Promise<RoomDetail | null>>()

  async function loadRoomDetail(roomId: string): Promise<RoomDetail | null> {
    const cached = roomDetailCache.get(roomId)
    if (cached) {
      return cached
    }

    const pending = roomDetailPending.get(roomId)
    if (pending) {
      return pending
    }

    const promise = (async () => {
      try {
        const summary = await matrixRoomReadFacade.getRoomSummary(roomId)
        if (!summary) return null

        const detail: RoomDetail = {
          roomId: summary.roomId,
          topic: summary.topic,
          memberCount: summary.memberCount,
          joinedCount: summary.joinedCount,
          ownerId: null,
          joinRule:
            summary.joinRule && ['public', 'invite', 'knock', 'private'].includes(summary.joinRule)
              ? (summary.joinRule as 'public' | 'invite' | 'knock' | 'private')
              : null,
          canonicalAlias: summary.canonicalAlias,
          avatarUrl: summary.avatarUrl,
          createdTs: null,
          isPublic: summary.isPublic
        }

        roomDetailCache.set(roomId, detail)
        return detail
      } catch (err) {
        logger.error(`[RoomStore] 加载房间详情失败: ${roomId} ${err}`)
        return null
      } finally {
        roomDetailPending.delete(roomId)
      }
    })()

    roomDetailPending.set(roomId, promise)
    return promise
  }

  async function loadRoomDetails(roomIds: string[]): Promise<void> {
    const uncachedIds = roomIds.filter((id) => !roomDetailCache.has(id))

    if (uncachedIds.length === 0) {
      logger.info('[RoomStore] 所有房间详情已缓存')
      return
    }

    logger.info(`[RoomStore] 开始批量加载 ${uncachedIds.length} 个房间详情`)

    const batchSize = 3
    for (let i = 0; i < uncachedIds.length; i += batchSize) {
      const batch = uncachedIds.slice(i, i + batchSize)
      await Promise.allSettled(
        batch.map(async (roomId) => {
          const detail = await loadRoomDetail(roomId)
          if (detail) {
            const roomInfo = rooms.value.get(roomId)
            if (roomInfo) {
              roomInfo.detail = detail
              rooms.value.set(roomId, roomInfo)
              triggerRef(rooms)
            }
          }
        })
      )
    }

    logger.info(`[RoomStore] 批量加载完成`)
  }

  function clearRoomDetailCache(roomId?: string): void {
    if (roomId) {
      roomDetailCache.delete(roomId)
      logger.info(`[RoomStore] 清除房间详情缓存: ${roomId}`)
    } else {
      roomDetailCache.clear()
      logger.info('[RoomStore] 清除所有房间详情缓存')
    }
  }

  function getCacheStats(): { size: number; keys: string[] } {
    return {
      size: roomDetailCache.size,
      keys: Array.from(roomDetailCache.keys())
    }
  }

  return {
    loadRoomDetail,
    loadRoomDetails,
    clearRoomDetailCache,
    getCacheStats
  }
}
