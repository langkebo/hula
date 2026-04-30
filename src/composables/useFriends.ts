import { useDebounceFn } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, type MaybeRefOrGetter, ref, toValue, watch } from 'vue'
import { OnlineEnum, UserType } from '@/enums'
import { matrixContactService, matrixFriendService } from '@/services/matrix'
import { type GroupSearchResult, matrixGroupService } from '@/services/matrix/room/MatrixGroupService'
import type { UserProfile } from '@/services/matrix/user/MatrixContactService'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'

// ============================================================================
// Types
// ============================================================================

export type FriendSearchType = 'recommend' | 'user' | 'group'
export type FriendSearchAction = 'edit-profile' | 'message' | 'add'

type BaseSearchResult = {
  account: string
  name: string
  avatar: string
  itemIds?: string[] | null
  isFavorite?: boolean
}

export type UserSearchResult = BaseSearchResult & {
  uid: string
  roomId?: string
}

export type GroupSearchViewItem = BaseSearchResult & {
  roomId: string
  uid?: string
  deleteStatus?: number | boolean
  extJson?: string
}

export type FriendSearchResult = UserSearchResult | GroupSearchViewItem

type SearchPredicates = {
  isCurrentUser: (uid: string) => boolean
  isFriend: (uid: string) => boolean
  isInGroup: (roomId: string) => boolean
}

type GroupListItem = {
  roomId: string
}

type UserStateItem = {
  id: string
  title?: string
  url?: string
}

type FriendConfirmTarget = {
  uid: string
  name: string
  account: string
  avatar: string
}

// ============================================================================
// Constants
// ============================================================================

const RECOMMEND_USER_UID_START = '20016'
const RECOMMEND_USER_UID_END = '20030'

// ============================================================================
// Utility Functions - Search
// ============================================================================

function matchesKeyword(value: string | undefined | null, keyword: string): boolean {
  if (!value || !keyword) return false
  return String(value).toLowerCase().includes(keyword.toLowerCase())
}

export function resolveFriendSearchAction(
  item: FriendSearchResult,
  type: FriendSearchType,
  predicates: SearchPredicates
): FriendSearchAction {
  if (type === 'group') {
    return predicates.isInGroup(item.roomId || '') ? 'message' : 'add'
  }

  const uid = String(item.uid || '')
  if (predicates.isCurrentUser(uid)) return 'edit-profile'
  if (predicates.isFriend(uid)) return 'message'
  return 'add'
}

export function sortFriendSearchResults(
  items: FriendSearchResult[],
  type: FriendSearchType,
  predicates: SearchPredicates
): FriendSearchResult[] {
  return [...items].sort((a, b) => {
    if (type === 'group') {
      const aInGroup = predicates.isInGroup(a.roomId || '')
      const bInGroup = predicates.isInGroup(b.roomId || '')
      if (aInGroup && !bInGroup) return -1
      if (!aInGroup && bInGroup) return 1
      return 0
    }

    const aUid = String(a.uid || '')
    const bUid = String(b.uid || '')
    if (predicates.isCurrentUser(aUid)) return -1
    if (predicates.isCurrentUser(bUid)) return 1

    const aIsFriend = predicates.isFriend(aUid)
    const bIsFriend = predicates.isFriend(bUid)
    if (aIsFriend && !bIsFriend) return -1
    if (!aIsFriend && bIsFriend) return 1
    return 0
  })
}

export function filterRecommendedUsers(
  users: Array<{
    uid: string | number
    account?: string
    name?: string
    avatar?: string
    itemIds?: string[] | null
  }>,
  favoriteIds: Set<string>,
  keyword = ''
): UserSearchResult[] {
  const normalizedKeyword = keyword.trim().toLowerCase()

  return users
    .filter((user) => {
      const uid = String(user.uid)
      if (uid < RECOMMEND_USER_UID_START || uid > RECOMMEND_USER_UID_END) {
        return false
      }

      if (!normalizedKeyword) {
        return true
      }

      return (
        matchesKeyword(user.name, normalizedKeyword) ||
        matchesKeyword(user.account, normalizedKeyword) ||
        matchesKeyword(uid, normalizedKeyword)
      )
    })
    .map((user) => {
      const uid = String(user.uid)
      return {
        uid,
        account: user.account || uid,
        name: user.name || uid,
        avatar: user.avatar || '',
        itemIds: user.itemIds || null,
        isFavorite: favoriteIds.has(uid)
      }
    })
}

// ============================================================================
// Utility Functions - List
// ============================================================================

export function sortGroupChatList<T extends GroupListItem>(groups: T[]): T[] {
  return [...groups].sort((a, b) => {
    if (a.roomId === '1' && b.roomId !== '1') return -1
    if (a.roomId !== '1' && b.roomId === '1') return 1
    return 0
  })
}

export function sortContactsByOnlineStatus<T extends Pick<MatrixContact, 'activeStatus'>>(contacts: T[]): T[] {
  return [...contacts].sort((a, b) => {
    if (a.activeStatus === OnlineEnum.ONLINE && b.activeStatus !== OnlineEnum.ONLINE) return -1
    if (a.activeStatus !== OnlineEnum.ONLINE && b.activeStatus === OnlineEnum.ONLINE) return 1
    return 0
  })
}

export function sortBlockedContactsByTime<T extends Pick<MatrixContact, 'lastOptTime'>>(contacts: T[]): T[] {
  return [...contacts].sort((a, b) => (b.lastOptTime || 0) - (a.lastOptTime || 0))
}

export function sortNormalContacts(contacts: MatrixContact[], isBotUser: (uid: string) => boolean): MatrixContact[] {
  return [...contacts].sort((a, b) => {
    const aIsBot = isBotUser(a.uid)
    const bIsBot = isBotUser(b.uid)
    if (aIsBot && !bIsBot) return -1
    if (!aIsBot && bIsBot) return 1
    if (a.activeStatus === OnlineEnum.ONLINE && b.activeStatus !== OnlineEnum.ONLINE) return -1
    if (a.activeStatus !== OnlineEnum.ONLINE && b.activeStatus === OnlineEnum.ONLINE) return 1
    return 0
  })
}

export function buildNormalContacts(
  contacts: MatrixContact[],
  specialContacts: MatrixContact[],
  blockedContacts: MatrixContact[],
  isBotUser: (uid: string) => boolean
): MatrixContact[] {
  const specialIds = new Set(specialContacts.map((contact) => contact.uid))
  const blockedIds = new Set(blockedContacts.map((contact) => contact.uid))
  return sortNormalContacts(
    contacts.filter((contact) => !specialIds.has(contact.uid) && !blockedIds.has(contact.uid)),
    isBotUser
  )
}

// ============================================================================
// Main Composable
// ============================================================================

export function useFriends(options?: { defaultRequestMessage?: MaybeRefOrGetter<string> }) {
  const contactStore = useContactStore()
  const groupStore = useGroupStore()
  const globalStore = useGlobalStore()
  const userStore = useUserStore()
  const userStatusStore = useUserStatusStore()
  const { stateList } = storeToRefs(userStatusStore)

  // ============================================================================
  // Search State
  // ============================================================================

  const searchType = ref<FriendSearchType>('recommend')
  const searchValue = ref('')
  const searchResults = ref<FriendSearchResult[]>([])
  const hasSearched = ref(false)
  const loading = ref(false)
  const initialLoading = ref(true)
  const favoriteIds = ref<Set<string>>(new Set())

  // ============================================================================
  // List State
  // ============================================================================

  const selectedItem = ref('')

  // ============================================================================
  // Request Confirm State
  // ============================================================================

  const requestMsg = ref('')

  // ============================================================================
  // Computed - Predicates
  // ============================================================================

  const friendIds = computed(() => new Set(contactStore.contactsList.map((contact) => String(contact.uid))))
  const joinedGroupIds = computed(() => new Set(groupStore.groupDetails.map((group) => String(group.roomId))))
  const currentUserId = computed(() => String(userStore.userInfo?.uid || ''))

  const isFriend = (uid: string) => friendIds.value.has(String(uid))
  const isCurrentUser = (uid: string) => currentUserId.value === String(uid)
  const isInGroup = (roomId: string) => joinedGroupIds.value.has(String(roomId))
  const isBotUser = (uid: string) => groupStore.getUserInfo(uid)?.account === UserType.BOT

  const predicates: SearchPredicates = {
    isCurrentUser,
    isFriend,
    isInGroup
  }

  // ============================================================================
  // Computed - Lists
  // ============================================================================

  const groupChatList = computed(() => sortGroupChatList(groupStore.groupDetails))
  const onlineCount = computed(
    () => contactStore.contactsList.filter((item: MatrixContact) => item.activeStatus === OnlineEnum.ONLINE).length
  )
  const specialContacts = computed(() => sortContactsByOnlineStatus(contactStore.favoriteContacts))
  const specialOnlineCount = computed(
    () => specialContacts.value.filter((item: MatrixContact) => item.activeStatus === OnlineEnum.ONLINE).length
  )
  const blockedContacts = computed(() => sortBlockedContactsByTime(contactStore.blockedContacts))
  const normalContacts = computed(() =>
    buildNormalContacts(contactStore.contactsList, specialContacts.value, blockedContacts.value, isBotUser)
  )
  const normalOnlineCount = computed(() => Math.max(onlineCount.value - specialOnlineCount.value, 0))
  const contactUnreadCount = computed(() => globalStore.contactUnreadCount)

  // ============================================================================
  // Computed - Request Confirm
  // ============================================================================

  const targetUid = computed(() => String(globalStore.addFriendTargetUid || ''))
  const userInfo = computed<FriendConfirmTarget>(() => {
    const uid = targetUid.value
    if (!uid) {
      return {
        uid: '',
        name: '',
        account: '',
        avatar: ''
      }
    }

    const user = groupStore.getUserInfo(uid)
    return {
      uid,
      name: user?.name || '',
      account: user?.account || uid,
      avatar: user?.avatar || ''
    }
  })
  const avatarSrc = computed(() => AvatarUtils.getAvatarUrl(userInfo.value.avatar))

  // ============================================================================
  // Methods - Search
  // ============================================================================

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
        const groups = await matrixGroupService.searchGroup(keyword)
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
      await Promise.all([contactStore.getContactList(true), refreshFavoriteIds()])
      if (searchType.value === 'recommend') {
        searchResults.value = getRecommendedUsers()
      }
    } finally {
      initialLoading.value = false
    }
  }

  const getActionKind = (item: FriendSearchResult) => resolveFriendSearchAction(item, searchType.value, predicates)

  // ============================================================================
  // Methods - List
  // ============================================================================

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

  // ============================================================================
  // Methods - Request Confirm
  // ============================================================================

  const syncDefaultMessage = () => {
    requestMsg.value = String(toValue(options?.defaultRequestMessage) || '')
  }

  watch(() => toValue(options?.defaultRequestMessage), syncDefaultMessage)

  const submitRequest = async () => {
    if (!targetUid.value) return false
    await matrixContactService.sendAddFriendRequest(targetUid.value, requestMsg.value)
    return true
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // Search
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

    // List
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

    // Request Confirm
    targetUid,
    userInfo,
    avatarSrc,
    requestMsg,
    syncDefaultMessage,
    submitRequest,

    // Predicates (shared)
    isFriend,
    isCurrentUser,
    isInGroup,
    isBotUser
  }
}
