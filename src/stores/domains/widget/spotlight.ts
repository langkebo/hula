import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { StoresEnum } from '@/enums'

export interface SearchResultItem {
  type: 'room' | 'message' | 'user'
  roomId?: string
  eventId?: string
  userId?: string
  name?: string
  avatarUrl?: string
  content?: Record<string, unknown>
  timestamp?: number
  score?: number
}

export interface SearchFilters {
  roomIds?: string[]
  senderIds?: string[]
  types?: ('room' | 'message' | 'user')[]
  startDate?: number
  endDate?: number
  hasMedia?: boolean
}

export const useSpotlightStore = defineStore(StoresEnum.SPOTLIGHT, () => {
  const query = ref('')
  const isSearching = ref(false)
  const results = ref<SearchResultItem[]>([])
  const recentSearches = ref<string[]>([])
  const filters = ref<SearchFilters>({})
  const activeResult = ref<SearchResultItem | null>(null)

  const hasResults = computed(() => results.value.length > 0)

  const messageResults = computed(() => results.value.filter((r) => r.type === 'message'))

  const roomResults = computed(() => results.value.filter((r) => r.type === 'room'))

  const userResults = computed(() => results.value.filter((r) => r.type === 'user'))

  function setQuery(value: string): void {
    query.value = value
  }

  function setSearching(value: boolean): void {
    isSearching.value = value
  }

  function setResults(value: SearchResultItem[]): void {
    results.value = value
  }

  function addRecentSearch(searchQuery: string): void {
    const searches = recentSearches.value
    if (!searches.includes(searchQuery) && searchQuery.trim()) {
      searches.unshift(searchQuery)
      if (searches.length > 10) {
        searches.pop()
      }
      recentSearches.value = [...searches]
    }
  }

  function clearRecentSearches(): void {
    recentSearches.value = []
  }

  function setFilter(
    key: keyof SearchFilters,
    value: string | string[] | ('room' | 'message' | 'user')[] | number | boolean | undefined
  ): void {
    filters.value = {
      ...filters.value,
      [key]: value
    }
  }

  function clearFilters(): void {
    filters.value = {}
  }

  function setActiveResult(result: SearchResultItem | null): void {
    activeResult.value = result
  }

  function clearActiveResult(): void {
    activeResult.value = null
  }

  function clear(): void {
    query.value = ''
    results.value = []
    isSearching.value = false
    activeResult.value = null
  }

  return {
    query,
    isSearching,
    results,
    recentSearches,
    filters,
    activeResult,
    hasResults,
    messageResults,
    roomResults,
    userResults,
    setQuery,
    setSearching,
    setResults,
    addRecentSearch,
    clearRecentSearches,
    setFilter,
    clearFilters,
    setActiveResult,
    clearActiveResult,
    clear
  }
})
