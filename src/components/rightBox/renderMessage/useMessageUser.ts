import { computed, type Ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { matrixContactService } from '@/services/matrix/user/MatrixContactService'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'
import { toFriendInfoPage } from '@/utils/RouterUtils'

const logger = createLogger('useMessageUser')

export function useMessageUser(
  props: {
    message: MessageType
    fromUser?: { uid?: string }
    isGroup: boolean
  },
  options: {
    selectKey: Ref<string>
  }
) {
  const { t } = useI18n()
  const { selectKey } = options
  const userStore = useUserStore()
  const groupStore = useGroupStore()
  const _settingStore = useSettingStore()
  const resolvingUserSet = new Set<string>()
  const currentUserUid = computed(() => userStore.userInfo?.uid ?? '')
  const senderUid = computed(() => props.fromUser?.uid || props.message?.fromUser?.uid || '')

  const isMe = computed(() => {
    return Boolean(senderUid.value) && senderUid.value === currentUserUid.value
  })

  const getAvatarSrc = computed(() => (uid: string) => {
    const isCurrentUser = Boolean(uid) && uid === currentUserUid.value
    const storeUser = groupStore.getUserInfo(uid)
    if (isMe.value && isCurrentUser) {
      return AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar as string)
    }
    const resolvedAvatar = storeUser?.avatar || (uid === senderUid.value ? props.message?.fromUser?.avatar : '')
    return AvatarUtils.getAvatarUrl(resolvedAvatar as string)
  })

  const senderDisplayName = computed(() => {
    const uid = senderUid.value
    const displayName = uid ? groupStore.getUserDisplayName(uid) : ''
    if (displayName) {
      return displayName
    }

    const storeUser = uid ? groupStore.getUserInfo(uid) : null
    if (storeUser?.myName || storeUser?.name) {
      return storeUser.myName || storeUser.name || ''
    }

    return props.message?.fromUser?.username || t('message_container.unknown_user')
  })

  const ensureSenderInfo = async (uid: string) => {
    if (!uid || resolvingUserSet.has(uid)) return
    const cachedUser = groupStore.getUserInfo(uid)
    if (cachedUser?.name || cachedUser?.myName || cachedUser?.avatar) return
    const roomId = props.message?.message?.roomId
    if (!roomId) return
    resolvingUserSet.add(uid)
    try {
      const users = await matrixContactService.getUserByIds([uid])
      const user = Array.isArray(users) ? users[0] : null
      if (user?.uid) {
        groupStore.updateUserItem(user.uid, user, roomId)
      }
    } catch (error) {
      logger.error('拉取缺失用户信息失败:', error)
    } finally {
      resolvingUserSet.delete(uid)
    }
  }

  watchEffect(() => {
    const uid = senderUid.value
    if (!uid) return
    if (!senderDisplayName.value || senderDisplayName.value === t('message_container.unknown_user')) {
      ensureSenderInfo(uid)
    }
  })

  const handleMentionUser = () => {
    if (!props.isGroup || isMe.value) return
    const targetUid = senderUid.value
    if (!targetUid) return
    useMitt.emit(MittEnum.AT, targetUid)
  }

  const handleAvatarClick = (uid: string, msgId: string) => {
    if (!uid) return
    if (isMobile()) {
      toFriendInfoPage(uid)
    } else {
      selectKey.value = msgId
    }
  }

  return {
    isMe,
    getAvatarSrc,
    senderDisplayName,
    handleMentionUser,
    handleAvatarClick
  }
}
