import { computed, type MaybeRefOrGetter, ref, toValue, watch } from 'vue'
import { matrixContactService } from '@/services/matrix/user/MatrixContactService'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'

type FriendConfirmTarget = {
  uid: string
  name: string
  account: string
  avatar: string
}

const emptyTarget = (): FriendConfirmTarget => ({
  uid: '',
  name: '',
  account: '',
  avatar: ''
})

export function useFriendRequestConfirm(defaultMessage?: MaybeRefOrGetter<string>) {
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const requestMsg = ref('')

  const targetUid = computed(() => String(globalStore.addFriendTargetUid || ''))
  const userInfo = computed<FriendConfirmTarget>(() => {
    const uid = targetUid.value
    if (!uid) return emptyTarget()

    const user = groupStore.getUserInfo(uid)
    return {
      uid,
      name: user?.name || '',
      account: user?.account || uid,
      avatar: user?.avatar || ''
    }
  })
  const avatarSrc = computed(() => AvatarUtils.getAvatarUrl(userInfo.value.avatar))

  const syncDefaultMessage = () => {
    requestMsg.value = String(toValue(defaultMessage) || '')
  }

  watch(() => toValue(defaultMessage), syncDefaultMessage)

  const submitRequest = async () => {
    if (!targetUid.value) return false
    await matrixContactService.sendAddFriendRequest(targetUid.value, requestMsg.value)
    return true
  }

  return {
    targetUid,
    userInfo,
    avatarSrc,
    requestMsg,
    syncDefaultMessage,
    submitRequest
  }
}
