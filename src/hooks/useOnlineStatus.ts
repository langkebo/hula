import { storeToRefs } from 'pinia'
import { type ComputedRef, computed, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { OnlineEnum } from '@/enums'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'

// 在线状态管理(仅是在线和离线)
export const useOnlineStatus = (uid?: ComputedRef<string | undefined> | Ref<string | undefined>) => {
  const { t } = useI18n()
  const userStore = useUserStore()
  const groupStore = useGroupStore()
  const contactStore = useContactStore()
  const userStatusStore = useUserStatusStore()
  const { currentState } = storeToRefs(userStatusStore)

  const resolvedUid = computed(() => uid?.value || userStore.userInfo?.uid)

  const currentUser = computed(() => {
    const currentUid = resolvedUid.value
    if (!currentUid) return undefined

    if (userStore.userInfo?.uid === currentUid) {
      return userStore.userInfo
    }

    return groupStore.getUserInfo(currentUid) ?? contactStore.getContactByUserId(currentUid) ?? undefined
  })

  const userStateId = uid
    ? computed(() => (currentUser.value as { userStateId?: string } | undefined)?.userStateId)
    : computed(
        () =>
          userStore.userInfo?.userStateId ?? (currentUser.value as { userStateId?: string } | undefined)?.userStateId
      )

  const activeStatus = computed(() => {
    if (!uid) {
      return userStore.userInfo?.activeStatus ?? currentUser.value?.activeStatus ?? OnlineEnum.OFFLINE
    }

    return currentUser.value?.activeStatus ?? OnlineEnum.OFFLINE
  })

  const hasCustomState = computed(() => {
    const stateId = userStateId.value
    return !!stateId && stateId !== '0'
  })

  const userStatus = computed(() => {
    if (!userStateId.value) return null
    return userStatusStore.stateList.find((state: { id: string }) => state.id === userStateId.value)
  })

  const isOnline = computed(() => activeStatus.value === OnlineEnum.ONLINE)

  const statusIcon = computed(() => {
    if (hasCustomState.value && userStatus.value?.url) {
      return userStatus.value.url
    }
    return isOnline.value ? '/status/online.png' : '/status/offline.png'
  })

  const statusTitle = computed(() => {
    if (hasCustomState.value && userStatus.value?.title) {
      const key = `auth.onlineStatus.states.${userStatus.value.title}`
      const translated = t(key)
      return translated === key ? userStatus.value.title : translated
    }
    return isOnline.value ? t('home.profile_card.status.online') : t('home.profile_card.status.offline')
  })

  const statusBgColor = computed(() => {
    if (hasCustomState.value && userStatus.value?.bgColor) {
      return userStatus.value.bgColor
    }
    return isOnline.value ? 'rgba(26, 178, 146, 0.4)' : 'rgba(144, 144, 144, 0.4)'
  })

  return {
    currentState,
    activeStatus,
    statusIcon,
    statusTitle,
    statusBgColor,
    isOnline,
    hasCustomState,
    userStatus
  }
}
