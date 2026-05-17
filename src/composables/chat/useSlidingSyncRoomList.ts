import { onUnmounted, type Ref, readonly, ref } from 'vue'
import type { SlidingSyncUnreadUpdate } from '@/services/matrix/sync/MatrixSlidingSyncService'
import matrixSlidingSyncService from '@/services/matrix/sync/MatrixSlidingSyncService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SlidingSyncRoomList')

export interface RoomUnreadInfo {
  roomId: string
  unreadCount: number
  highlightCount: number
  notificationCount: number
}

export interface UseSlidingSyncRoomListOptions {
  onUnreadUpdate?: (updates: RoomUnreadInfo[]) => void
  onRoomUpdate?: (roomId: string) => void
  onListRefresh?: () => void
}

export function useSlidingSyncRoomList(options: UseSlidingSyncRoomListOptions = {}) {
  const isInitialized = ref(false)
  const lastSyncPosition = ref<string | null>(null)
  const unreadMap = ref<Map<string, RoomUnreadInfo>>(new Map())

  const callbacks = {
    onUnreadCountsUpdate: (updates: SlidingSyncUnreadUpdate[]) => {
      const mapped: RoomUnreadInfo[] = updates.map((u) => ({
        roomId: u.roomId,
        unreadCount: u.unreadCount,
        highlightCount: u.highlightCount,
        notificationCount: u.notificationCount
      }))

      for (const info of mapped) {
        unreadMap.value.set(info.roomId, info)
      }

      options.onUnreadUpdate?.(mapped)
    },
    onRoomUpdate: (roomId: string) => {
      options.onRoomUpdate?.(roomId)
    },
    onRoomListRefresh: () => {
      options.onListRefresh?.()
    }
  }

  const initialize = async () => {
    matrixSlidingSyncService.registerCallbacks(callbacks)

    try {
      await matrixSlidingSyncService.initialize()
      isInitialized.value = matrixSlidingSyncService.isInitialized
      lastSyncPosition.value = matrixSlidingSyncService.getSyncPosition()
    } catch (err) {
      logger.error(`初始化失败: ${err}`)
    }
  }

  const updateVisibleRange = (startIndex: number, endIndex: number) => {
    matrixSlidingSyncService.updateVisibleRange(startIndex, endIndex)
  }

  const getRoomUnread = (roomId: string): RoomUnreadInfo | undefined => {
    return unreadMap.value.get(roomId)
  }

  const subscribeRoom = (roomId: string) => {
    matrixSlidingSyncService.subscribeRoom(roomId, true)
  }

  const unsubscribeRoom = (roomId: string) => {
    matrixSlidingSyncService.subscribeRoom(roomId, false)
  }

  onUnmounted(() => {
    // 不销毁全局服务，只清理本地引用
  })

  return {
    isInitialized: readonly(isInitialized),
    lastSyncPosition: readonly(lastSyncPosition),
    unreadMap: unreadMap as Readonly<Ref<Map<string, RoomUnreadInfo>>>,
    initialize,
    updateVisibleRange,
    getRoomUnread,
    subscribeRoom,
    unsubscribeRoom
  }
}
