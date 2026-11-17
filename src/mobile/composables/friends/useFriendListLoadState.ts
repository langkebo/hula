import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { resolveFriendListViewState } from '@/components/friend/friendListViewState'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useFriends } from '@/composables/useFriends'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { createLogger } from '@/utils/Logger'

export interface FriendUserState {
  id: string
  title?: string | undefined
  url?: string | undefined
}

export type FriendListViewState = ReturnType<typeof resolveFriendListViewState>

/**
 * 好友列表的加载态、空态与下拉刷新。
 */
export function useFriendListLoadState() {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const logger = createLogger('FriendsIndex')
  const contactStore = useContactStore()

  const {
    groupChatList,
    specialContacts,
    blockedContacts,
    normalContacts,
    contactUnreadCount,
    selectedItem: activeItem,
    isBotUser,
    getUserState,
    setSelectedItem,
    clearSelectedItem,
    loading: friendsLoading,
    initialLoading: friendsInitialLoading,
    initialize: initializeFriends
  } = useFriends()

  const refreshing = ref(false)
  const mobileFriendErrorMessage = ref('')

  const isMobileFriendStateLoading = computed(() => friendsInitialLoading.value || friendsLoading.value)

  const mobileFriendViewState = computed<FriendListViewState>(() =>
    resolveFriendListViewState({
      hasError: Boolean(mobileFriendErrorMessage.value),
      hasFriends: specialContacts.value.length > 0 || normalContacts.value.length > 0
    })
  )

  /** 下拉刷新：复用 useFriends().initialize()（内部即 contactStore.getContactList(true) + 特别关注刷新） */
  const handlePullRefresh = async () => {
    refreshing.value = true
    try {
      await initializeFriends()
      if (contactStore.lastFriendError) {
        showFeedback(t('mobile_contact.refresh_failed'), 'error')
      }
    } catch (error) {
      logger.error('Failed to refresh friend list', error)
      showFeedback(t('mobile_contact.refresh_failed'), 'error')
    } finally {
      refreshing.value = false
    }
  }

  const handleRetryMobileFriends = async () => {
    mobileFriendErrorMessage.value = ''
    try {
      await contactStore.getContactList(true)
    } catch (error) {
      mobileFriendErrorMessage.value = error instanceof Error ? error.message : t('common.error')
    } finally {
      // 重试结束必须退出「初始加载」态，否则 loading 分支优先级更高，错误态永远看不到
      friendsInitialLoading.value = false
    }
  }

  /** 页面挂载时的首次加载：必须走 useFriends().initialize()（`initialLoading` 只在那里被置 false） */
  const initializePage = async () => {
    try {
      // 历史缺陷：这里只调了 contactStore.getContactList()，于是 `initialLoading` 永为 true，
      // 页面永远停在 van-loading，分组与好友行一个都不渲染（好友卡片因此「0 行」）。
      await initializeFriends()
      await contactStore.getApplyPage('friend', false)
    } catch (_error) {
      logger.debug('Failed to request friend request list')
    }
  }

  return {
    groupChatList,
    specialContacts,
    normalContacts,
    blockedContacts,
    contactUnreadCount,
    activeItem,
    isBotUser,
    getUserState,
    setSelectedItem,
    clearSelectedItem,
    refreshing,
    mobileFriendErrorMessage,
    isMobileFriendStateLoading,
    mobileFriendViewState,
    handlePullRefresh,
    handleRetryMobileFriends,
    initializePage
  }
}
