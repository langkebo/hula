import { computed, type Ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
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
    fromUser: { uid: string }
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

  const isMe = computed(() => {
    return props.fromUser?.uid === userStore.userInfo!.uid
  })

  const getAvatarSrc = computed(() => (uid: string) => {
    const isCurrentUser = uid === userStore.userInfo?.uid
    const storeUser = groupStore.getUserInfo(uid)
    if (isMe.value && isCurrentUser) {
      return AvatarUtils.getAvatarUrl(userStore.userInfo!.avatar as string)
    }
    const resolvedAvatar = storeUser?.avatar || (uid === props.fromUser.uid ? props.message.fromUser.avatar : '')
    return AvatarUtils.getAvatarUrl(resolvedAvatar as string)
  })

  const senderDisplayName = computed(() => {
    const displayName = groupStore.getUserDisplayName(props.fromUser.uid)
    if (displayName) {
      return displayName
    }

    const storeUser = groupStore.getUserInfo(props.fromUser.uid)
    if (storeUser?.myName || storeUser?.name) {
      return storeUser.myName || storeUser.name || ''
    }

    return props.message.fromUser.username || t('message_container.unknown_user')
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
    if (!senderDisplayName.value || senderDisplayName.value === t('message_container.unknown_user')) {
      ensureSenderInfo(props.fromUser.uid)
    }
  })

  const handleMentionUser = () => {
    if (!props.isGroup || isMe.value) return
    const targetUid = props.fromUser?.uid
    if (!targetUid) return
    useMitt.emit(MittEnum.AT, targetUid)
  }

  const handleAvatarClick = (uid: string, msgId: string) => {
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
