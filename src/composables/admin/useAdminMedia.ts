import { ref } from 'vue'
import { LARGE_PAGE_LIMIT } from '@/common/constants'
import type { MediaInfo } from '@/services/matrix/admin'
import { adminService } from '@/services/matrix/admin'
import type { GlobalMediaQuarantineChange, RoomMediaItem } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import type { MediaLibraryItem, UseAdminMedia } from './adminMediaTypes'

export type { MediaLibraryItem, UseAdminMedia } from './adminMediaTypes'

const logger = createLogger('AdminMedia')

/**
 * Admin 媒体管理 composable。
 *
 * 只负责状态与编排，渲染与成功/失败提示由视图（useActionFeedback）承担：
 * - void 写方法失败时记录日志并 rethrow，视图据此展示错误；
 * - 服务层返回 null（失败信号）时同样抛出带中文消息的 Error，避免视图无法区分成功与失败。
 * 分页游标形状严格按后端契约：媒体库/房间媒体为字符串游标，全局隔离变更流为数值游标。
 */
export function useAdminMedia(): UseAdminMedia {
  const library = ref<MediaLibraryItem[]>([])
  const libraryNextBatch = ref<string | null>(null)
  const libraryLoading = ref(false)

  const selectedMedia = ref<MediaInfo | null>(null)
  const detailLoading = ref(false)

  const quarantineChanges = ref<GlobalMediaQuarantineChange[]>([])
  const quarantineNextBatch = ref(0)
  const quarantineLoading = ref(false)
  // 全局隔离变更流是否还有更多数据；游标未前进或本页为空时置 false，避免原地重复翻页。
  const quarantineHasMore = ref(true)

  const roomMedia = ref<RoomMediaItem[]>([])
  const roomMediaNextBatch = ref<string | null>(null)
  const roomMediaLoading = ref(false)
  // 记录当前房间，供 loadMoreRoomMedia 与破坏性操作复用。
  const roomMediaRoomId = ref<string | null>(null)

  const userMedia = ref<MediaInfo[]>([])
  const userMediaLoading = ref(false)
  // 记录当前用户，供用户媒体的破坏性操作与刷新复用。
  const userMediaUserId = ref<string | null>(null)

  const mutating = ref(false)

  async function loadLibrary(reset = true) {
    libraryLoading.value = true
    try {
      const from = reset ? undefined : (libraryNextBatch.value ?? undefined)
      const page = await adminService.getMediaList(LARGE_PAGE_LIMIT, from)
      library.value = reset ? page.media : [...library.value, ...page.media]
      libraryNextBatch.value = page.nextToken ?? null
    } catch (e) {
      logger.error('加载媒体库失败', e)
      if (reset) {
        library.value = []
        libraryNextBatch.value = null
      }
    } finally {
      libraryLoading.value = false
    }
  }

  async function loadMoreLibrary() {
    if (!libraryNextBatch.value) return
    await loadLibrary(false)
  }

  async function openMediaDetail(mediaId: string) {
    detailLoading.value = true
    try {
      const info = await adminService.getMediaInfo(mediaId)
      selectedMedia.value = info
      if (!info) logger.error(`加载媒体详情失败: ${mediaId}`)
    } catch (e) {
      logger.error(`加载媒体详情失败: ${mediaId}`, e)
      selectedMedia.value = null
    } finally {
      detailLoading.value = false
    }
  }

  function closeMediaDetail() {
    selectedMedia.value = null
  }

  async function loadQuarantineChanges(reset = true) {
    quarantineLoading.value = true
    try {
      const from = reset ? undefined : quarantineNextBatch.value
      const result = await adminService.getGlobalQuarantineChanges(from)
      if (!result) {
        logger.error('加载全局媒体隔离变更失败')
        if (reset) {
          quarantineChanges.value = []
          quarantineNextBatch.value = 0
        }
        return
      }
      const pageChanges = result.changes
      // next_batch 运行时可能缺省或为 null，统一按“无更多数据”处理。
      const nextBatch: number | null | undefined = result.next_batch
      // 后端无新条目时会回显本次请求的游标，游标未前进说明该页已被消费，继续翻页只会重复。
      const cursorStalled = !reset && from !== undefined && nextBatch === from
      const pageExhausted =
        pageChanges.length === 0 || cursorStalled || nextBatch === null || nextBatch === undefined || nextBatch === 0
      if (reset) {
        quarantineChanges.value = pageChanges
      } else if (!pageExhausted) {
        quarantineChanges.value = [...quarantineChanges.value, ...pageChanges]
      }
      quarantineNextBatch.value = nextBatch ?? quarantineNextBatch.value
      quarantineHasMore.value = !pageExhausted
    } catch (e) {
      logger.error('加载全局媒体隔离变更失败', e)
      if (reset) {
        quarantineChanges.value = []
        quarantineNextBatch.value = 0
      }
    } finally {
      quarantineLoading.value = false
    }
  }

  async function loadMoreQuarantineChanges() {
    // 列表为空或已确认没有更多数据时不再请求，避免原地重复翻页。
    if (!quarantineHasMore.value || quarantineChanges.value.length === 0) return
    await loadQuarantineChanges(false)
  }

  async function loadMediaQuarantineHistory(mediaId: string) {
    try {
      const result = await adminService.getMediaQuarantineChanges(mediaId)
      if (!result) {
        logger.error(`加载媒体隔离变更失败: ${mediaId}`)
        return []
      }
      return result.changes
    } catch (e) {
      logger.error(`加载媒体隔离变更失败: ${mediaId}`, e)
      return []
    }
  }

  async function loadRoomMedia(roomId: string, reset = true) {
    if (reset) roomMediaRoomId.value = roomId
    roomMediaLoading.value = true
    try {
      const from = reset ? undefined : (roomMediaNextBatch.value ?? undefined)
      const page = await adminService.getRoomMedia(roomId, from)
      if (!page) {
        logger.error(`加载房间媒体失败: ${roomId}`)
        if (reset) {
          roomMedia.value = []
          roomMediaNextBatch.value = null
        }
        return
      }
      roomMedia.value = reset ? page.media : [...roomMedia.value, ...page.media]
      roomMediaNextBatch.value = page.next_batch
    } catch (e) {
      logger.error(`加载房间媒体失败: ${roomId}`, e)
      if (reset) {
        roomMedia.value = []
        roomMediaNextBatch.value = null
      }
    } finally {
      roomMediaLoading.value = false
    }
  }

  async function loadMoreRoomMedia() {
    const roomId = roomMediaRoomId.value
    if (!roomId || !roomMediaNextBatch.value) return
    await loadRoomMedia(roomId, false)
  }

  async function loadUserMedia(userId: string) {
    userMediaUserId.value = userId
    userMediaLoading.value = true
    try {
      const result = await adminService.getUserMedia(userId)
      if (!result) {
        logger.error(`加载用户媒体失败: ${userId}`)
        userMedia.value = []
        return
      }
      // 后端不读 limit/from，一次返回该用户的全部媒体。
      userMedia.value = result.media
    } catch (e) {
      logger.error(`加载用户媒体失败: ${userId}`, e)
      userMedia.value = []
    } finally {
      userMediaLoading.value = false
    }
  }

  async function quarantine(serverName: string, mediaId: string) {
    mutating.value = true
    try {
      await adminService.quarantineMedia(serverName, mediaId)
    } catch (e) {
      logger.error(`隔离媒体失败: ${mediaId}`, e)
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function unquarantine(serverName: string, mediaId: string) {
    mutating.value = true
    try {
      await adminService.unquarantineMedia(serverName, mediaId)
    } catch (e) {
      logger.error(`取消隔离媒体失败: ${mediaId}`, e)
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function protect(serverName: string, mediaId: string) {
    mutating.value = true
    try {
      const result = await adminService.protectMedia(serverName, mediaId)
      if (!result) {
        logger.warn(`保护媒体失败: ${mediaId}`)
        throw new Error(`保护媒体失败: ${mediaId}`)
      }
    } finally {
      mutating.value = false
    }
  }

  async function unprotect(mediaId: string) {
    mutating.value = true
    try {
      const result = await adminService.unprotectMedia(mediaId)
      if (!result) {
        logger.warn(`取消保护媒体失败: ${mediaId}`)
        throw new Error(`取消保护媒体失败: ${mediaId}`)
      }
    } finally {
      mutating.value = false
    }
  }

  async function deleteOne(serverName: string | null, mediaId: string) {
    mutating.value = true
    try {
      if (serverName) {
        await adminService.deleteMediaByServer(serverName, mediaId)
      } else {
        await adminService.deleteMedia(mediaId)
      }
    } catch (e) {
      logger.error(`删除媒体失败: ${mediaId}`, e)
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function deleteRoomOne(roomId: string, mediaId: string) {
    mutating.value = true
    try {
      await adminService.deleteRoomMedia(roomId, mediaId)
    } catch (e) {
      logger.error(`删除房间媒体失败: ${mediaId}`, e)
      throw e
    } finally {
      mutating.value = false
    }
  }

  async function deleteUserAll(userId: string) {
    mutating.value = true
    try {
      const result = await adminService.deleteUserMedia(userId)
      if (!result) {
        logger.warn(`删除用户媒体失败: ${userId}`)
        throw new Error(`删除用户媒体失败: ${userId}`)
      }
      logger.info(`已删除用户媒体: ${userId} (${result.deleted}个)`)
    } finally {
      mutating.value = false
    }
  }

  async function quarantineRoom(roomId: string, userId?: string) {
    mutating.value = true
    try {
      const result = await adminService.quarantineRoomMedia(roomId, userId)
      if (!result) {
        logger.warn(`隔离房间媒体失败: ${roomId}`)
        throw new Error(`隔离房间媒体失败: ${roomId}`)
      }
    } finally {
      mutating.value = false
    }
  }

  async function unquarantineRoom(roomId: string, userId?: string) {
    mutating.value = true
    try {
      const result = await adminService.unquarantineRoomMedia(roomId, userId)
      if (!result) {
        logger.warn(`取消隔离房间媒体失败: ${roomId}`)
        throw new Error(`取消隔离房间媒体失败: ${roomId}`)
      }
    } finally {
      mutating.value = false
    }
  }

  async function quarantineUser(userId: string) {
    mutating.value = true
    try {
      const result = await adminService.quarantineUserMedia(userId)
      if (!result) {
        logger.warn(`隔离用户媒体失败: ${userId}`)
        throw new Error(`隔离用户媒体失败: ${userId}`)
      }
    } finally {
      mutating.value = false
    }
  }

  async function deleteByPolicy(options: { beforeTs?: number; maxSize?: number }) {
    mutating.value = true
    try {
      const result = await adminService.deleteMediaByPolicy(options)
      if (!result) {
        logger.warn('按策略删除媒体失败')
        throw new Error('按策略删除媒体失败')
      }
      return result.deleted
    } finally {
      mutating.value = false
    }
  }

  return {
    library,
    libraryNextBatch,
    libraryLoading,
    selectedMedia,
    detailLoading,
    quarantineChanges,
    quarantineNextBatch,
    quarantineLoading,
    roomMedia,
    roomMediaNextBatch,
    roomMediaLoading,
    roomMediaRoomId,
    userMedia,
    userMediaLoading,
    userMediaUserId,
    mutating,
    loadLibrary,
    loadMoreLibrary,
    openMediaDetail,
    closeMediaDetail,
    loadQuarantineChanges,
    loadMoreQuarantineChanges,
    loadMediaQuarantineHistory,
    loadRoomMedia,
    loadMoreRoomMedia,
    loadUserMedia,
    quarantine,
    unquarantine,
    protect,
    unprotect,
    deleteOne,
    deleteRoomOne,
    deleteUserAll,
    quarantineRoom,
    unquarantineRoom,
    quarantineUser,
    deleteByPolicy
  }
}
