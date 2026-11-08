import { OnlineEnum } from '@/enums'
import type { PresenceInfo, PresenceState } from '@/services/matrix/user/MatrixPresenceService'

type PresenceIdentity = {
  userId?: string | null
  uid?: string | null
}

export function resolveDisplayActiveStatus(activeStatus?: OnlineEnum, fallbackStatus?: OnlineEnum): OnlineEnum {
  return activeStatus ?? fallbackStatus ?? OnlineEnum.OFFLINE
}

export function mapPresenceToOnlineStatus(presence?: PresenceState | null): OnlineEnum {
  return presence === 'online' ? OnlineEnum.ONLINE : OnlineEnum.OFFLINE
}

export function resolvePresenceLastOptTime(presence: Pick<PresenceInfo, 'last_active_ago'>, now = Date.now()): number {
  if (typeof presence.last_active_ago !== 'number' || Number.isNaN(presence.last_active_ago)) {
    return now
  }

  return Math.max(0, now - Math.max(0, presence.last_active_ago))
}

export function buildPresenceStorePatch(presence: PresenceInfo, now = Date.now()) {
  return {
    activeStatus: mapPresenceToOnlineStatus(presence.presence),
    lastOptTime: resolvePresenceLastOptTime(presence, now),
    presence: presence.presence,
    statusMessage: presence.status_msg ?? undefined
  }
}

export function collectTrackedPresenceUserIds({
  currentUserId,
  contacts = [],
  members = []
}: {
  currentUserId?: string | null
  contacts?: PresenceIdentity[]
  members?: PresenceIdentity[]
}): string[] {
  const trackedUserIds = new Set<string>()

  if (typeof currentUserId === 'string' && currentUserId.trim()) {
    trackedUserIds.add(currentUserId)
  }

  // 分两轮遍历，避免 `[...contacts, ...members]` 先把两张表整表复制一遍
  for (const list of [contacts, members]) {
    for (const item of list) {
      const userId = item.userId ?? item.uid
      if (typeof userId === 'string' && userId.trim()) {
        trackedUserIds.add(userId)
      }
    }
  }

  return Array.from(trackedUserIds).sort()
}

/**
 * 计算「被跟踪 presence 用户集合」的变更键，仅供 watch 判断成员集合是否变化。
 *
 * 与 {@link collectTrackedPresenceUserIds} 的区别：不做整表克隆、去重与排序。
 * 该方法在每次 presence 事件后都会执行（contactsList 失效即触发 watch getter），
 * 而 presence 写入只按原下标替换元素，不会调整数组顺序，因此直接按顺序拼接即可
 * 稳定反映成员变化；排序（O(n log n)）与 `[...contacts, ...members]` 复制在这里是纯浪费。
 */
export function buildTrackedPresenceKey({
  currentUserId,
  contacts = [],
  members = []
}: {
  currentUserId?: string | null
  contacts?: PresenceIdentity[]
  members?: PresenceIdentity[]
}): string {
  const parts: string[] = []

  if (typeof currentUserId === 'string' && currentUserId.trim()) {
    parts.push(currentUserId)
  }

  for (const list of [contacts, members]) {
    for (const item of list) {
      const userId = item.userId ?? item.uid
      if (userId) {
        parts.push(userId)
      }
    }
  }

  return parts.join('\u0001')
}
