import { OnlineEnum } from '@/enums'
import type { MatrixContact } from '@/stores/domains/chat/contacts'

// ============================================================================
// Types
// ============================================================================

export type FriendSearchType = 'recommend' | 'user' | 'group'
export type FriendSearchAction = 'edit-profile' | 'message' | 'add'

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

export type SearchPredicates = {
  isCurrentUser: (uid: string) => boolean
  isFriend: (uid: string) => boolean
  isInGroup: (roomId: string) => boolean
}

type GroupListItem = {
  roomId: string
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
