import { useDebounceFn } from '@vueuse/core'
import { computed, ref } from 'vue'
import type { RoomSearchResult, SearchResult, UserSearchResult } from '@/services/matrix/MatrixSearchService'
import { matrixSearchService } from '@/services/matrix/MatrixSearchService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useGlobalSearch')

const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 1
const MAX_RESULTS_PER_TYPE = 10

export interface GlobalSearchResults {
  users: UserSearchResult[]
  rooms: RoomSearchResult[]
  messages: SearchResult[]
}

export type GlobalSearchStatus = 'idle' | 'loading' | 'success' | 'error'

/**
 * 阶段 3：全局搜索 composable
 *
 * 跨类型并行搜索（用户 + 房间 + 消息），300ms 防抖。
 * 调用 MatrixSearchService 的 searchUsers / searchRooms / searchMessages。
 * 单类型失败不阻断其他类型，结果取并集。
 *
 * 性能优化：使用 AbortController 跟踪请求有效性。
 * 当新搜索发起或 clear() 被调用时，前一次请求的结果会被丢弃，
 * 避免过期响应覆盖最新结果（参考需求文档 16.1）。
 */
export function useGlobalSearch() {
  const query = ref('')
  const appliedQuery = ref('')
  const status = ref<GlobalSearchStatus>('idle')
  const errorMessage = ref('')
  const results = ref<GlobalSearchResults>({ users: [], rooms: [], messages: [] })

  // 当前请求的唯一标识。每次发起搜索时递增，
  // 返回结果时若 ID 不匹配则丢弃（与 AbortController.abided 配合）
  let requestEpoch = 0
  let abortController: AbortController | null = null

  const isLoading = computed(() => status.value === 'loading')
  const hasQuery = computed(() => appliedQuery.value.trim().length >= MIN_QUERY_LENGTH)
  const hasResults = computed(
    () => results.value.users.length > 0 || results.value.rooms.length > 0 || results.value.messages.length > 0
  )
  const totalCount = computed(
    () => results.value.users.length + results.value.rooms.length + results.value.messages.length
  )

  const resetResults = () => {
    results.value = { users: [], rooms: [], messages: [] }
  }

  /** 取消当前进行中的请求，使其结果不会被应用 */
  const abortInFlight = () => {
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  const executeSearch = async (rawQuery: string) => {
    const trimmed = rawQuery.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      abortInFlight()
      requestEpoch++ // 让前一次请求的结果失效
      resetResults()
      status.value = 'idle'
      appliedQuery.value = ''
      return
    }

    // 取消前一次请求
    abortInFlight()
    const myEpoch = ++requestEpoch
    abortController = new AbortController()
    const signal = abortController.signal

    appliedQuery.value = trimmed
    status.value = 'loading'
    errorMessage.value = ''

    // 并行发起三类搜索，单类型失败不阻断其他
    const settled = await Promise.allSettled([
      matrixSearchService.searchUsers(trimmed, MAX_RESULTS_PER_TYPE),
      matrixSearchService.searchRooms(trimmed),
      matrixSearchService.searchMessages(trimmed, { limit: MAX_RESULTS_PER_TYPE }).catch(() => [] as SearchResult[])
    ])

    // 检查请求是否已被取消（过期）
    if (signal.aborted || myEpoch !== requestEpoch) {
      logger.debug(`[GlobalSearch] 请求已被取消，丢弃结果: "${trimmed}"`)
      return
    }

    const users = settled[0]?.status === 'fulfilled' ? settled[0].value : []
    const rooms = settled[1]?.status === 'fulfilled' ? settled[1].value : []
    const messages = settled[2]?.status === 'fulfilled' ? settled[2].value : []

    const failedCount = settled.filter((r) => r.status === 'rejected').length
    if (failedCount === settled.length) {
      status.value = 'error'
      errorMessage.value = '所有搜索源均失败'
      logger.error(`[GlobalSearch] 全部搜索源失败: "${trimmed}"`)
      return
    }

    results.value = { users, rooms, messages }
    status.value = 'success'

    logger.info(
      `[GlobalSearch] 搜索完成: "${trimmed}" 用户=${users.length} 房间=${rooms.length} 消息=${messages.length}`
    )
  }

  const debouncedSearch = useDebounceFn(executeSearch, SEARCH_DEBOUNCE_MS)

  const search = (value: string) => {
    query.value = value
    void debouncedSearch(value)
  }

  const clear = () => {
    abortInFlight()
    requestEpoch++ // 让前一次请求的结果失效
    query.value = ''
    appliedQuery.value = ''
    status.value = 'idle'
    errorMessage.value = ''
    resetResults()
  }

  return {
    query,
    appliedQuery,
    status,
    errorMessage,
    results,
    isLoading,
    hasQuery,
    hasResults,
    totalCount,
    search,
    executeSearch,
    clear
  }
}
