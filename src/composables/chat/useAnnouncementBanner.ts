import type { UnlistenFn } from '@tauri-apps/api/event'
import { nextTick, type Ref, ref, watch } from 'vue'
import type { Announcement } from '@/stores/domains/chat/announcement'
import { useAnnouncementStore } from '@/stores/domains/chat/announcement'
import { createLogger } from '@/utils/Logger'

export type AnnouncementData = {
  content: string
  top?: boolean
}

/** 横幅加载超时错误：仅用于在 finally 中安全复位加载态，不影响其它逻辑 */
class AnnouncementLoadTimeoutError extends Error {
  constructor(message = 'announcement load timeout') {
    super(message)
    this.name = 'AnnouncementLoadTimeoutError'
  }
}

/** 给 Promise 加超时保护，避免底层请求异常挂起导致调用方加载态永远无法复位 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new AnnouncementLoadTimeoutError()), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

export function useAnnouncementBanner(
  currentRoomId: Ref<string | null>,
  isGroup: Ref<boolean>,
  scrollContainerRef: Ref<HTMLElement | null>,
  scrollToBottom: () => void
) {
  const logger = createLogger('useAnnouncementBanner')
  const announcementStore = useAnnouncementStore()
  const topAnnouncement = ref<AnnouncementData | null>(null)
  // 横幅自身的加载态：与 store 共享的 isLoading 解耦，
  // 避免被 App.vue 会话切换 watch 等其它调用方反复置位而卡死转圈
  const isLoading = ref(false)
  let announcementUpdatedListener: UnlistenFn | null = null
  let announcementClearListener: UnlistenFn | null = null

  const loadTopAnnouncement = async (roomId?: string): Promise<void> => {
    const targetRoomId = roomId ?? currentRoomId.value

    if (!targetRoomId || !isGroup.value) {
      topAnnouncement.value = null
      isLoading.value = false
      return
    }

    isLoading.value = true
    try {
      // 底层加载加超时保护：即使请求异常挂起，横幅的加载态也一定会复位，
      // 不会再出现“一直转圈、点其它会话也不刷新”的死状态
      const data = await withTimeout(announcementStore.getGroupAnnouncementList(targetRoomId, 1, 1), 10000)
      if (targetRoomId !== currentRoomId.value) return

      if (data && data.records.length > 0) {
        const topNotice = data.records.find((item: Announcement) => item.top)
        const oldAnnouncement = topAnnouncement.value
        topAnnouncement.value = (topNotice as unknown as AnnouncementData) || null

        if (oldAnnouncement !== topAnnouncement.value) {
          const container = scrollContainerRef.value
          if (container) {
            const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
            if (distanceFromBottom <= 20) {
              nextTick(() => scrollToBottom())
            }
          }
        }
      } else {
        topAnnouncement.value = null
      }
    } catch (error) {
      if (error instanceof AnnouncementLoadTimeoutError) {
        logger.warn('获取置顶公告超时，已跳过该次加载')
      } else {
        logger.error('获取置顶公告失败:', error)
      }
      if (targetRoomId === currentRoomId.value) {
        topAnnouncement.value = null
      }
    } finally {
      isLoading.value = false
    }
  }

  watch(
    () => [currentRoomId.value, isGroup.value] as const,
    async ([roomId, isGroupChat], prevValue) => {
      const [prevRoomId, prevIsGroup] = prevValue ?? [undefined, undefined]
      if (!roomId || !isGroupChat) {
        topAnnouncement.value = null
        isLoading.value = false
        return
      }
      if (roomId === prevRoomId && prevIsGroup === isGroupChat) return
      await loadTopAnnouncement(roomId)
    },
    { immediate: true }
  )

  const initListeners = async (appWindow: {
    listen: <T>(event: string, callback: (e: { payload: T }) => void) => Promise<UnlistenFn>
  }) => {
    try {
      announcementUpdatedListener = await appWindow.listen<{ roomId: string }>('announcementUpdated', async (event) => {
        if (event.payload.roomId === currentRoomId.value) await loadTopAnnouncement()
      })
      announcementClearListener = await appWindow.listen<{ roomId: string }>('announcementClear', async (event) => {
        if (event.payload.roomId === currentRoomId.value) topAnnouncement.value = null
      })
    } catch (error) {
      logger.error('Failed to initialize announcement listeners:', error)
    }
  }

  const cleanupListeners = () => {
    announcementUpdatedListener?.()
    announcementClearListener?.()
  }

  return {
    topAnnouncement,
    isLoading,
    loadTopAnnouncement,
    initListeners,
    cleanupListeners
  }
}
