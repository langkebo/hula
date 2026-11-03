import { type Ref, ref } from 'vue'
import { LARGE_PAGE_LIMIT } from '@/common/constants'
import type { MediaInfo } from '@/services/matrix/admin'
import { adminService } from '@/services/matrix/admin'
import type { GlobalMediaQuarantineChange, MediaQuarantineChange, RoomMediaItem } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminMedia')

type MediaListPage = Awaited<ReturnType<typeof adminService.getMediaList>>

/** 媒体库列表项：沿用服务层已归一化的驼峰形状（服务层把 `next_batch` 归一为 `nextToken`）。 */
export type MediaLibraryItem = MediaListPage['media'][number]

export interface UseAdminMedia {
  library: Ref<MediaLibraryItem[]>
  libraryNextBatch: Ref<string | null>
  libraryLoading: Ref<boolean>
  selectedMedia: Ref<MediaInfo | null>
  detailLoading: Ref<boolean>
  quarantineChanges: Ref<GlobalMediaQuarantineChange[]>
  quarantineNextBatch: Ref<number>
  quarantineLoading: Ref<boolean>
  roomMedia: Ref<RoomMediaItem[]>
  roomMediaNextBatch: Ref<string | null>
  roomMediaLoading: Ref<boolean>
  userMedia: Ref<MediaInfo[]>
  userMediaLoading: Ref<boolean>
  mutating: Ref<boolean>
  loadLibrary: (reset?: boolean) => Promise<void>
  loadMoreLibrary: () => Promise<void>
  openMediaDetail: (mediaId: string) => Promise<void>
  closeMediaDetail: () => void
  loadQuarantineChanges: (reset?: boolean) => Promise<void>
  loadMoreQuarantineChanges: () => Promise<void>
  loadMediaQuarantineHistory: (mediaId: string) => Promise<MediaQuarantineChange[]>
  loadRoomMedia: (roomId: string, reset?: boolean) => Promise<void>
  loadMoreRoomMedia: () => Promise<void>
  loadUserMedia: (userId: string) => Promise<void>
  quarantine: (serverName: string, mediaId: string) => Promise<void>
  unquarantine: (serverName: string, mediaId: string) => Promise<void>
  protect: (serverName: string, mediaId: string) => Promise<void>
  unprotect: (mediaId: string) => Promise<void>
  deleteOne: (serverName: string | null, mediaId: string) => Promise<void>
  deleteRoomOne: (roomId: string, mediaId: string) => Promise<void>
  deleteUserAll: (userId: string) => Promise<void>
  quarantineRoom: (roomId: string, userId?: string) => Promise<void>
  unquarantineRoom: (roomId: string, userId?: string) => Promise<void>
  quarantineUser: (userId: string) => Promise<void>
  deleteByPolicy: (options: { beforeTs?: number; maxSize?: number }) => Promise<number>
}

/**
 * Admin 媒体管理 composable。
 *
 * 只负责状态与编排，渲染与成功/失败提示由视图（useActionFeedback）承担：
 * - void 写方法失败时记录日志并 rethrow，视图据此展示错误；
 * - 返回 null 的方法失败时不抛出，改为清空对应状态并记录日志。
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

  const roomMedia = ref<RoomMediaItem[]>([])
  const roomMediaNextBatch = ref<string | null>(null)
  const roomMediaLoading = ref(false)
  // 记录当前房间，供 loadMoreRoomMedia 复用；不对外暴露。
  const roomMediaRoomId = ref<string | null>(null)

  const userMedia = ref<MediaInfo[]>([])
  const userMediaLoading = ref(false)

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
      quarantineChanges.value = reset ? result.changes : [...quarantineChanges.value, ...result.changes]
      quarantineNextBatch.value = result.next_batch
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
    // 后端在无新条目时会回显请求游标，空列表时不再请求，避免原地翻页。
    if (quarantineChanges.value.length === 0) return
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
      if (!result) logger.warn(`保护媒体失败: ${mediaId}`)
    } finally {
      mutating.value = false
    }
  }

  async function unprotect(mediaId: string) {
    mutating.value = true
    try {
      const result = await adminService.unprotectMedia(mediaId)
      if (!result) logger.warn(`取消保护媒体失败: ${mediaId}`)
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
        return
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
      if (!result) logger.warn(`隔离房间媒体失败: ${roomId}`)
    } finally {
      mutating.value = false
    }
  }

  async function unquarantineRoom(roomId: string, userId?: string) {
    mutating.value = true
    try {
      const result = await adminService.unquarantineRoomMedia(roomId, userId)
      if (!result) logger.warn(`取消隔离房间媒体失败: ${roomId}`)
    } finally {
      mutating.value = false
    }
  }

  async function quarantineUser(userId: string) {
    mutating.value = true
    try {
      const result = await adminService.quarantineUserMedia(userId)
      if (!result) logger.warn(`隔离用户媒体失败: ${userId}`)
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
        return 0
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
    userMedia,
    userMediaLoading,
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
