import { ref } from 'vue'
import type { MatrixRoomMember } from '@/stores/domains/chat/group/types'

export function useMemberSelection() {
  const showAllMembers = ref(false)
  const showMemberDirectory = ref(false)
  const selectedMemberUid = ref('')
  const selectedMemberActiveStatus = ref<MatrixRoomMember['activeStatus'] | undefined>(undefined)

  const handleMemberClick = (member: MatrixRoomMember, onSwitchToMembersTab: () => void) => {
    const uid = member.uid || member.userId
    if (!uid) return
    selectedMemberUid.value = uid
    selectedMemberActiveStatus.value = member.activeStatus
    onSwitchToMembersTab()
  }

  const openMembersMode = (showDirectory: boolean = false, onSwitchToMembersTab: () => void) => {
    onSwitchToMembersTab()
    showMemberDirectory.value = showDirectory
  }

  const clearSelectedMember = () => {
    selectedMemberUid.value = ''
    selectedMemberActiveStatus.value = undefined
  }

  const resetMemberState = () => {
    showAllMembers.value = false
    showMemberDirectory.value = false
    clearSelectedMember()
  }

  return {
    showAllMembers,
    showMemberDirectory,
    selectedMemberUid,
    selectedMemberActiveStatus,
    handleMemberClick,
    openMembersMode,
    clearSelectedMember,
    resetMemberState
  }
}
