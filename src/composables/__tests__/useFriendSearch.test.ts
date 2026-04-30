import { describe, expect, it } from 'vitest'
import {
  type FriendSearchResult,
  filterRecommendedUsers,
  resolveFriendSearchAction,
  sortFriendSearchResults
} from '../useFriendSearch'

describe('useFriendSearch helpers', () => {
  const predicates = {
    isCurrentUser: (uid: string) => uid === '20018',
    isFriend: (uid: string) => uid === '20020',
    isInGroup: (roomId: string) => roomId === '!joined:server'
  }

  it('filters recommended users by configured uid range and keyword', () => {
    const result = filterRecommendedUsers(
      [
        { uid: '20015', name: 'Out', account: 'out' },
        { uid: '20016', name: 'Alice', account: 'alice' },
        { uid: '20020', name: 'Bob', account: 'bobby' },
        { uid: '20031', name: 'Out2', account: 'out2' }
      ],
      new Set(['20020']),
      'bob'
    )

    expect(result).toEqual([
      expect.objectContaining({
        uid: '20020',
        account: 'bobby',
        name: 'Bob',
        isFavorite: true
      })
    ])
  })

  it('resolves action by current user, friend and group membership state', () => {
    expect(
      resolveFriendSearchAction({ uid: '20018', account: 'self', name: 'Self', avatar: '' }, 'user', predicates)
    ).toBe('edit-profile')

    expect(
      resolveFriendSearchAction({ uid: '20020', account: 'friend', name: 'Friend', avatar: '' }, 'user', predicates)
    ).toBe('message')

    expect(
      resolveFriendSearchAction(
        { roomId: '!joined:server', account: 'joined', name: 'Joined', avatar: '' },
        'group',
        predicates
      )
    ).toBe('message')
  })

  it('sorts user and group search results with joined/current items first', () => {
    const users = sortFriendSearchResults(
      [
        { uid: '20021', account: 'other', name: 'Other', avatar: '' },
        { uid: '20020', account: 'friend', name: 'Friend', avatar: '' },
        { uid: '20018', account: 'self', name: 'Self', avatar: '' }
      ] as FriendSearchResult[],
      'user',
      predicates
    )

    expect(users.map((item) => item.uid)).toEqual(['20018', '20020', '20021'])

    const groups = sortFriendSearchResults(
      [
        { roomId: '!other:server', account: 'other', name: 'Other', avatar: '' },
        { roomId: '!joined:server', account: 'joined', name: 'Joined', avatar: '' }
      ] as FriendSearchResult[],
      'group',
      predicates
    )

    expect(groups.map((item) => item.roomId)).toEqual(['!joined:server', '!other:server'])
  })
})
