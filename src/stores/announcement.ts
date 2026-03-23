import { defineStore } from 'pinia'
import { StoresEnum } from '@/enums'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useUserStore } from '@/stores/user'
import { matrixRoomService } from '@/services/matrix'

export interface Announcement {
  id: string
  content: string
  top: boolean
  author: string
  timestamp: number
}

export const useAnnouncementStore = defineStore(StoresEnum.ANNOUNCEMENT, () => {
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const userStore = useUserStore()

  const announList = ref<Announcement[]>([])
  const announNum = ref(0)
  const announError = ref(false)
  const isAddAnnoun = ref(false)

  const announcementContent = computed(() => (announList.value.length > 0 ? (announList.value[0]?.content ?? '') : ''))

  const canAddAnnouncement = computed(() => {
    if (!userStore.userInfo?.uid) return false

    const isLord = groupStore.isCurrentLord(userStore.userInfo.uid) ?? false
    const isAdmin = groupStore.isAdmin(userStore.userInfo.uid) ?? false

    const hasBadge6 = () => {
      if (globalStore.currentSessionRoomId !== '1') return false

      const currentUser = groupStore.getUserInfo(userStore.userInfo!.uid)
      return currentUser?.itemIds?.includes('6') ?? false
    }

    return isLord || isAdmin || hasBadge6()
  })

  const clearAnnouncements = () => {
    announList.value = []
    announNum.value = 0
    announError.value = false
  }

  const formatRecords = (records: Announcement[]): Announcement[] => {
    if (!records || records.length === 0) return []
    const topAnnouncement = records.find((item) => item.top)
    if (!topAnnouncement) return records
    return [topAnnouncement, ...records.filter((item) => !item.top)]
  }

  const loadGroupAnnouncements = async (roomId?: string) => {
    const targetRoomId = roomId ?? globalStore.currentSessionRoomId
    if (!targetRoomId) {
      console.error('当前会话没有roomId')
      return
    }

    try {
      isAddAnnoun.value = canAddAnnouncement.value

      const room = await matrixRoomService.getRoom(targetRoomId)
      if (!room) {
        announList.value = []
        announNum.value = 0
        return
      }

      if (targetRoomId !== globalStore.currentSessionRoomId) {
        return
      }

      const announcements: Announcement[] = []

      const topic = room.currentState.getStateEvents('m.room.topic' as any, '')
      if (topic) {
        const content = topic.getContent()
        announcements.push({
          id: topic.getId() || 'topic',
          content: (content.topic as string) || '',
          top: true,
          author: topic.getSender() || '',
          timestamp: topic.getTs?.() || Date.now()
        })
      }

      const pinnedEvents = room.currentState.getStateEvents('m.room.pinned_events' as any, '')
      if (pinnedEvents) {
        const content = pinnedEvents.getContent()
        if (content.pinned && Array.isArray(content.pinned)) {
          for (const eventId of content.pinned) {
            const event = room.findEventById?.(eventId)
            if (event) {
              announcements.push({
                id: event.getId() || eventId,
                content: (event.getContent()?.body as string) || '',
                top: false,
                author: event.getSender() || '',
                timestamp: event.getTs?.() || Date.now()
              })
            }
          }
        }
      }

      announList.value = formatRecords(announcements)
      announNum.value = announcements.length
      announError.value = false
    } catch (error) {
      console.error('加载群公告失败:', error)
      if (targetRoomId === globalStore.currentSessionRoomId) {
        announError.value = true
      }
    }
  }

  const getGroupAnnouncementList = async (roomId: string, _page: number, _pageSize: number) => {
    await loadGroupAnnouncements(roomId)
    return {
      records: announList.value.map((item, index) => ({
        ...item,
        uid: item.author,
        userName: item.author,
        id: item.id || `ann-${index}`,
        top: item.top
      })),
      total: announList.value.length
    }
  }

  return {
    announList,
    announNum,
    announError,
    isAddAnnoun,
    announcementContent,
    canAddAnnouncement,
    loadGroupAnnouncements,
    getGroupAnnouncementList,
    clearAnnouncements
  }
})
