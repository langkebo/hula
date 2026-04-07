import { ref, computed, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useGlobalStore } from '@/stores/global'
import { useGroupStore } from '@/stores/group'
import { useContactStore } from '@/stores/contacts'
import { useUserStore } from '@/stores/user'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useMyRoomInfoUpdater } from '@/hooks/useMyRoomInfoUpdater'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { RoomTypeEnum, NotificationTypeEnum, RoleEnum } from '@/enums'
import { IsAllUserEnum, type UserItem } from '@/services/types'

export function useChatHeaderState() {
  const { t } = useI18n()
  const globalStore = useGlobalStore()
  const groupStore = useGroupStore()
  const contactStore = useContactStore()
  const userStore = useUserStore()

  const { currentSession: activeItem, currentSessionRoomId } = storeToRefs(globalStore)
  const { resolveMyRoomNickname } = useMyRoomInfoUpdater()

  const sidebarShow = ref(false)
  const modalShow = ref(false)
  const showQRCodeModal = ref(false)
  const showManageGroupMemberModal = ref(false)
  const tips = ref('')
  const optionsType = ref<string | undefined>(undefined)

  const isEditingGroupName = ref(false)
  const editingGroupName = ref('')
  const localMyName = ref('')
  const localRemark = ref('')
  const pendingGroupInfo = ref<{
    groupName?: string
    myName?: string
    remark?: string
  } | null>(null)

  const isChannel = computed(
    () => activeItem.value?.hotFlag === IsAllUserEnum.Yes || currentSessionRoomId.value === '1'
  )

  const isBotUser = computed(() => activeItem.value?.account === 'BOT')

  const isGroupOwner = computed(() => {
    const session = activeItem.value
    if (!session || currentSessionRoomId.value === '1' || session.hotFlag === IsAllUserEnum.Yes) {
      return false
    }
    const currentUser = groupStore.userList.find((user) => user.uid === userStore.userInfo!.uid)
    return currentUser?.roleId === RoleEnum.LORD
  })

  const chatTargetUid = computed(() => {
    const session = activeItem.value
    if (!session || session.type === RoomTypeEnum.GROUP) return undefined
    return session.detailId
  })

  const { isOnline, statusIcon, statusTitle, hasCustomState } = useOnlineStatus(chatTargetUid)

  const shouldShowDeleteFriend = computed(() => {
    const session = activeItem.value
    if (!session || session.type === RoomTypeEnum.GROUP) return false
    return contactStore.contactsList.some((item) => item.uid === session.detailId)
  })

  const currentUserAvatar = computed(() => {
    const session = activeItem.value
    if (!session) return ''
    if (session.type === RoomTypeEnum.GROUP) {
      return AvatarUtils.getAvatarUrl(session.avatar)
    }
    if (session.detailId) {
      const detailUser = groupStore.getUserInfo(session.detailId)
      return AvatarUtils.getAvatarUrl(detailUser?.avatar || session.avatar)
    }
    return AvatarUtils.getAvatarUrl(session.avatar)
  })

  const userList = computed(() => {
    return groupStore.userList
      .map((item: UserItem) => {
        const { uid, ...userInfo } = item
        return {
          ...userInfo,
          ...groupStore.getUserInfo(item.uid)!,
          uid
        }
      })
      .sort((a, b) => Number(a.uid) - Number(b.uid))
      .slice(0, 10)
  })

  const messageSettingType = computed(() => {
    if (activeItem.value?.muteNotification === NotificationTypeEnum.NOT_DISTURB) {
      return activeItem.value?.shield ? 'shield' : 'notification'
    }
    return 'notification'
  })

  const messageSettingOptions = computed(() => [
    { label: t('home.chat_header.message_setting.receive_no_alert'), value: 'notification' },
    { label: t('home.chat_header.message_setting.shield'), value: 'shield' }
  ])

  const initLocalValues = () => {
    localMyName.value = resolveMyRoomNickname({
      roomId: currentSessionRoomId.value,
      myName: groupStore.myNameInCurrentGroup || ''
    })
    localRemark.value = groupStore.countInfo?.remark || ''
  }

  watch(
    () => groupStore.myNameInCurrentGroup,
    (newName) => {
      const normalized = resolveMyRoomNickname({
        roomId: currentSessionRoomId.value,
        myName: newName || ''
      })
      if (localMyName.value !== normalized) {
        localMyName.value = normalized
      }
    }
  )

  watch(
    () => currentSessionRoomId.value,
    () => {
      if (currentSessionRoomId.value) {
        nextTick(() => {
          initLocalValues()
        })
      }
    }
  )

  return {
    activeItem,
    currentSessionRoomId,
    sidebarShow,
    modalShow,
    showQRCodeModal,
    showManageGroupMemberModal,
    tips,
    optionsType,
    isEditingGroupName,
    editingGroupName,
    localMyName,
    localRemark,
    pendingGroupInfo,
    isChannel,
    isBotUser,
    isGroupOwner,
    isOnline,
    statusIcon,
    statusTitle,
    hasCustomState,
    shouldShowDeleteFriend,
    currentUserAvatar,
    userList,
    messageSettingType,
    messageSettingOptions,
    initLocalValues,
    t
  }
}
