import { useDebounceFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, type MaybeRefOrGetter, ref, toValue, watch } from 'vue'
import { OnlineEnum, UserType } from '@/enums'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { type GroupSearchResult, matrixRoomQueryService } from '@/services/matrix/room/QueryService'
import type { UserProfile } from '@/services/matrix/user/MatrixContactService'
import { matrixContactService } from '@/services/matrix/user/MatrixContactService'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createFriendGroupService } from './friends/friendGroupService'
import {
  buildNormalContacts,
  type FriendSearchResult,
  type FriendSearchType,
  filterRecommendedUsers,
  type GroupSearchViewItem,
  resolveFriendSearchAction,
  type SearchPredicates,
  sortBlockedContactsByTime,
  sortContactsByOnlineStatus,
  sortFriendSearchResults,
  sortGroupChatList,
  type UserSearchResult
} from './friends/friendSearchUtils'

// Re-export to preserve the public API of this module.
export type { FriendGroup } from '@/services/matrix/friends/MatrixFriendService'
export type { FriendSearchResult, GroupSearchViewItem, UserSearchResult } from './friends/friendSearchUtils'
export {
  buildNormalContacts,
  filterRecommendedUsers,
  resolveFriendSearchAction,
  sortBlockedContactsByTime,
  sortContactsByOnlineStatus,
  sortFriendSearchResults,
  sortGroupChatList,
  sortNormalContacts
} from './friends/friendSearchUtils'

type UserStateItem = { id: string; title?: string; url?: string }

type FriendConfirmTarget = { uid: string; name: string; account: string; avatar: string }

export function useFriends(options?: { defaultRequestMessage?: MaybeRefOrGetter<string> }) {
  const contactStore = useContactStore()
  const groupStore = useGroupStore()
  const globalStore = useGlobalStore()
  const userStore = useUserStore()
  const userStatusStore = useUserStatusStore()
  const { stateList } = storeToRefs(userStatusStore)
  const friendGroupService = createFriendGroupService()

  const searchType = ref<FriendSearchType>('recommend')
  const searchValue = ref('')
  const searchResults = ref<FriendSearchResult[]>([])
  const hasSearched = ref(false)
  const loading = ref(false)
  const initialLoading = ref(true)
  const favoriteIds = ref<Set<string>>(new Set())
  const selectedItem = ref('')
  const requestMsg = ref('')

  const friendIds = computed(() => new Set(contactStore.contactsList.map((contact) => String(contact.uid))))
  const joinedGroupIds = computed(() => new Set(groupStore.groupDetails.map((group) => String(group.roomId))))
  const currentUserId = computed(() => String(userStore.userInfo?.uid || ''))

  const isFriend = (uid: string) => friendIds.value.has(String(uid))
  const isCurrentUser = (uid: string) => currentUserId.value === String(uid)
  const isInGroup = (roomId: string) => joinedGroupIds.value.has(String(roomId))
  const isBotUser = (uid: string) => groupStore.getUserInfo(uid)?.account === UserType.BOT

  const predicates: SearchPredicates = { isCurrentUser, isFriend, isInGroup }

  const groupChatList = computed(() => sortGroupChatList(groupStore.groupDetails))
  const onlineCount = computed(
    () => contactStore.contactsList.filter((item) => item.activeStatus === OnlineEnum.ONLINE).length
  )
  const specialContacts = computed(() => sortContactsByOnlineStatus(contactStore.favoriteContacts))
  const specialOnlineCount = computed(
    () => specialContacts.value.filter((item) => item.activeStatus === OnlineEnum.ONLINE).length
  )
  const blockedContacts = computed(() => sortBlockedContactsByTime(contactStore.blockedContacts))
  const normalContacts = computed(() =>
    buildNormalContacts(contactStore.contactsList, specialContacts.value, blockedContacts.value, isBotUser)
  )
  const normalOnlineCount = computed(() => Math.max(onlineCount.value - specialOnlineCount.value, 0))
  const contactUnreadCount = computed(() => globalStore.contactUnreadCount)

  const targetUid = computed(() => String(globalStore.addFriendTargetUid || ''))
  const userInfo = computed<FriendConfirmTarget>(() => {
    const uid = targetUid.value
    if (!uid) return { uid: '', name: '', account: '', avatar: '' }
    const user = groupStore.getUserInfo(uid)
    return { uid, name: user?.name || '', account: user?.account || uid, avatar: user?.avatar || '' }
  })
  const avatarSrc = computed(() => AvatarUtils.getAvatarUrl(userInfo.value.avatar))

  const getRecommendedUsers = (keyword = '') =>
    sortFriendSearchResults(
      filterRecommendedUsers(groupStore.allUserInfo, favoriteIds.value, keyword),
      'recommend',
      predicates
    )

  const clearSearchResults = (clearKeyword = true) => {
    searchResults.value = []
    hasSearched.value = false
    if (clearKeyword) {
      searchValue.value = ''
    }
  }

  const refreshFavoriteIds = async () => {
    try {
      favoriteIds.value = new Set(await matrixFriendService.getSpecialFriends())
    } catch {
      favoriteIds.value = new Set()
    }
  }

  const executeSearch = async () => {
    const keyword = searchValue.value.trim()

    if (!keyword) {
      if (searchType.value === 'recommend') {
        searchResults.value = getRecommendedUsers()
      } else {
        searchResults.value = []
        hasSearched.value = false
      }
      return
    }

    loading.value = true
    hasSearched.value = true

    try {
      if (searchType.value === 'group') {
        const groups = await matrixRoomQueryService.searchGroup(keyword)
        searchResults.value = sortFriendSearchResults(
          groups.map(
            (group: GroupSearchResult): GroupSearchViewItem => ({
              account: group.account,
              name: group.name,
              avatar: group.avatar || '',
              deleteStatus: group.deleteStatus ? 1 : 0,
              extJson: group.extJson,
              roomId: group.roomId
            })
          ),
          'group',
          predicates
        )
        return
      }

      if (searchType.value === 'user') {
        await refreshFavoriteIds()
        const users = await matrixContactService.searchFriend(keyword)
        searchResults.value = sortFriendSearchResults(
          users.map(
            (user: UserProfile): UserSearchResult => ({
              uid: user.userId,
              name: user.displayName || user.userId,
              avatar: user.avatarUrl || '',
              account: user.userId,
              isFavorite: favoriteIds.value.has(user.userId)
            })
          ),
          'user',
          predicates
        )
        return
      }

      searchResults.value = getRecommendedUsers(keyword)
    } finally {
      loading.value = false
    }
  }

  const handleSearch = useDebounceFn(executeSearch, 300)

  const handleClear = () => {
    clearSearchResults()
    if (searchType.value === 'recommend') {
      searchResults.value = getRecommendedUsers()
    }
  }

  const handleTypeChange = (nextType?: FriendSearchType) => {
    if (nextType) {
      searchType.value = nextType
    }
    clearSearchResults()
    if (searchType.value === 'recommend') {
      searchResults.value = getRecommendedUsers()
    }
  }

  const initialize = async () => {
    try {
      await Promise.allSettled([contactStore.getContactList(true), refreshFavoriteIds()])
      if (searchType.value === 'recommend') {
        searchResults.value = getRecommendedUsers()
      }
    } finally {
      initialLoading.value = false
    }
  }

  const getActionKind = (item: FriendSearchResult) => resolveFriendSearchAction(item, searchType.value, predicates)

  const getUserState = (uid: string): UserStateItem | null => {
    const userInfo = groupStore.getUserInfo(uid)
    const userStateId = userInfo?.userStateId
    if (userStateId && userStateId !== '1') {
      return (stateList.value.find((state: UserStateItem) => state.id === userStateId) as UserStateItem) || null
    }
    return null
  }

  const setSelectedItem = (id: string) => {
    selectedItem.value = String(id || '')
  }

  const clearSelectedItem = () => {
    selectedItem.value = ''
  }

  const isSelected = (id: string) => selectedItem.value === String(id || '')

  const syncDefaultMessage = () => {
    requestMsg.value = String(toValue(options?.defaultRequestMessage) || '')
  }

  watch(() => toValue(options?.defaultRequestMessage), syncDefaultMessage)

  const submitRequest = async () => {
    if (!targetUid.value) return false
    await matrixContactService.sendAddFriendRequest(targetUid.value, requestMsg.value)
    return true
  }

  const getFriendSuggestions = async () => matrixFriendService.getFriendSuggestions()

  const searchFriendsViaApi = async (query: string, options?: { mode?: 'fuzzy' | 'exact'; limit?: number }) =>
    matrixFriendService.searchFriendsViaApi(query, options)

  return {
    searchType,
    searchValue,
    searchResults,
    hasSearched,
    loading,
    initialLoading,
    clearSearchResults,
    handleSearch,
    handleClear,
    handleTypeChange,
    initialize,
    getActionKind,
    groupChatList,
    onlineCount,
    specialContacts,
    specialOnlineCount,
    blockedContacts,
    normalContacts,
    normalOnlineCount,
    contactUnreadCount,
    selectedItem,
    getUserState,
    setSelectedItem,
    clearSelectedItem,
    isSelected,
    targetUid,
    userInfo,
    avatarSrc,
    requestMsg,
    syncDefaultMessage,
    submitRequest,
    isFriend,
    isCurrentUser,
    isInGroup,
    isBotUser,
    getFriendSuggestions,
    searchFriendsViaApi,
    ...friendGroupService
  }
}
