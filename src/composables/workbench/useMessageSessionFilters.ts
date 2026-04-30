import { computed, type MaybeRefOrGetter, ref, toValue } from 'vue'
import { RoomTypeEnum } from '@/enums'
import {
  WORKBENCH_SESSION_SORTS,
  WORKBENCH_SESSION_TYPE_FILTERS,
  type WorkbenchSessionSort,
  type WorkbenchSessionTypeFilter
} from '@/router/spaceNavigation'

type FilterableSession = {
  roomId: string
  name: string
  type: RoomTypeEnum
  top?: boolean
  lastMsg?: string
  remark?: string
  account?: string
}

const matchesKeyword = (session: FilterableSession, keyword: string) => {
  if (!keyword) return true

  const haystacks = [session.name, session.lastMsg, session.remark, session.account]
    .filter(Boolean)
    .map((item) => String(item).toLocaleLowerCase())

  return haystacks.some((item) => item.includes(keyword))
}

export function useMessageSessionFilters<T extends FilterableSession>(sourceSessions: MaybeRefOrGetter<T[]>) {
  const searchKeyword = ref('')
  const sessionTypeFilter = ref<WorkbenchSessionTypeFilter>(WORKBENCH_SESSION_TYPE_FILTERS.all)
  const sessionSort = ref<WorkbenchSessionSort>(WORKBENCH_SESSION_SORTS.recent)

  const keyword = computed(() => searchKeyword.value.trim().toLocaleLowerCase())

  const matchesSessionType = (session: T) => {
    if (sessionTypeFilter.value === WORKBENCH_SESSION_TYPE_FILTERS.group) {
      return session.type === RoomTypeEnum.GROUP
    }

    if (sessionTypeFilter.value === WORKBENCH_SESSION_TYPE_FILTERS.single) {
      return session.type === RoomTypeEnum.SINGLE
    }

    return true
  }

  const filteredSessionList = computed(() => {
    const filteredSessions = toValue(sourceSessions).filter((session) => {
      if (!matchesSessionType(session)) {
        return false
      }

      return matchesKeyword(session, keyword.value)
    })

    if (sessionSort.value !== WORKBENCH_SESSION_SORTS.name) {
      return filteredSessions
    }

    return [...filteredSessions].sort((a, b) => {
      if (Boolean(a.top) !== Boolean(b.top)) {
        return a.top ? -1 : 1
      }

      return a.name.localeCompare(b.name, 'zh-Hans-CN')
    })
  })

  const setSearchKeyword = (value: string) => {
    searchKeyword.value = value
  }

  const setSessionTypeFilter = (value: WorkbenchSessionTypeFilter) => {
    sessionTypeFilter.value = value
  }

  const setSessionSort = (value: WorkbenchSessionSort) => {
    sessionSort.value = value
  }

  const ensureSessionVisible = (roomId: string) => {
    const targetSession = toValue(sourceSessions).find((item) => item.roomId === roomId)
    if (!targetSession) return

    if (keyword.value && !matchesKeyword(targetSession, keyword.value)) {
      searchKeyword.value = ''
    }

    if (sessionTypeFilter.value !== WORKBENCH_SESSION_TYPE_FILTERS.all && !matchesSessionType(targetSession)) {
      sessionTypeFilter.value = WORKBENCH_SESSION_TYPE_FILTERS.all
    }
  }

  return {
    searchKeyword,
    sessionTypeFilter,
    sessionSort,
    filteredSessionList,
    ensureSessionVisible,
    setSearchKeyword,
    setSessionTypeFilter,
    setSessionSort
  }
}
