import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { OnlineEnum } from '@/enums'
import type { MatrixContact } from '@/stores/domains/chat/contacts'

const { contactStoreMock, rememberTermMock, clearHistoryMock, announceMock } = vi.hoisted(() => ({
  contactStoreMock: {
    contactsList: [] as MatrixContact[],
    isLoading: false,
    requestFriendsList: [] as Array<Record<string, unknown>>,
    incomingRequestsCount: 0,
    lastFriendError: null as { message: string } | null
  },
  rememberTermMock: vi.fn(),
  clearHistoryMock: vi.fn(),
  announceMock: vi.fn()
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => contactStoreMock
}))

vi.mock('@/composables/common/useRecentSearchHistory', () => ({
  useRecentSearchHistory: () => ({
    historyValues: ref<string[]>([]),
    rememberTerm: rememberTermMock,
    clearHistory: clearHistoryMock,
    historyRecords: ref<Array<{ value: string; updatedAt: number }>>([]),
    refreshHistory: vi.fn()
  })
}))

vi.mock('@/composables/common/useAriaLive', () => ({
  useAriaLive: () => ({
    announce: announceMock,
    messages: ref([]),
    clearAnnouncements: vi.fn()
  })
}))

import { useFriendSearch } from '../useFriendSearch'

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

const setupSearch = (contacts: MatrixContact[] = []) => {
  const filteredFriends = computed(() => contacts)
  const currentFilter = ref<'all' | 'favorite' | 'normal' | 'blocked' | 'hidden'>('all')
  const showStatePanel = ref(false)
  const search = useFriendSearch({ filteredFriends, currentFilter, showStatePanel })
  return { search, filteredFriends, currentFilter, showStatePanel }
}

describe('useFriendSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    contactStoreMock.contactsList = []
    contactStoreMock.isLoading = false
    localStorage.clear()
  })

  describe('initial state', () => {
    it('starts with empty searchValue and appliedSearchValue', () => {
      const { search } = setupSearch()
      expect(search.searchValue.value).toBe('')
      expect(search.appliedSearchValue.value).toBe('')
      expect(search.isSearchPending.value).toBe(false)
    })

    it('hasSearchKeyword is false initially', () => {
      const { search } = setupSearch()
      expect(search.hasSearchKeyword.value).toBe(false)
    })
  })

  describe('applySearch', () => {
    it('sets appliedSearchValue and clears isSearchPending', () => {
      const { search } = setupSearch()
      search.isSearchPending.value = true

      search.applySearch('alice')
      expect(search.appliedSearchValue.value).toBe('alice')
      expect(search.isSearchPending.value).toBe(false)
    })

    it('trims whitespace from the value', () => {
      const { search } = setupSearch()
      search.applySearch('  alice  ')
      expect(search.appliedSearchValue.value).toBe('alice')
    })

    it('remembers the term by default', () => {
      const { search } = setupSearch()
      search.applySearch('alice')
      expect(rememberTermMock).toHaveBeenCalledWith('alice')
    })

    it('skips remembering when { remember: false } is passed', () => {
      const { search } = setupSearch()
      search.applySearch('alice', { remember: false })
      expect(rememberTermMock).not.toHaveBeenCalled()
    })

    it('updates hasSearchKeyword', () => {
      const { search } = setupSearch()
      expect(search.hasSearchKeyword.value).toBe(false)
      search.applySearch('alice')
      expect(search.hasSearchKeyword.value).toBe(true)
    })
  })

  describe('handleSearch', () => {
    it('delegates to applySearch', () => {
      const { search } = setupSearch()
      search.handleSearch('bob')
      expect(search.appliedSearchValue.value).toBe('bob')
      expect(rememberTermMock).toHaveBeenCalledWith('bob')
    })
  })

  describe('handleSelectSearchHistory', () => {
    it('sets searchValue and applies the search', () => {
      const { search } = setupSearch()
      search.handleSelectSearchHistory('alice')
      expect(search.searchValue.value).toBe('alice')
      expect(search.appliedSearchValue.value).toBe('alice')
      expect(rememberTermMock).toHaveBeenCalledWith('alice')
    })
  })

  describe('handleClearActiveSearch', () => {
    it('resets searchValue, appliedSearchValue, and isSearchPending', () => {
      const { search } = setupSearch()
      search.searchValue.value = 'alice'
      search.appliedSearchValue.value = 'alice'
      search.isSearchPending.value = true

      search.handleClearActiveSearch()
      expect(search.searchValue.value).toBe('')
      expect(search.appliedSearchValue.value).toBe('')
      expect(search.isSearchPending.value).toBe(false)
    })
  })

  describe('handleClearSearchHistory', () => {
    it('calls clearHistory from useRecentSearchHistory', () => {
      const { search } = setupSearch()
      search.handleClearSearchHistory()
      expect(clearHistoryMock).toHaveBeenCalled()
    })
  })

  describe('watch(searchValue) updates isSearchPending', () => {
    it('sets isSearchPending true when searchValue differs from appliedSearchValue', async () => {
      const { search } = setupSearch()
      search.applySearch('alice')
      expect(search.isSearchPending.value).toBe(false)

      search.searchValue.value = 'alice bob'
      await nextTick()
      expect(search.isSearchPending.value).toBe(true)
    })

    it('sets isSearchPending false when searchValue matches appliedSearchValue', async () => {
      const { search } = setupSearch()
      search.applySearch('alice')
      search.searchValue.value = 'alice bob'
      await nextTick()
      expect(search.isSearchPending.value).toBe(true)

      search.searchValue.value = 'alice'
      await nextTick()
      expect(search.isSearchPending.value).toBe(false)
    })

    it('compares trimmed values', async () => {
      const { search } = setupSearch()
      search.applySearch('alice')
      search.searchValue.value = '  alice  '
      await nextTick()
      expect(search.isSearchPending.value).toBe(false)
    })
  })

  describe('displayedFriends', () => {
    it('returns all filteredFriends when no keyword is applied', () => {
      const contacts = [makeContact({ userId: '@a:ex.com' }), makeContact({ userId: '@b:ex.com' })]
      const { search } = setupSearch(contacts)
      expect(search.displayedFriends.value).toHaveLength(2)
    })

    it('filters by userId', () => {
      const contacts = [
        makeContact({ userId: '@alice:ex.com', name: 'a', displayName: 'A' }),
        makeContact({ userId: '@bob:ex.com', name: 'b', displayName: 'B' })
      ]
      const { search } = setupSearch(contacts)
      search.applySearch('alice')
      expect(search.displayedFriends.value).toHaveLength(1)
      expect(search.displayedFriends.value[0]?.userId).toBe('@alice:ex.com')
    })

    it('filters by displayName (case-insensitive)', () => {
      const contacts = [
        makeContact({ userId: '@a:ex.com', name: 'a', displayName: 'Alice Wonderland' }),
        makeContact({ userId: '@b:ex.com', name: 'b', displayName: 'Bob' })
      ]
      const { search } = setupSearch(contacts)
      search.applySearch('WONDER')
      expect(search.displayedFriends.value).toHaveLength(1)
      expect(search.displayedFriends.value[0]?.userId).toBe('@a:ex.com')
    })

    it('filters by name', () => {
      const contacts = [
        makeContact({ userId: '@a:ex.com', name: 'alice', displayName: 'A' }),
        makeContact({ userId: '@b:ex.com', name: 'bob', displayName: 'B' })
      ]
      const { search } = setupSearch(contacts)
      search.applySearch('alice')
      expect(search.displayedFriends.value).toHaveLength(1)
    })

    it('filters by remark', () => {
      const contacts = [
        makeContact({ userId: '@a:ex.com', name: 'a', displayName: 'A', remark: 'best friend' }),
        makeContact({ userId: '@b:ex.com', name: 'b', displayName: 'B', remark: '' })
      ]
      const { search } = setupSearch(contacts)
      search.applySearch('best')
      expect(search.displayedFriends.value).toHaveLength(1)
      expect(search.displayedFriends.value[0]?.userId).toBe('@a:ex.com')
    })

    it('returns empty when no match', () => {
      const contacts = [makeContact({ userId: '@a:ex.com', name: 'a', displayName: 'A' })]
      const { search } = setupSearch(contacts)
      search.applySearch('nonexistent')
      expect(search.displayedFriends.value).toHaveLength(0)
    })
  })

  describe('showSearchHistory', () => {
    it('is false when isLoading is true', () => {
      contactStoreMock.isLoading = true
      const { search } = setupSearch()
      expect(search.showSearchHistory.value).toBe(false)
    })

    it('is false when showStatePanel is true', () => {
      const { search, showStatePanel } = setupSearch()
      showStatePanel.value = true
      expect(search.showSearchHistory.value).toBe(false)
    })

    it('is false when searchValue is non-empty', () => {
      const { search } = setupSearch()
      search.searchValue.value = 'ali'
      expect(search.showSearchHistory.value).toBe(false)
    })
  })

  describe('search feedback summary', () => {
    it('showSearchClearAction is true when searchValue is non-empty', () => {
      const { search } = setupSearch()
      search.searchValue.value = 'ali'
      expect(search.showSearchClearAction.value).toBe(true)
    })

    it('showSearchClearAction is true when currentFilter is not "all"', () => {
      const contacts = [makeContact({ userId: '@a:ex.com', friendStatus: 'favorite' })]
      const filteredFriends = computed(() => contacts)
      const currentFilter = ref<'all' | 'favorite'>('favorite')
      const showStatePanel = ref(false)
      const search = useFriendSearch({ filteredFriends, currentFilter, showStatePanel })
      expect(search.showSearchClearAction.value).toBe(true)
    })

    it('searchEmptyDescription is populated with i18n key after apply', () => {
      const { search } = setupSearch()
      search.applySearch('alice')
      // Global test setup t() returns the i18n key for unknown keys
      expect(search.searchEmptyDescription.value).toBe('friend.search.empty_description')
    })
  })
})
