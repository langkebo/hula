import { useDebounceFn } from '@vueuse/core'
import { watch, type Ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  WORKBENCH_SESSION_SORTS,
  WORKBENCH_SESSION_TYPE_FILTERS,
  readSpaceWorkbenchSearch,
  readSpaceWorkbenchSessionSort,
  readSpaceWorkbenchSessionTypeFilter,
  type WorkbenchSessionSort,
  type WorkbenchSessionTypeFilter
} from '@/router/spaceNavigation'

type UseWorkbenchSessionQuerySyncOptions = {
  routeName: string
  searchKeyword: Ref<string>
  sessionTypeFilter: Ref<WorkbenchSessionTypeFilter>
  sessionSort: Ref<WorkbenchSessionSort>
  setSearchKeyword: (value: string) => void
  setSessionTypeFilter: (value: WorkbenchSessionTypeFilter) => void
  setSessionSort: (value: WorkbenchSessionSort) => void
  debounceMs?: number
}

export function useWorkbenchSessionQuerySync(options: UseWorkbenchSessionQuerySyncOptions) {
  const route = useRoute()
  const router = useRouter()

  const syncSessionQuery = async (
    overrides: { search?: string; type?: WorkbenchSessionTypeFilter; sort?: WorkbenchSessionSort } = {}
  ) => {
    if (route.name !== options.routeName) return

    const nextSearch = (overrides.search ?? options.searchKeyword.value).trim()
    const nextType = overrides.type ?? options.sessionTypeFilter.value
    const nextSort = overrides.sort ?? options.sessionSort.value
    const currentSearch = readSpaceWorkbenchSearch(route.query)
    const currentType = readSpaceWorkbenchSessionTypeFilter(route.query)
    const currentSort = readSpaceWorkbenchSessionSort(route.query)

    if (currentSearch === nextSearch && currentType === nextType && currentSort === nextSort) {
      return
    }

    await router.replace({
      name: options.routeName,
      query: {
        ...route.query,
        ...(nextSearch ? { search: nextSearch } : { search: undefined }),
        ...(nextType !== WORKBENCH_SESSION_TYPE_FILTERS.all ? { type: nextType } : { type: undefined }),
        ...(nextSort !== WORKBENCH_SESSION_SORTS.recent ? { sort: nextSort } : { sort: undefined })
      }
    })
  }

  const debouncedSyncSearchKeyword = useDebounceFn((value: string) => {
    void syncSessionQuery({ search: value.trim() })
  }, options.debounceMs ?? 300)

  watch(
    () => route.query.search,
    (value) => {
      const nextSearch = readSpaceWorkbenchSearch({ search: value })
      if (nextSearch !== options.searchKeyword.value) {
        options.setSearchKeyword(nextSearch)
      }
    },
    { immediate: true }
  )

  watch(
    () => route.query.type,
    (value) => {
      const nextType = readSpaceWorkbenchSessionTypeFilter({ type: value })
      if (nextType !== options.sessionTypeFilter.value) {
        options.setSessionTypeFilter(nextType)
      }
    },
    { immediate: true }
  )

  watch(
    () => route.query.sort,
    (value) => {
      const nextSort = readSpaceWorkbenchSessionSort({ sort: value })
      if (nextSort !== options.sessionSort.value) {
        options.setSessionSort(nextSort)
      }
    },
    { immediate: true }
  )

  watch(options.searchKeyword, (value) => {
    debouncedSyncSearchKeyword(value)
  })

  watch(options.sessionTypeFilter, (value) => {
    void syncSessionQuery({ type: value })
  })

  watch(options.sessionSort, (value) => {
    void syncSessionQuery({ sort: value })
  })

  return {
    syncSessionQuery
  }
}
