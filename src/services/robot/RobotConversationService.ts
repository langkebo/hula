import type { RobotConversationRecord } from './types'

function createConversationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

class RobotConversationService {
  private records = new Map<string, RobotConversationRecord>()

  createConversation(
    input: Omit<RobotConversationRecord, 'id' | 'createdAt' | 'updatedAt' | 'messageCount'>
  ): RobotConversationRecord {
    const now = Date.now()
    const record: RobotConversationRecord = {
      ...input,
      id: createConversationId(),
      createdAt: now,
      updatedAt: now,
      messageCount: 0
    }
    this.records.set(record.id, record)
    return record
  }

  updateConversation(id: string, patch: Partial<Omit<RobotConversationRecord, 'id'>>): RobotConversationRecord | null {
    const existing = this.records.get(id)
    if (!existing) {
      return null
    }
    const updated: RobotConversationRecord = {
      ...existing,
      ...patch,
      updatedAt: Date.now()
    }
    this.records.set(id, updated)
    return updated
  }

  getConversation(id: string): RobotConversationRecord | null {
    return this.records.get(id) ?? null
  }

  listConversations(filter?: Pick<RobotConversationRecord, 'roomId' | 'botId' | 'userId'>): RobotConversationRecord[] {
    let records = [...this.records.values()]
    if (filter?.roomId) {
      records = records.filter((record) => record.roomId === filter.roomId)
    }
    if (filter?.botId) {
      records = records.filter((record) => record.botId === filter.botId)
    }
    if (filter?.userId) {
      records = records.filter((record) => record.userId === filter.userId)
    }
    return records.sort((left, right) => right.updatedAt - left.updatedAt)
  }
}

export const robotConversationService = new RobotConversationService()
