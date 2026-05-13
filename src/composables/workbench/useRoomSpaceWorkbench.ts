import { useDebounceFn } from '@vueuse/core'
import { computed, type Ref, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSpaceRooms, useSpaces } from '@/composables/space'
import { RoomTypeEnum } from '@/enums'
import {
  buildSpaceWorkbenchRoute,
  readSpaceWorkbenchSearch,
  readSpaceWorkbenchSessionEngagementFilter,
  readSpaceWorkbenchSessionSort,
  readSpaceWorkbenchSessionTypeFilter,
  readSpaceWorkbenchSpaceId,
  SPACE_ROUTE_NAMES,
  WORKBENCH_SESSION_ENGAGEMENT_FILTERS,
  WORKBENCH_SESSION_SORTS,
  WORKBENCH_SESSION_TYPE_FILTERS,
  type WorkbenchSessionEngagementFilter,
  type WorkbenchSessionSort,
  type WorkbenchSessionTypeFilter
} from '@/router/spaceNavigation'
import { useSpaceStore } from '@/stores/domains/widget/space'

type FilterableSession = {
  roomId: string
  name: string
  type: RoomTypeEnum
  top?: boolean
  lastMsg?: string
  remark?: string
  account?: string
  unreadCount?: number
  highlightCount?: number
  isInvite?: boolean
}

const matchesKeyword = (session: FilterableSession, keyword: string) => {
  if (!keyword) return true

  const haystacks = [session.name, session.lastMsg, session.remark, session.account]
    .filter(Boolean)
    .map((item) => String(item).toLocaleLowerCase())

  return haystacks.some((item) => item.includes(keyword))
}

export function useRoomSpaceWorkbench<T extends FilterableSession>(sourceSessions: Readonly<Ref<T[]>>) {
  const route = useRoute()
  const router = useRouter()
  const spaceStore = useSpaceStore()

  const searchKeyword = ref(readSpaceWorkbenchSearch(route.query))
  const selectedSpaceId = ref(readSpaceWorkbenchSpaceId(route.query))
  const sessionTypeFilter = ref<WorkbenchSessionTypeFilter>(readSpaceWorkbenchSessionTypeFilter(route.query))
  const sessionEngagementFilter = ref<WorkbenchSessionEngagementFilter>(
    readSpaceWorkbenchSessionEngagementFilter(route.query)
  )
  const sessionSort = ref<WorkbenchSessionSort>(readSpaceWorkbenchSessionSort(route.query))

  const { spaces, loading: spaceLoading, load: loadSpaces } = useSpaces()
  const {
    rooms: spaceRooms,
    loading: spaceRoomsLoading,
    load: loadSpaceRooms
  } = useSpaceRooms(() => selectedSpaceId.value)

  const keyword = computed(() => searchKeyword.value.trim().toLocaleLowerCase())
  const spaceRoomIdSet = computed(() => new Set(spaceRooms.value.map((room) => room.roomId)))

  const activeSpace = computed(() => spaces.value.find((space) => space.spaceId === selectedSpaceId.value) ?? null)
  const hasActiveSpaceFilter = computed(() => Boolean(selectedSpaceId.value))
  const hasSessionTypeFilter = computed(() => sessionTypeFilter.value !== WORKBENCH_SESSION_TYPE_FILTERS.all)
  const hasSessionEngagementFilter = computed(
    () => sessionEngagementFilter.value !== WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all
  )

  const matchesSessionType = (session: T) => {
    if (sessionTypeFilter.value === WORKBENCH_SESSION_TYPE_FILTERS.group) {
      return session.type === RoomTypeEnum.GROUP
    }
    if (sessionTypeFilter.value === WORKBENCH_SESSION_TYPE_FILTERS.single) {
      return session.type === RoomTypeEnum.SINGLE
    }

    return true
  }

  const matchesEngagement = (session: T) => {
    switch (sessionEngagementFilter.value) {
      case WORKBENCH_SESSION_ENGAGEMENT_FILTERS.unread:
        return (session.unreadCount ?? 0) > 0
      case WORKBENCH_SESSION_ENGAGEMENT_FILTERS.mention:
        return (session.highlightCount ?? 0) > 0
      case WORKBENCH_SESSION_ENGAGEMENT_FILTERS.invite:
        return Boolean(session.isInvite)
      default:
        return true
    }
  }

  const filteredSessionList = computed(() => {
    const filteredSessions = sourceSessions.value.filter((session) => {
      if (hasActiveSpaceFilter.value && !spaceRoomIdSet.value.has(session.roomId)) {
        return false
      }

      if (!matchesSessionType(session)) {
        return false
      }

      if (!matchesEngagement(session)) {
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

  const syncWorkbenchQuery = async (
    overrides: {
      spaceId?: string
      search?: string
      type?: WorkbenchSessionTypeFilter
      engagement?: WorkbenchSessionEngagementFilter
      sort?: WorkbenchSessionSort
    } = {}
  ) => {
    if (route.name !== SPACE_ROUTE_NAMES.workbench) return

    const nextSpaceId = overrides.spaceId ?? selectedSpaceId.value
    const nextSearch = overrides.search ?? searchKeyword.value.trim()
    const nextType = overrides.type ?? sessionTypeFilter.value
    const nextEngagement = overrides.engagement ?? sessionEngagementFilter.value
    const nextSort = overrides.sort ?? sessionSort.value
    const currentSpaceId = readSpaceWorkbenchSpaceId(route.query)
    const currentSearch = readSpaceWorkbenchSearch(route.query)
    const currentType = readSpaceWorkbenchSessionTypeFilter(route.query)
    const currentEngagement = readSpaceWorkbenchSessionEngagementFilter(route.query)
    const currentSort = readSpaceWorkbenchSessionSort(route.query)

    if (
      currentSpaceId === nextSpaceId &&
      currentSearch === nextSearch &&
      currentType === nextType &&
      currentEngagement === nextEngagement &&
      currentSort === nextSort
    ) {
      return
    }

    await router.replace(
      buildSpaceWorkbenchRoute(nextSpaceId, {
        ...route.query,
        search: nextSearch,
        type: nextType,
        engagement: nextEngagement,
        sort: nextSort
      })
    )
  }

  const syncQuerySpaceId = async (spaceId: string) => {
    await syncWorkbenchQuery({ spaceId })
  }

  const syncQuerySearchKeyword = async (value: string) => {
    await syncWorkbenchQuery({ search: value.trim() })
  }

  const syncQuerySessionTypeFilter = async (value: WorkbenchSessionTypeFilter) => {
    await syncWorkbenchQuery({ type: value })
  }

  const syncQuerySessionEngagementFilter = async (value: WorkbenchSessionEngagementFilter) => {
    await syncWorkbenchQuery({ engagement: value })
  }

  const syncQuerySessionSort = async (value: WorkbenchSessionSort) => {
    await syncWorkbenchQuery({ sort: value })
  }

  const debouncedSyncQuerySearchKeyword = useDebounceFn((value: string) => {
    void syncQuerySearchKeyword(value)
  }, 300)

  const setSelectedSpaceId = (spaceId?: string | null) => {
    selectedSpaceId.value = readSpaceWorkbenchSpaceId({ spaceId })
  }

  const setSearchKeyword = (value: string) => {
    searchKeyword.value = value
  }

  const setSessionTypeFilter = (value: WorkbenchSessionTypeFilter) => {
    sessionTypeFilter.value = value
  }

  const setSessionEngagementFilter = (value: WorkbenchSessionEngagementFilter) => {
    sessionEngagementFilter.value = value
  }

  const setSessionSort = (value: WorkbenchSessionSort) => {
    sessionSort.value = value
  }

  const clearSpaceFilter = () => {
    selectedSpaceId.value = ''
  }

  const clearSearchKeyword = () => {
    searchKeyword.value = ''
  }

  const ensureRoomVisible = (roomId: string) => {
    const room = sourceSessions.value.find((item) => item.roomId === roomId)
    if (!room) return

    if (hasActiveSpaceFilter.value && !spaceRoomIdSet.value.has(roomId)) {
      clearSpaceFilter()
    }

    if (keyword.value && !matchesKeyword(room, keyword.value)) {
      clearSearchKeyword()
    }

    if (hasSessionTypeFilter.value && !matchesSessionType(room)) {
      sessionTypeFilter.value = WORKBENCH_SESSION_TYPE_FILTERS.all
    }

    if (hasSessionEngagementFilter.value && !matchesEngagement(room)) {
      sessionEngagementFilter.value = WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all
    }
  }

  watch(
    () => route.query.spaceId,
    (spaceId) => {
      const nextSpaceId = readSpaceWorkbenchSpaceId({ spaceId })
      if (nextSpaceId !== selectedSpaceId.value) {
        selectedSpaceId.value = nextSpaceId
      }
    },
    { immediate: true }
  )

  watch(
    () => route.query.search,
    (value) => {
      const nextSearch = readSpaceWorkbenchSearch({ search: value })
      if (nextSearch !== searchKeyword.value) {
        searchKeyword.value = nextSearch
      }
    },
    { immediate: true }
  )

  watch(
    () => route.query.type,
    (value) => {
      const nextType = readSpaceWorkbenchSessionTypeFilter({ type: value })
      if (nextType !== sessionTypeFilter.value) {
        sessionTypeFilter.value = nextType
      }
    },
    { immediate: true }
  )

  watch(
    () => route.query.engagement,
    (value) => {
      const nextEngagement = readSpaceWorkbenchSessionEngagementFilter({ engagement: value })
      if (nextEngagement !== sessionEngagementFilter.value) {
        sessionEngagementFilter.value = nextEngagement
      }
    },
    { immediate: true }
  )

  watch(
    () => route.query.sort,
    (value) => {
      const nextSort = readSpaceWorkbenchSessionSort({ sort: value })
      if (nextSort !== sessionSort.value) {
        sessionSort.value = nextSort
      }
    },
    { immediate: true }
  )

  watch(
    selectedSpaceId,
    (spaceId) => {
      spaceStore.setActiveSpace(spaceId || null)
      void loadSpaceRooms()
      void syncQuerySpaceId(spaceId)
    },
    { immediate: true }
  )

  watch(searchKeyword, (value) => {
    debouncedSyncQuerySearchKeyword(value)
  })

  watch(sessionTypeFilter, (value) => {
    void syncQuerySessionTypeFilter(value)
  })

  watch(sessionEngagementFilter, (value) => {
    void syncQuerySessionEngagementFilter(value)
  })

  watch(sessionSort, (value) => {
    void syncQuerySessionSort(value)
  })

  watch(
    spaces,
    (nextSpaces) => {
      spaceStore.replaceSpaces(nextSpaces)
    },
    { immediate: true }
  )

  void loadSpaces()

  return {
    spaces,
    spaceLoading,
    spaceRooms,
    spaceRoomsLoading,
    selectedSpaceId,
    activeSpace,
    searchKeyword,
    sessionTypeFilter,
    sessionEngagementFilter,
    sessionSort,
    hasActiveSpaceFilter,
    filteredSessionList,
    setSelectedSpaceId,
    setSearchKeyword,
    setSessionTypeFilter,
    setSessionEngagementFilter,
    setSessionSort,
    clearSpaceFilter,
    clearSearchKeyword,
    ensureRoomVisible,
    reloadSpaces: loadSpaces,
    reloadActiveSpaceRooms: loadSpaceRooms
  }
}
