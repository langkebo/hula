import { computed, ref } from 'vue'
import { MittEnum, RoomTypeEnum } from '@/enums'
import { useLinkSegments } from '@/hooks/useLinkSegments'
import { useMitt } from '@/hooks/useMitt'
import { useAnnouncementStore } from '@/stores/domains/chat/announcement'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AnnouncementDetail')

export function useAnnouncementDetail(deps: {
  getSelectedSessionType: () => number | undefined
  getSelectedSessionRoomId: () => string | undefined
  getGroupTopic: () => string | undefined
}) {
  const announcementStore = useAnnouncementStore()

  const announcementPreview = ref('')
  const announcementLoadFailed = ref(false)
  const { segments: announcementSegments, openLink: openAnnouncementLink } = useLinkSegments(announcementPreview)

  const showGroupInsights = computed(() => deps.getSelectedSessionType() === RoomTypeEnum.GROUP)
  const groupRoomId = computed(() => (showGroupInsights.value ? (deps.getSelectedSessionRoomId() ?? '') : ''))
  const canEditAnnouncement = computed(() => showGroupInsights.value && Boolean(announcementStore.isAddAnnoun))

  const handleOpenAnnouncement = () => {
    const roomId = groupRoomId.value
    if (!roomId) return
    useMitt.emit(MittEnum.OPEN_ANNOUNCEMENT_PANEL, { roomId })
  }

  const handleRetryAnnouncement = async () => {
    const roomId = groupRoomId.value
    if (!roomId) return

    try {
      await announcementStore.loadGroupAnnouncements(roomId)
      if (groupRoomId.value !== roomId) return
      announcementLoadFailed.value = Boolean(announcementStore.announError)
      announcementPreview.value =
        announcementStore.announcementContent || announcementStore.announList[0]?.content || deps.getGroupTopic() || ''
    } catch (error) {
      logger.warn('Failed to reload room announcements', { roomId, error })
      if (groupRoomId.value === roomId) {
        announcementLoadFailed.value = true
      }
    }
  }

  const resetAnnouncementState = () => {
    announcementPreview.value = ''
    announcementLoadFailed.value = false
  }

  const loadAnnouncementData = async (roomId: string) => {
    if (!roomId) return

    const result = await Promise.allSettled([announcementStore.loadGroupAnnouncements(roomId)])

    if (groupRoomId.value !== roomId) return

    if (result[0].status === 'fulfilled') {
      announcementLoadFailed.value = Boolean(announcementStore.announError)
      announcementPreview.value =
        announcementStore.announcementContent || announcementStore.announList[0]?.content || deps.getGroupTopic() || ''
      return
    }

    announcementLoadFailed.value = true
    announcementPreview.value = deps.getGroupTopic() || ''
  }

  return {
    announcementPreview,
    announcementLoadFailed,
    announcementSegments,
    openAnnouncementLink,
    canEditAnnouncement,
    handleOpenAnnouncement,
    handleRetryAnnouncement,
    resetAnnouncementState,
    loadAnnouncementData
  }
}
