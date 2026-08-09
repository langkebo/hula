import { watch } from 'vue'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'

const getMessageSenderUid = (message: MessageType): string => {
  return message.fromUser?.uid ?? ''
}

/**
 * Batch preload avatar URLs when the message list changes
 * to avoid lazy-load waterfall.
 */
export const useAvatarPreloader = () => {
  const chatStore = useChatStore()
  const groupStore = useGroupStore()

  watch(
    () => chatStore.chatMessageList,
    (msgs) => {
      if (!msgs?.length) return
      const avatarUrls = new Set<string>()
      for (const item of msgs) {
        const uid = getMessageSenderUid(item)
        if (!uid) continue
        const storeUser = groupStore.getUserInfo(uid)
        if (storeUser?.avatar) avatarUrls.add(storeUser.avatar)
      }
      if (avatarUrls.size > 0) {
        AvatarUtils.batchResolve([...avatarUrls], 68)
      }
    },
    { immediate: true }
  )
}
