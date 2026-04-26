import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import { matrixGroupService } from '@/services/matrix'
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
    const group = globalStore.addGroupModalInfo
    return {
      name: group.name || '',
      avatar: group.avatar || '',
      account: group.account || ''
    }
  })

  const syncDefaultMessage = () => {
    requestMsg.value = String(toValue(defaultMessage) || '')
  }

  watch(() => toValue(defaultMessage), syncDefaultMessage)

  const submitRequest = async () => {
    if (!userInfo.value.account) return false
    await matrixGroupService.applyGroup(String(userInfo.value.account))
    return true
  }

  return {
    userInfo,
    requestMsg,
    syncDefaultMessage,
    submitRequest
  }
}
