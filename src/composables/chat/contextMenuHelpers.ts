import { nextTick } from 'vue'
import type { useI18n } from 'vue-i18n'
import type { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { MergeMessageType, MittEnum, MsgEnum } from '@/enums'
import type { MessageType, useChatStore } from '@/stores/domains/chat/chat'
import type { useContactStore } from '@/stores/domains/chat/contacts'
import type { useUserStore } from '@/stores/domains/user/user'

/** 右键菜单辅助函数工厂依赖 */
export type ContextMenuHelperDeps = {
  t: ReturnType<typeof useI18n>['t']
  showFeedback: ReturnType<typeof useActionFeedback>['showFeedback']
  chatStore: ReturnType<typeof useChatStore>
  contactStore: ReturnType<typeof useContactStore>
  userStore: ReturnType<typeof useUserStore>
}

/**
 * 右键菜单辅助函数工厂
 *
 * 从 useChatContextMenus 抽离的纯辅助逻辑：好友关系判断、转发、复制类型判断等。
 * 所有 Pinia store 与 i18n 反馈函数均通过 deps 注入，子模块内不直接调用 useXxxStore()。
 */
export const createContextMenuHelpers = (deps: ContextMenuHelperDeps) => {
  const { t, showFeedback, chatStore, contactStore, userStore } = deps

  /**
   * 检查用户关系
   * @param uid 用户ID
   * @param type 检查类型: 'friend' - 仅好友, 'all' - 好友或自己
   */
  const checkFriendRelation = (uid: string, type: 'friend' | 'all' = 'all') => {
    const myUid = userStore.userInfo?.uid ?? ''
    const isFriend = contactStore.contactsList.some((item) => item.uid === uid)
    return type === 'friend' ? isFriend && uid !== myUid : isFriend || uid === myUid
  }

  /** 通用右键菜单 */
  const handleForward = async (item: MessageType) => {
    if (!item?.message?.id) return
    const target = chatStore.getMessage(item.message.id)
    if (!target) {
      return
    }
    chatStore.clearMsgCheck()
    target.isCheck = true
    chatStore.setMsgMultiChoose(true, 'forward')
    await nextTick()
    useMitt.emit(MittEnum.MSG_MULTI_CHOOSE, {
      action: 'open-forward',
      mergeType: MergeMessageType.SINGLE
    })
  }

  // 不能复制的消息类型
  const copyDisabledTypes: MsgEnum[] = [MsgEnum.NOTICE, MsgEnum.MERGE, MsgEnum.LOCATION, MsgEnum.BEACON, MsgEnum.VOICE]

  // 不能回复的消息类型
  const shouldHideCopy = (item: MessageType) => copyDisabledTypes.includes(item.message.type)
  const isNoticeMessage = (item: MessageType) => item.message.type === MsgEnum.NOTICE
  const showComingSoon = () => showFeedback(t('home.chat_main.feature.coming_soon'), 'warning')

  return { checkFriendRelation, handleForward, shouldHideCopy, isNoticeMessage, showComingSoon }
}

export type ContextMenuHelpers = ReturnType<typeof createContextMenuHelpers>
