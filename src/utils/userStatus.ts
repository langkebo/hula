import type { UserState } from '@/services/types'

export type MatrixPresence = 'online' | 'offline' | 'unavailable'

export function mapUserStateToPresence(state: Pick<UserState, 'id' | 'title'>): MatrixPresence {
  const normalizedTitle = state.title.trim().toLowerCase()

  if (state.id === '0' || state.id === '1' || normalizedTitle.includes('online') || normalizedTitle.includes('在线')) {
    return 'online'
  }

  if (
    normalizedTitle.includes('offline') ||
    normalizedTitle.includes('离线') ||
    normalizedTitle.includes('隐身') ||
    normalizedTitle.includes('invisible')
  ) {
    return 'offline'
  }

  return 'unavailable'
}
