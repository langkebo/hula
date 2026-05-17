import { ref } from 'vue'

interface SearchHistoryRecord {
  value: string
  updatedAt: number
}

interface UseRecentSearchHistoryOptions {
  maxItems?: number
  maxAgeMs?: number
}

const DEFAULT_MAX_ITEMS = 6
const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

const normalizeSearchHistory = (
  value: unknown,
  options: Required<UseRecentSearchHistoryOptions>
): SearchHistoryRecord[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const now = Date.now()
  const normalized = value
    .flatMap((item) => {
      if (typeof item === 'string') {
        const trimmedValue = item.trim()
        return trimmedValue
          ? [
              {
                value: trimmedValue,
                updatedAt: now
              }
            ]
          : []
      }

      if (!item || typeof item !== 'object') {
        return []
      }

      const candidate = item as Partial<SearchHistoryRecord>
      const trimmedValue = typeof candidate.value === 'string' ? candidate.value.trim() : ''
      const updatedAt = typeof candidate.updatedAt === 'number' ? candidate.updatedAt : now

      if (!trimmedValue || now - updatedAt > options.maxAgeMs) {
        return []
      }

      return [
        {
          value: trimmedValue,
          updatedAt
        }
      ]
    })
    .filter(
      (item, index, items) =>
        items.findIndex((candidate) => candidate.value.toLowerCase() === item.value.toLowerCase()) === index
    )
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, options.maxItems)

  return normalized
}

export const useRecentSearchHistory = (storageKey: string, options?: UseRecentSearchHistoryOptions) => {
  const resolvedOptions: Required<UseRecentSearchHistoryOptions> = {
    maxItems: options?.maxItems ?? DEFAULT_MAX_ITEMS,
    maxAgeMs: options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS
  }

  const readHistoryRecords = (): SearchHistoryRecord[] => {
    try {
      return normalizeSearchHistory(JSON.parse(localStorage.getItem(storageKey) || '[]'), resolvedOptions)
    } catch {
      return []
    }
  }

  const historyRecords = ref<SearchHistoryRecord[]>(readHistoryRecords())

  const persist = (records: SearchHistoryRecord[]) => {
    const normalizedRecords = normalizeSearchHistory(records, resolvedOptions)
    historyRecords.value = normalizedRecords
    localStorage.setItem(storageKey, JSON.stringify(normalizedRecords))
  }

  const refreshHistory = () => {
    persist(readHistoryRecords())
  }

  const rememberTerm = (value: string) => {
    const normalizedValue = value.trim()
    if (!normalizedValue) {
      return
    }

    persist([
      {
        value: normalizedValue,
        updatedAt: Date.now()
      },
      ...historyRecords.value.filter((item) => item.value.toLowerCase() !== normalizedValue.toLowerCase())
    ])
  }

  const clearHistory = () => {
    historyRecords.value = []
    localStorage.removeItem(storageKey)
  }

  refreshHistory()

  return {
    historyRecords,
    historyValues: computed(() => historyRecords.value.map((item) => item.value)),
    rememberTerm,
    clearHistory,
    refreshHistory
  }
}
