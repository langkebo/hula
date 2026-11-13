import { useDebounceFn } from '@vueuse/core'
import { showFailToast, showToast } from 'vant'
import { useI18n } from 'vue-i18n'
import { matrixFriendOperations, userDirectoryService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

export interface UserSearchResult {
  userId: string
  avatarUrl?: string | undefined
  displayName?: string | undefined
}

/**
 * 全局用户搜索（走 Matrix 用户目录），与好友列表本地过滤相互独立。
 */
export function useFriendUserSearch() {
  const { t } = useI18n()
  const logger = createLogger('FriendsIndex')

  const searchKeyword = ref('')
  const userSearchResults = ref<UserSearchResult[]>([])
  const userSearchLoading = ref(false)
  const hasUserSearched = ref(false)
  const addingFriend = ref<string | null>(null)

  const onUserSearch = useDebounceFn(async (value: string) => {
    if (!value?.trim()) {
      userSearchResults.value = []
      hasUserSearched.value = false
      return
    }

    userSearchLoading.value = true
    hasUserSearched.value = true
    try {
      const results = await userDirectoryService.searchUsers(value.trim(), 20)
      userSearchResults.value = results
    } catch (e) {
      logger.error('User search failed:', e)
      showFailToast(e instanceof Error ? e.message : String(e) || t('mobile_contact.search_failed'))
      userSearchResults.value = []
    } finally {
      userSearchLoading.value = false
    }
  }, 400)

  async function handleAddFriendBySearch(userId: string) {
    addingFriend.value = userId
    try {
      await matrixFriendOperations.sendFriendRequest(userId)
      showToast({ type: 'success', message: t('mobile_contact.add_friend_success') })
    } catch (e) {
      logger.error('Send friend request failed:', e)
      showFailToast(e instanceof Error ? e.message : String(e) || t('mobile_contact.add_friend_failed'))
    } finally {
      addingFriend.value = null
    }
  }

  return {
    searchKeyword,
    userSearchResults,
    userSearchLoading,
    hasUserSearched,
    addingFriend,
    onUserSearch,
    handleAddFriendBySearch
  }
}
