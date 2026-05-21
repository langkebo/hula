import { computed, ref } from 'vue'
import { OnlineEnum, RoomTypeEnum } from '@/enums'
import { useGroupStore } from '@/stores/domains/chat/group'
import type { MatrixGroupInfo, MatrixRoomMember } from '@/stores/domains/chat/group/types'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('GroupDetail')

export function useGroupDetail(deps: {
  getSelectedSessionType: () => number | undefined
  getSelectedSessionRoomId: () => string | undefined
  onRoomIdChange: (callback: (roomId: string | undefined) => void) => void
}) {
  const groupStore = useGroupStore()

  const detailGroupInfo = ref<MatrixGroupInfo | null>(null)
  const detailMembers = ref<MatrixRoomMember[]>([])
  const memberLoadFailed = ref(false)

  const showGroupInsights = computed(() => deps.getSelectedSessionType() === RoomTypeEnum.GROUP)
  const groupRoomId = computed(() => (showGroupInsights.value ? (deps.getSelectedSessionRoomId() ?? '') : ''))
  const groupMemberCount = computed(
    () => detailGroupInfo.value?.memberCount ?? detailGroupInfo.value?.memberNum ?? detailMembers.value.length
  )
  const groupOnlineCount = computed(() => {
    const hasPresence = detailMembers.value.some((member) => typeof member.activeStatus === 'number')
    if (!hasPresence) {
      return detailMembers.value.length
    }
    return detailMembers.value.filter((member) => member.activeStatus === OnlineEnum.ONLINE).length
  })

  const handleRetryMembers = async () => {
    const roomId = groupRoomId.value
    if (!roomId) return

    try {
      const members = await groupStore.loadRoomMembers(roomId, true)
      if (groupRoomId.value !== roomId) return
      detailMembers.value = members.length ? members : groupStore.getMembersByRoomId(roomId)
      memberLoadFailed.value = detailMembers.value.length === 0
    } catch (error) {
      logger.warn('Failed to reload room members', { roomId, error })
      if (groupRoomId.value === roomId) {
        memberLoadFailed.value = true
      }
    }
  }

  const resetGroupState = () => {
    detailGroupInfo.value = null
    detailMembers.value = []
    memberLoadFailed.value = false
  }

  const loadGroupData = async (roomId: string) => {
    if (!roomId) return

    const [groupInfoResult, membersResult] = await Promise.allSettled([
      groupStore.loadGroupInfo(roomId),
      groupStore.loadRoomMembers(roomId)
    ])

    if (groupRoomId.value !== roomId) return

    const cachedGroupInfo = groupStore.getGroupDetailByRoomId(roomId)
    const cachedMembers = groupStore.getMembersByRoomId(roomId)
    detailGroupInfo.value =
      groupInfoResult.status === 'fulfilled'
        ? (groupInfoResult.value ?? cachedGroupInfo ?? null)
        : (cachedGroupInfo ?? null)
    detailMembers.value =
      membersResult.status === 'fulfilled'
        ? membersResult.value.length
          ? membersResult.value
          : cachedMembers
        : cachedMembers
    memberLoadFailed.value = membersResult.status === 'rejected' && detailMembers.value.length === 0
  }

  return {
    detailGroupInfo,
    detailMembers,
    memberLoadFailed,
    showGroupInsights,
    groupRoomId,
    groupMemberCount,
    groupOnlineCount,
    handleRetryMembers,
    resetGroupState,
    loadGroupData
  }
}
