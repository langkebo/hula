import type { LocationQuery, LocationQueryRaw, RouteLocationRaw } from 'vue-router'

export const SPACE_ROUTE_NAMES = {
  workbench: 'space',
  legacy: 'space-details',
  create: 'space-create'
} as const

export const WORKBENCH_SESSION_TYPE_FILTERS = {
  all: 'all',
  group: 'group',
  single: 'single'
} as const

export const WORKBENCH_SESSION_ENGAGEMENT_FILTERS = {
  all: 'all',
  unread: 'unread',
  mention: 'mention',
  invite: 'invite'
} as const

export const WORKBENCH_SESSION_SORTS = {
  recent: 'recent',
  name: 'name'
} as const

export type WorkbenchSessionTypeFilter =
  (typeof WORKBENCH_SESSION_TYPE_FILTERS)[keyof typeof WORKBENCH_SESSION_TYPE_FILTERS]
export type WorkbenchSessionEngagementFilter =
  (typeof WORKBENCH_SESSION_ENGAGEMENT_FILTERS)[keyof typeof WORKBENCH_SESSION_ENGAGEMENT_FILTERS]
export type WorkbenchSessionSort = (typeof WORKBENCH_SESSION_SORTS)[keyof typeof WORKBENCH_SESSION_SORTS]

export const normalizeSpaceId = (spaceId: unknown): string => (typeof spaceId === 'string' ? spaceId.trim() : '')
export const normalizeWorkbenchSearch = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
export const normalizeWorkbenchSessionTypeFilter = (value: unknown): WorkbenchSessionTypeFilter => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''

  if (normalized === WORKBENCH_SESSION_TYPE_FILTERS.group || normalized === WORKBENCH_SESSION_TYPE_FILTERS.single) {
    return normalized
  }

  return WORKBENCH_SESSION_TYPE_FILTERS.all
}

export const normalizeWorkbenchSessionEngagementFilter = (value: unknown): WorkbenchSessionEngagementFilter => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''

  if (
    normalized === WORKBENCH_SESSION_ENGAGEMENT_FILTERS.unread ||
    normalized === WORKBENCH_SESSION_ENGAGEMENT_FILTERS.mention ||
    normalized === WORKBENCH_SESSION_ENGAGEMENT_FILTERS.invite
  ) {
    return normalized
  }

  return WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all
}

export const normalizeWorkbenchSessionSort = (value: unknown): WorkbenchSessionSort => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''

  if (normalized === WORKBENCH_SESSION_SORTS.name) {
    return WORKBENCH_SESSION_SORTS.name
  }

  return WORKBENCH_SESSION_SORTS.recent
}

const getQueryValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value)

export const readSpaceWorkbenchSpaceId = (query: LocationQuery | LocationQueryRaw): string =>
  normalizeSpaceId(getQueryValue(query.spaceId))

export const readSpaceWorkbenchSearch = (query: LocationQuery | LocationQueryRaw): string =>
  normalizeWorkbenchSearch(getQueryValue(query.search))

export const readSpaceWorkbenchSessionTypeFilter = (
  query: LocationQuery | LocationQueryRaw
): WorkbenchSessionTypeFilter => normalizeWorkbenchSessionTypeFilter(getQueryValue(query.type))

export const readSpaceWorkbenchSessionEngagementFilter = (
  query: LocationQuery | LocationQueryRaw
): WorkbenchSessionEngagementFilter => normalizeWorkbenchSessionEngagementFilter(getQueryValue(query.engagement))

export const readSpaceWorkbenchSessionSort = (query: LocationQuery | LocationQueryRaw): WorkbenchSessionSort =>
  normalizeWorkbenchSessionSort(getQueryValue(query.sort))

export const buildSpaceWorkbenchQuery = (
  spaceId?: unknown,
  query: LocationQuery | LocationQueryRaw = {}
): LocationQueryRaw => {
  const nextSpaceId = normalizeSpaceId(spaceId)
  const nextSearch = readSpaceWorkbenchSearch(query)
  const nextType = readSpaceWorkbenchSessionTypeFilter(query)
  const nextEngagement = readSpaceWorkbenchSessionEngagementFilter(query)
  const nextSort = readSpaceWorkbenchSessionSort(query)
  const nextQuery: LocationQueryRaw = { ...(query as LocationQueryRaw) }

  if (nextSpaceId) {
    nextQuery.spaceId = nextSpaceId
  } else {
    delete nextQuery.spaceId
  }

  if (nextSearch) {
    nextQuery.search = nextSearch
  } else {
    delete nextQuery.search
  }

  if (nextType !== WORKBENCH_SESSION_TYPE_FILTERS.all) {
    nextQuery.type = nextType
  } else {
    delete nextQuery.type
  }

  if (nextEngagement !== WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all) {
    nextQuery.engagement = nextEngagement
  } else {
    delete nextQuery.engagement
  }

  if (nextSort !== WORKBENCH_SESSION_SORTS.recent) {
    nextQuery.sort = nextSort
  } else {
    delete nextQuery.sort
  }

  return nextQuery
}

export const buildCreateSpaceRoute = (): RouteLocationRaw => ({
  name: SPACE_ROUTE_NAMES.create
})

export const buildSpaceRoute = (spaceId?: unknown, query: LocationQuery | LocationQueryRaw = {}): RouteLocationRaw => {
  const nextSpaceId = normalizeSpaceId(spaceId)

  return {
    name: SPACE_ROUTE_NAMES.legacy,
    ...(nextSpaceId ? { params: { spaceId: nextSpaceId } } : {}),
    query
  }
}

export const buildSpaceWorkbenchRoute = (
  spaceId?: unknown,
  query: LocationQuery | LocationQueryRaw = {}
): RouteLocationRaw => {
  return {
    name: SPACE_ROUTE_NAMES.workbench,
    query: buildSpaceWorkbenchQuery(spaceId, query)
  }
}
