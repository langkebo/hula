import { RoomTypeEnum } from '@/enums'
import {
  WORKBENCH_SESSION_ENGAGEMENT_FILTERS,
  WORKBENCH_SESSION_SORTS,
  WORKBENCH_SESSION_TYPE_FILTERS,
  type WorkbenchSessionEngagementFilter,
  type WorkbenchSessionSort,
  type WorkbenchSessionTypeFilter
} from '@/router/spaceNavigation'

export type FilterableSession = {
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

export const matchesKeyword = (session: FilterableSession, keyword: string) => {
  if (!keyword) return true

  const haystacks = [session.name, session.lastMsg, session.remark, session.account]
    .filter(Boolean)
    .map((item) => String(item).toLocaleLowerCase())

  return haystacks.some((item) => item.includes(keyword))
}

export const matchesSessionType = <T extends FilterableSession>(
  session: T,
  sessionTypeFilter: WorkbenchSessionTypeFilter
) => {
  if (sessionTypeFilter === WORKBENCH_SESSION_TYPE_FILTERS.group) {
    return session.type === RoomTypeEnum.GROUP
  }

  if (sessionTypeFilter === WORKBENCH_SESSION_TYPE_FILTERS.single) {
    return session.type === RoomTypeEnum.SINGLE
  }

  return true
}

export const matchesSessionEngagement = <T extends FilterableSession>(
  session: T,
  sessionEngagementFilter: WorkbenchSessionEngagementFilter
) => {
  switch (sessionEngagementFilter) {
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

const sortByPinnedThenName = <T extends FilterableSession>(sessions: readonly T[]) =>
  [...sessions].sort((a, b) => {
    if (Boolean(a.top) !== Boolean(b.top)) {
      return a.top ? -1 : 1
    }

    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })

export const filterAndSortSessions = <T extends FilterableSession>(
  sourceSessions: readonly T[],
  options: {
    keyword: string
    sessionTypeFilter: WorkbenchSessionTypeFilter
    sessionEngagementFilter: WorkbenchSessionEngagementFilter
    sessionSort: WorkbenchSessionSort
    extraPredicate?: (session: T) => boolean
  }
) => {
  const { keyword, sessionTypeFilter, sessionEngagementFilter, sessionSort, extraPredicate } = options
  const hasPredicateFilter = Boolean(extraPredicate)
  const hasFilter =
    hasPredicateFilter ||
    Boolean(keyword) ||
    sessionTypeFilter !== WORKBENCH_SESSION_TYPE_FILTERS.all ||
    sessionEngagementFilter !== WORKBENCH_SESSION_ENGAGEMENT_FILTERS.all

  if (!hasFilter && sessionSort !== WORKBENCH_SESSION_SORTS.name) {
    return sourceSessions as T[]
  }

  const filteredSessions = hasFilter
    ? sourceSessions.filter((session) => {
        if (extraPredicate && !extraPredicate(session)) {
          return false
        }

        if (!matchesSessionType(session, sessionTypeFilter)) {
          return false
        }

        if (!matchesSessionEngagement(session, sessionEngagementFilter)) {
          return false
        }

        return matchesKeyword(session, keyword)
      })
    : (sourceSessions as T[])

  if (sessionSort !== WORKBENCH_SESSION_SORTS.name) {
    return filteredSessions
  }

  return sortByPinnedThenName(filteredSessions)
}
