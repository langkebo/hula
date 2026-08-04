import type { UnlistenFn } from '@tauri-apps/api/event'
import { nextTick, type Ref, ref, watch } from 'vue'
import type { Announcement } from '@/stores/domains/chat/announcement'
import { useAnnouncementStore } from '@/stores/domains/chat/announcement'
import { createLogger } from '@/utils/Logger'

export type AnnouncementData = {
  content: string
  top?: boolean
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
  let announcementUpdatedListener: UnlistenFn | null = null
  let announcementClearListener: UnlistenFn | null = null

  const loadTopAnnouncement = async (roomId?: string): Promise<void> => {
    if (announcementStore.isLoading) return
    const targetRoomId = roomId ?? currentRoomId.value

    if (!targetRoomId || !isGroup.value) {
      topAnnouncement.value = null
      return
    }

    try {
      const data = await announcementStore.getGroupAnnouncementList(targetRoomId, 1, 1)
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
      logger.error('获取置顶公告失败:', error)
      if (targetRoomId === currentRoomId.value) {
        topAnnouncement.value = null
      }
    }
  }

  watch(
    () => [currentRoomId.value, isGroup.value] as const,
    async ([roomId, isGroupChat], prevValue) => {
      const [prevRoomId, prevIsGroup] = prevValue ?? [undefined, undefined]
      if (!roomId || !isGroupChat) {
        topAnnouncement.value = null
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
    isLoading: announcementStore.isLoading,
    loadTopAnnouncement,
    initListeners,
    cleanupListeners
  }
}
