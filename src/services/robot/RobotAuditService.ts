import type { RobotAuditEvent } from './types'

function createAuditId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

class RobotAuditService {
  private events: RobotAuditEvent[] = []

  append(event: Omit<RobotAuditEvent, 'id' | 'createdAt'>): RobotAuditEvent {
    const nextEvent: RobotAuditEvent = {
      ...event,
      id: createAuditId(),
      createdAt: Date.now()
    }
    this.events.unshift(nextEvent)
    return nextEvent
  }

  list(filter?: Pick<RobotAuditEvent, 'roomId' | 'botId' | 'actorUserId' | 'type'>): RobotAuditEvent[] {
    return this.events.filter((event) => {
      if (filter?.roomId && event.roomId !== filter.roomId) return false
      if (filter?.botId && event.botId !== filter.botId) return false
      if (filter?.actorUserId && event.actorUserId !== filter.actorUserId) return false
      if (filter?.type && event.type !== filter.type) return false
      return true
    })
  }

  clear(): void {
    this.events = []
  }
}

export const robotAuditService = new RobotAuditService()
