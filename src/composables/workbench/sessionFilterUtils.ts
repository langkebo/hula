import { RoomTypeEnum } from '@/enums'
import { WORKBENCH_SESSION_ENGAGEMENT_FILTERS, type WorkbenchSessionEngagementFilter } from '@/router/spaceNavigation'

export type WorkbenchFilterableSession = {
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

export const matchesWorkbenchSessionKeyword = (session: WorkbenchFilterableSession, keyword: string) => {
  if (!keyword) return true

  const haystacks = [session.name, session.lastMsg, session.remark, session.account]
    .filter(Boolean)
    .map((item) => String(item).toLocaleLowerCase())

  return haystacks.some((item) => item.includes(keyword))
}

export const matchesWorkbenchSessionType = (
  session: WorkbenchFilterableSession,
  sessionTypeFilter: 'all' | 'group' | 'single'
) => {
  if (sessionTypeFilter === 'group') {
    return session.type === RoomTypeEnum.GROUP
  }

  if (sessionTypeFilter === 'single') {
    return session.type === RoomTypeEnum.SINGLE
  }

  return true
}

export const matchesWorkbenchSessionEngagement = (
  session: WorkbenchFilterableSession,
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

export const sortWorkbenchSessionsByName = <T extends WorkbenchFilterableSession>(sessions: T[]) => {
  return [...sessions].sort((a, b) => {
    if (Boolean(a.top) !== Boolean(b.top)) {
      return a.top ? -1 : 1
    }

    return a.name.localeCompare(b.name, 'zh-Hans-CN')
  })
}
