import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { OnlineEnum } from '@/enums'
import type { MatrixContact } from '@/stores/domains/chat/contacts'

const { contactStoreMock } = vi.hoisted(() => {
  const contactStoreMock = {
    contactsList: [] as MatrixContact[],
    isLoading: false,
    requestFriendsList: [] as Array<Record<string, unknown>>,
    incomingRequestsCount: 0,
    lastFriendError: null as { message: string } | null
  }
  return { contactStoreMock }
})

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => contactStoreMock
}))

import { useFriendFilters } from '../useFriendFilters'

const makeContact = (overrides: Partial<MatrixContact> = {}): MatrixContact => ({
  userId: '@user:example.com',
  displayName: 'User',
  avatarUrl: null,
  uid: '@user:example.com',
  name: 'user',
  account: 'user',
  avatar: '',
  activeStatus: OnlineEnum.OFFLINE,
  remark: '',
  lastOptTime: 0,
  hideMyPosts: false,
  hideTheirPosts: false,
  ...overrides
})

describe('useFriendFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contactStoreMock.contactsList = []
    contactStoreMock.isLoading = false
  })

  describe('filterOptions', () => {
    it('exposes 5 filter options with i18n labels', () => {
      const { filterOptions } = useFriendFilters()

      expect(filterOptions.value).toHaveLength(5)
      expect(filterOptions.value.map((o) => o.value)).toEqual(['all', 'favorite', 'normal', 'blocked', 'hidden'])
      expect(filterOptions.value.map((o) => o.label)).toEqual([
        'friend.filter.all',
        'friend.filter.favorite',
        'friend.filter.normal',
        'friend.filter.blocked',
        'friend.filter.hidden'
      ])
    })
  })

  describe('normalizeFriendStatus', () => {
    it('converts "accepted" to "normal"', () => {
      const { normalizeFriendStatus } = useFriendFilters()
      expect(normalizeFriendStatus('accepted')).toBe('normal')
    })

    it('passes through other statuses unchanged', () => {
      const { normalizeFriendStatus } = useFriendFilters()
      expect(normalizeFriendStatus('favorite')).toBe('favorite')
      expect(normalizeFriendStatus('blocked')).toBe('blocked')
      expect(normalizeFriendStatus('hidden')).toBe('hidden')
      expect(normalizeFriendStatus('normal')).toBe('normal')
    })

    it('returns undefined for undefined', () => {
      const { normalizeFriendStatus } = useFriendFilters()
      expect(normalizeFriendStatus(undefined)).toBeUndefined()
    })
  })

  describe('filteredFriends', () => {
    it('returns all contacts when filter is "all"', () => {
      contactStoreMock.contactsList = [
        makeContact({ userId: '@a:ex.com', friendStatus: 'normal' }),
        makeContact({ userId: '@b:ex.com', friendStatus: 'blocked' })
      ]
      const { filteredFriends } = useFriendFilters()

      expect(filteredFriends.value).toHaveLength(2)
    })

    it('filters by favorite status', () => {
      contactStoreMock.contactsList = [
        makeContact({ userId: '@a:ex.com', friendStatus: 'favorite' }),
        makeContact({ userId: '@b:ex.com', friendStatus: 'normal' }),
        makeContact({ userId: '@c:ex.com', friendStatus: 'favorite' })
      ]
      const { filteredFriends, handleFilterChange } = useFriendFilters()
      handleFilterChange('favorite')

      expect(filteredFriends.value).toHaveLength(2)
      expect(filteredFriends.value.every((f) => f.friendStatus === 'favorite')).toBe(true)
    })

    it('normalizes "accepted" to "normal" when filtering', () => {
      contactStoreMock.contactsList = [
        makeContact({ userId: '@a:ex.com', friendStatus: 'accepted' }),
        makeContact({ userId: '@b:ex.com', friendStatus: 'favorite' })
      ]
      const { filteredFriends, handleFilterChange } = useFriendFilters()
      handleFilterChange('normal')

      expect(filteredFriends.value).toHaveLength(1)
      expect(filteredFriends.value[0]?.userId).toBe('@a:ex.com')
    })

    it('sorts favorite friends before others', () => {
      contactStoreMock.contactsList = [
        makeContact({ userId: '@a:ex.com', name: 'a', friendStatus: 'normal', activeStatus: OnlineEnum.ONLINE }),
        makeContact({ userId: '@b:ex.com', name: 'b', friendStatus: 'favorite', activeStatus: OnlineEnum.OFFLINE })
      ]
      const { filteredFriends } = useFriendFilters()

      expect(filteredFriends.value[0]?.userId).toBe('@b:ex.com')
      expect(filteredFriends.value[1]?.userId).toBe('@a:ex.com')
    })

    it('sorts online friends before offline (within same favorite status)', () => {
      contactStoreMock.contactsList = [
        makeContact({ userId: '@offline:ex.com', friendStatus: 'normal', activeStatus: OnlineEnum.OFFLINE }),
        makeContact({ userId: '@online:ex.com', friendStatus: 'normal', activeStatus: OnlineEnum.ONLINE })
      ]
      const { filteredFriends } = useFriendFilters()

      expect(filteredFriends.value[0]?.userId).toBe('@online:ex.com')
      expect(filteredFriends.value[1]?.userId).toBe('@offline:ex.com')
    })
  })

  describe('getFilterCount', () => {
    it('returns total count for "all"', () => {
      contactStoreMock.contactsList = [
        makeContact({ userId: '@a:ex.com', friendStatus: 'normal' }),
        makeContact({ userId: '@b:ex.com', friendStatus: 'blocked' })
      ]
      const { getFilterCount } = useFriendFilters()

      expect(getFilterCount('all')).toBe(2)
    })

    it('returns count for specific status', () => {
      contactStoreMock.contactsList = [
        makeContact({ userId: '@a:ex.com', friendStatus: 'blocked' }),
        makeContact({ userId: '@b:ex.com', friendStatus: 'normal' }),
        makeContact({ userId: '@c:ex.com', friendStatus: 'blocked' })
      ]
      const { getFilterCount } = useFriendFilters()

      expect(getFilterCount('blocked')).toBe(2)
      expect(getFilterCount('normal')).toBe(1)
    })

    it('normalizes "accepted" to "normal" when counting', () => {
      contactStoreMock.contactsList = [
        makeContact({ userId: '@a:ex.com', friendStatus: 'accepted' }),
        makeContact({ userId: '@b:ex.com', friendStatus: 'normal' })
      ]
      const { getFilterCount } = useFriendFilters()

      expect(getFilterCount('normal')).toBe(2)
    })
  })

  describe('handleFilterChange', () => {
    it('updates currentFilter', async () => {
      const { currentFilter, handleFilterChange } = useFriendFilters()
      expect(currentFilter.value).toBe('all')

      handleFilterChange('blocked')
      await nextTick()
      expect(currentFilter.value).toBe('blocked')

      handleFilterChange('all')
      await nextTick()
      expect(currentFilter.value).toBe('all')
    })
  })

  describe('currentFilter reactivity', () => {
    it('currentFilter is a writable ref', () => {
      const { currentFilter } = useFriendFilters()
      currentFilter.value = 'favorite'
      expect(currentFilter.value).toBe('favorite')
    })
  })

  describe('filteredFriends reactivity', () => {
    it('reflects current contactsList at evaluation time', () => {
      contactStoreMock.contactsList = [makeContact({ userId: '@a:ex.com' })]
      const { filteredFriends } = useFriendFilters()
      expect(filteredFriends.value).toHaveLength(1)

      // Re-create composable to read updated data (Pinia provides reactivity in production)
      contactStoreMock.contactsList = [makeContact({ userId: '@a:ex.com' }), makeContact({ userId: '@b:ex.com' })]
      const { filteredFriends: updated } = useFriendFilters()
      expect(updated.value).toHaveLength(2)
    })
  })
})
