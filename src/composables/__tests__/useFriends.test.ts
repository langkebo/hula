import { describe, expect, it } from 'vitest'
import { OnlineEnum } from '@/enums'
import {
  buildNormalContacts,
  type FriendSearchResult,
  filterRecommendedUsers,
  resolveFriendSearchAction,
  sortBlockedContactsByTime,
  sortContactsByOnlineStatus,
  sortFriendSearchResults,
  sortGroupChatList,
  sortNormalContacts
} from '../useFriends'

// ============================================================================
// resolveFriendSearchAction
// ============================================================================

describe('resolveFriendSearchAction', () => {
  const predicates = {
    isCurrentUser: (uid: string) => uid === 'me',
    isFriend: (uid: string) => uid === 'friend1',
    isInGroup: (roomId: string) => roomId === 'joinedRoom'
  }

  it('returns "edit-profile" when the user is the current user', () => {
    const result = resolveFriendSearchAction({ uid: 'me', account: 'a', name: 'n', avatar: '' }, 'user', predicates)
    expect(result).toBe('edit-profile')
  })

  it('returns "message" when the user is a friend', () => {
    const result = resolveFriendSearchAction(
      { uid: 'friend1', account: 'a', name: 'n', avatar: '' },
      'user',
      predicates
    )
    expect(result).toBe('message')
  })

  it('returns "add" when the user is neither current user nor friend', () => {
    const result = resolveFriendSearchAction(
      { uid: 'stranger', account: 'a', name: 'n', avatar: '' },
      'user',
      predicates
    )
    expect(result).toBe('add')
  })

  it('returns "message" for a group that the user has joined', () => {
    const result = resolveFriendSearchAction(
      { roomId: 'joinedRoom', account: 'a', name: 'n', avatar: '' },
      'group',
      predicates
    )
    expect(result).toBe('message')
  })

  it('returns "add" for a group that the user has not joined', () => {
    const result = resolveFriendSearchAction(
      { roomId: 'otherRoom', account: 'a', name: 'n', avatar: '' },
      'group',
      predicates
    )
    expect(result).toBe('add')
  })

  it('handles recommend type like user type (not current user, not friend)', () => {
    const result = resolveFriendSearchAction(
      { uid: 'someone', account: 'a', name: 'n', avatar: '' },
      'recommend',
      predicates
    )
    expect(result).toBe('add')
  })

  it('handles items with empty uid gracefully', () => {
    const result = resolveFriendSearchAction({ uid: '', account: 'a', name: 'n', avatar: '' }, 'user', predicates)
    expect(result).toBe('add')
  })
})

// ============================================================================
// sortFriendSearchResults
// ============================================================================

describe('sortFriendSearchResults', () => {
  const predicates = {
    isCurrentUser: (uid: string) => uid === 'me',
    isFriend: (uid: string) => ['f1', 'f2'].includes(uid),
    isInGroup: (roomId: string) => ['r1'].includes(roomId)
  }

  it('sorts user results: current user first, then friends, then others', () => {
    const items: FriendSearchResult[] = [
      { uid: 'other', account: 'a', name: 'n', avatar: '' },
      { uid: 'f1', account: 'a', name: 'n', avatar: '' },
      { uid: 'me', account: 'a', name: 'n', avatar: '' }
    ]
    const sorted = sortFriendSearchResults(items, 'user', predicates)
    expect(sorted.map((i) => i.uid)).toEqual(['me', 'f1', 'other'])
  })

  it('sorts group results: joined groups first', () => {
    const items: FriendSearchResult[] = [
      { roomId: 'r2', account: 'a', name: 'n', avatar: '' },
      { roomId: 'r1', account: 'a', name: 'n', avatar: '' }
    ]
    const sorted = sortFriendSearchResults(items, 'group', predicates)
    expect(sorted.map((i) => i.roomId)).toEqual(['r1', 'r2'])
  })

  it('does not mutate the original array', () => {
    const items: FriendSearchResult[] = [
      { uid: 'other', account: 'a', name: 'n', avatar: '' },
      { uid: 'me', account: 'a', name: 'n', avatar: '' }
    ]
    const copy = [...items]
    sortFriendSearchResults(items, 'user', predicates)
    expect(items.map((i) => i.uid)).toEqual(copy.map((i) => i.uid))
  })

  it('preserves relative order among items with same priority', () => {
    const items: FriendSearchResult[] = [
      { uid: 'other2', account: 'a', name: 'n', avatar: '' },
      { uid: 'other1', account: 'a', name: 'n', avatar: '' }
    ]
    const sorted = sortFriendSearchResults(items, 'user', predicates)
    expect(sorted.map((i) => i.uid)).toEqual(['other2', 'other1'])
  })
})

// ============================================================================
// filterRecommendedUsers
// ============================================================================

describe('filterRecommendedUsers', () => {
  it('filters users by uid range (20016-20030)', () => {
    const users = [
      { uid: '20015', name: 'TooLow' },
      { uid: '20016', name: 'Min' },
      { uid: '20020', name: 'In' },
      { uid: '20030', name: 'Max' },
      { uid: '20031', name: 'TooHigh' }
    ]
    const result = filterRecommendedUsers(users, new Set())
    expect(result.map((u) => u.uid)).toEqual(['20016', '20020', '20030'])
  })

  it('filters by keyword matching name, account, or uid', () => {
    const users = [
      { uid: '20020', name: 'Alice', account: 'alice123' },
      { uid: '20021', name: 'Bob', account: 'bob' }
    ]
    const byName = filterRecommendedUsers(users, new Set(), 'alice')
    expect(byName.map((u) => u.uid)).toEqual(['20020'])

    const byAccount = filterRecommendedUsers(users, new Set(), 'bob')
    expect(byAccount.map((u) => u.uid)).toEqual(['20021'])

    const byUid = filterRecommendedUsers(users, new Set(), '20020')
    expect(byUid.map((u) => u.uid)).toEqual(['20020'])
  })

  it('returns all in-range users when no keyword is provided', () => {
    const users = [
      { uid: '20020', name: 'A' },
      { uid: '20025', name: 'B' }
    ]
    const result = filterRecommendedUsers(users, new Set())
    expect(result).toHaveLength(2)
  })

  it('marks users as favorite when their uid is in favoriteIds', () => {
    const users = [{ uid: '20020', name: 'A' }]
    const result = filterRecommendedUsers(users, new Set(['20020']))
    expect(result[0].isFavorite).toBe(true)
  })

  it('does not mark users as favorite when uid is not in favoriteIds', () => {
    const users = [{ uid: '20020', name: 'A' }]
    const result = filterRecommendedUsers(users, new Set())
    expect(result[0].isFavorite).toBe(false)
  })

  it('handles numeric uid values', () => {
    const users = [{ uid: 20020, name: 'A' }]
    const result = filterRecommendedUsers(users, new Set())
    expect(result).toHaveLength(1)
    expect(result[0].uid).toBe('20020')
  })

  it('uses uid as fallback for missing account/name', () => {
    const users = [{ uid: '20020' }]
    const result = filterRecommendedUsers(users, new Set())
    expect(result[0].account).toBe('20020')
    expect(result[0].name).toBe('20020')
    expect(result[0].avatar).toBe('')
  })

  it('keyword matching is case-insensitive', () => {
    const users = [{ uid: '20020', name: 'Alice', account: 'alice' }]
    const result = filterRecommendedUsers(users, new Set(), 'ALICE')
    expect(result).toHaveLength(1)
  })
})

// ============================================================================
// sortGroupChatList
// ============================================================================

describe('sortGroupChatList', () => {
  it('places roomId "1" first', () => {
    const groups = [{ roomId: '3' }, { roomId: '1' }, { roomId: '2' }]
    const sorted = sortGroupChatList(groups)
    expect(sorted.map((g) => g.roomId)).toEqual(['1', '3', '2'])
  })

  it('does not mutate the original array', () => {
    const groups = [{ roomId: '2' }, { roomId: '1' }]
    sortGroupChatList(groups)
    expect(groups.map((g) => g.roomId)).toEqual(['2', '1'])
  })

  it('returns empty array for empty input', () => {
    expect(sortGroupChatList([])).toEqual([])
  })

  it('preserves order when no roomId is "1"', () => {
    const groups = [{ roomId: '3' }, { roomId: '2' }]
    const sorted = sortGroupChatList(groups)
    expect(sorted.map((g) => g.roomId)).toEqual(['3', '2'])
  })
})

// ============================================================================
// sortContactsByOnlineStatus
// ============================================================================

describe('sortContactsByOnlineStatus', () => {
  it('places online contacts before offline ones', () => {
    const contacts = [{ activeStatus: OnlineEnum.OFFLINE }, { activeStatus: OnlineEnum.ONLINE }]
    const sorted = sortContactsByOnlineStatus(contacts)
    expect(sorted.map((c) => c.activeStatus)).toEqual([OnlineEnum.ONLINE, OnlineEnum.OFFLINE])
  })

  it('does not mutate the original array', () => {
    const contacts = [{ activeStatus: OnlineEnum.OFFLINE }, { activeStatus: OnlineEnum.ONLINE }]
    sortContactsByOnlineStatus(contacts)
    expect(contacts[0].activeStatus).toBe(OnlineEnum.OFFLINE)
  })

  it('handles all-online contacts', () => {
    const contacts = [{ activeStatus: OnlineEnum.ONLINE }, { activeStatus: OnlineEnum.ONLINE }]
    const sorted = sortContactsByOnlineStatus(contacts)
    expect(sorted.every((c) => c.activeStatus === OnlineEnum.ONLINE)).toBe(true)
  })

  it('handles all-offline contacts', () => {
    const contacts = [{ activeStatus: OnlineEnum.OFFLINE }, { activeStatus: OnlineEnum.OFFLINE }]
    const sorted = sortContactsByOnlineStatus(contacts)
    expect(sorted.every((c) => c.activeStatus === OnlineEnum.OFFLINE)).toBe(true)
  })
})

// ============================================================================
// sortBlockedContactsByTime
// ============================================================================

describe('sortBlockedContactsByTime', () => {
  it('sorts by lastOptTime descending', () => {
    const contacts = [{ lastOptTime: 10 }, { lastOptTime: 30 }, { lastOptTime: 20 }]
    const sorted = sortBlockedContactsByTime(contacts)
    expect(sorted.map((c) => c.lastOptTime)).toEqual([30, 20, 10])
  })

  it('treats undefined lastOptTime as 0', () => {
    const contacts = [{ lastOptTime: 10 }, { lastOptTime: undefined as unknown as number }]
    const sorted = sortBlockedContactsByTime(contacts)
    expect(sorted[0].lastOptTime).toBe(10)
  })
})

// ============================================================================
// sortNormalContacts
// ============================================================================

describe('sortNormalContacts', () => {
  it('places bot users first, then online users', () => {
    const contacts = [
      { uid: 'user1', activeStatus: OnlineEnum.ONLINE },
      { uid: 'bot1', activeStatus: OnlineEnum.OFFLINE },
      { uid: 'user2', activeStatus: OnlineEnum.OFFLINE }
    ]
    const isBotUser = (uid: string) => uid === 'bot1'
    const sorted = sortNormalContacts(contacts as never[], isBotUser)
    expect(sorted[0].uid).toBe('bot1')
    expect(sorted[1].uid).toBe('user1')
    expect(sorted[2].uid).toBe('user2')
  })

  it('does not mutate the original array', () => {
    const contacts = [
      { uid: 'a', activeStatus: OnlineEnum.OFFLINE },
      { uid: 'b', activeStatus: OnlineEnum.ONLINE }
    ]
    sortNormalContacts(contacts as never[], () => false)
    expect(contacts[0].uid).toBe('a')
  })
})

// ============================================================================
// buildNormalContacts
// ============================================================================

describe('buildNormalContacts', () => {
  it('excludes special and blocked contacts', () => {
    const contacts = [
      { uid: 'normal1', activeStatus: OnlineEnum.OFFLINE },
      { uid: 'special1', activeStatus: OnlineEnum.ONLINE },
      { uid: 'blocked1', activeStatus: OnlineEnum.OFFLINE }
    ]
    const special = [{ uid: 'special1', activeStatus: OnlineEnum.ONLINE }]
    const blocked = [{ uid: 'blocked1', activeStatus: OnlineEnum.OFFLINE }]
    const result = buildNormalContacts(contacts as never[], special as never[], blocked as never[], () => false)
    expect(result.map((c) => c.uid)).toEqual(['normal1'])
  })

  it('sorts remaining contacts (bot first, then online)', () => {
    const contacts = [
      { uid: 'user1', activeStatus: OnlineEnum.ONLINE },
      { uid: 'bot1', activeStatus: OnlineEnum.OFFLINE }
    ]
    const isBotUser = (uid: string) => uid === 'bot1'
    const result = buildNormalContacts(contacts as never[], [], [] as never[], isBotUser)
    expect(result.map((c) => c.uid)).toEqual(['bot1', 'user1'])
  })

  it('returns empty array when all contacts are special or blocked', () => {
    const contacts = [
      { uid: 'special1', activeStatus: OnlineEnum.OFFLINE },
      { uid: 'blocked1', activeStatus: OnlineEnum.OFFLINE }
    ]
    const special = [{ uid: 'special1', activeStatus: OnlineEnum.OFFLINE }]
    const blocked = [{ uid: 'blocked1', activeStatus: OnlineEnum.OFFLINE }]
    const result = buildNormalContacts(contacts as never[], special as never[], blocked as never[], () => false)
    expect(result).toEqual([])
  })
})
