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

  for (const item of [...contacts, ...members]) {
    const userId = item.userId ?? item.uid
    if (typeof userId === 'string' && userId.trim()) {
      trackedUserIds.add(userId)
    }
  }

  return Array.from(trackedUserIds).sort()
}
