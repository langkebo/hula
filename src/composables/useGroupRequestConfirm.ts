import { computed, type MaybeRefOrGetter, ref, toValue, watch } from 'vue'
import { matrixRoomMembershipService } from '@/services/matrix/room/MembershipService'
import { useGlobalStore } from '@/stores/domains/widget/global'

type GroupConfirmTarget = {
  name: string
  avatar: string
  account: string
}

export function useGroupRequestConfirm(defaultMessage?: MaybeRefOrGetter<string>) {
  const globalStore = useGlobalStore()
  const requestMsg = ref('')

  const userInfo = computed<GroupConfirmTarget>(() => {
    return {
      name: globalStore.addGroupTargetName || '',
      avatar: globalStore.addGroupTargetAvatar || '',
      account: globalStore.addGroupTargetAccount || ''
    }
  })

  const syncDefaultMessage = () => {
    requestMsg.value = String(toValue(defaultMessage) || '')
  }

  watch(() => toValue(defaultMessage), syncDefaultMessage)

  const submitRequest = async () => {
    if (!userInfo.value.account) return false
    await matrixRoomMembershipService.joinRoom(String(userInfo.value.account))
    return true
  }

  return {
    userInfo,
    requestMsg,
    syncDefaultMessage,
    submitRequest
  }
}
