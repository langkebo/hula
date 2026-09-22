import type { PresenceState } from '@/services/matrix/user/MatrixPresenceService'
import type { UserState } from '@/services/types'

export type MatrixPresence = PresenceState

/**
 * 「允许其他用户看到您的在线状态」关闭时，把即将上报的 online 降级为 offline
 * （与状态菜单里的「离线/隐身」同语义）；其它状态是用户的显式选择，原样返回。
 *
 * 这是该隐私规则的唯一实现：心跳、状态菜单 store、用户菜单状态选择器都必须走这里，
 * 避免规则被复制到多个上报点后漏掉其中一条（移动端 StatusSettings 仍待产品决策）。
 */
export function resolveOutgoingPresence(desired: MatrixPresence, showOnlineStatusEnabled: boolean): MatrixPresence {
  return !showOnlineStatusEnabled && desired === 'online' ? 'offline' : desired
}

/**
 * 最近一次成功上报到服务端的 presence（模块级记账，非响应式状态）。
 *
 * 心跳用它判断「同一个状态是否已经发过」，从而既不会每 45s 重复降级，
 * 也不会像一次性布尔量那样在「关→开→关」后被永久抑制：
 * 任何绕过心跳的直报路径（状态菜单 / 用户菜单）成功上报后必须调用 recordSentPresence，
 * 否则心跳会误以为已经降级而漏发。登出/重新登录由 stopPresenceHeartbeat 复位。
 */
let lastSentPresence: MatrixPresence | null = null

export function recordSentPresence(presence: MatrixPresence): void {
  lastSentPresence = presence
}

export function getLastSentPresence(): MatrixPresence | null {
  return lastSentPresence
}

export function resetSentPresence(): void {
  lastSentPresence = null
}

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
