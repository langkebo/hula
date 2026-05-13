import { useDebounceFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { type GroupSearchResult, matrixGroupService } from '@/services/matrix/room/MatrixGroupService'
import type { UserProfile } from '@/services/matrix/user/MatrixContactService'
import { matrixContactService } from '@/services/matrix/user/MatrixContactService'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'

export type FriendSearchType = 'recommend' | 'user' | 'group'

type BaseSearchResult = {
  account: string
  name: string
  avatar: string
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

export type FriendSearchAction = 'edit-profile' | 'message' | 'add'

type SearchPredicates = {
  isCurrentUser: (uid: string) => boolean
  isFriend: (uid: string) => boolean
  isInGroup: (roomId: string) => boolean
}

const RECOMMEND_USER_UID_START = '20016'
const RECOMMEND_USER_UID_END = '20030'

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
        isFavorite: favoriteIds.has(uid)
      }
    })
}

export function useFriendSearch() {
  const contactStore = useContactStore()
  const groupStore = useGroupStore()
  const userStore = useUserStore()

  const searchType = ref<FriendSearchType>('recommend')
  const searchValue = ref('')
  const searchResults = ref<FriendSearchResult[]>([])
  const hasSearched = ref(false)
  const loading = ref(false)
  const initialLoading = ref(true)
  const favoriteIds = ref<Set<string>>(new Set())

  const friendIds = computed(() => new Set(contactStore.contactsList.map((contact) => String(contact.uid))))
  const joinedGroupIds = computed(() => new Set(groupStore.groupDetails.map((group) => String(group.roomId))))
  const currentUserId = computed(() => String(userStore.userInfo?.uid || ''))

  const isFriend = (uid: string) => friendIds.value.has(String(uid))
  const isCurrentUser = (uid: string) => currentUserId.value === String(uid)
  const isInGroup = (roomId: string) => joinedGroupIds.value.has(String(roomId))

  const predicates: SearchPredicates = {
    isCurrentUser,
    isFriend,
    isInGroup
  }

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
      await Promise.allSettled([contactStore.getContactList(true), refreshFavoriteIds()])
      if (searchType.value === 'recommend') {
        searchResults.value = getRecommendedUsers()
      }
    } finally {
      initialLoading.value = false
    }
  }

  const getActionKind = (item: FriendSearchResult) => resolveFriendSearchAction(item, searchType.value, predicates)

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
    isFriend,
    isCurrentUser,
    isInGroup,
    getActionKind
  }
}
