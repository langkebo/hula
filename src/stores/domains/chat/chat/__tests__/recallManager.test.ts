import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPostMessage = vi.fn()
const mockWorker = {
  postMessage: mockPostMessage,
  onmessage: null as ((e: { data: Record<string, unknown> }) => void) | null
}

vi.mock('../timerWorker', () => ({
  getTimerWorker: () => mockWorker
}))

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    reactive: (obj: Record<string, unknown>) => obj
  }
})

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

import { createRecallManager } from '../recallManager'
import { RECALL_EXPIRATION_TIME } from '../types'

describe('recallManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorker.onmessage = null
  })

  it('creates manager with empty state', () => {
    const manager = createRecallManager()
    expect(manager.recalledMessages).toEqual({})
  })

  it('recordRecallMsg stores a recalled message', () => {
    const manager = createRecallManager()
    manager.recordRecallMsg({
      messageId: 'msg1',
      content: 'hello',
      originalType: 1,
      isSelf: false
    })

    const recalled = manager.getRecalledMessage('msg1')
    expect(recalled).toBeDefined()
    expect(recalled?.content).toBe('hello')
    expect(recalled?.messageId).toBe('msg1')
  })

  it('recordRecallMsg starts timer for self messages', () => {
    const manager = createRecallManager()
    manager.recordRecallMsg({
      messageId: 'msg1',
      content: 'hello',
      originalType: 1,
      isSelf: true
    })

    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'startTimer',
      msgId: 'msg1',
      duration: RECALL_EXPIRATION_TIME
    })
  })

  it('recordRecallMsg does not start timer for non-self messages', () => {
    const manager = createRecallManager()
    manager.recordRecallMsg({
      messageId: 'msg1',
      content: 'hello',
      originalType: 1,
      isSelf: false
    })

    expect(mockPostMessage).not.toHaveBeenCalled()
  })

  it('getRecalledMessage returns undefined for unknown ID', () => {
    const manager = createRecallManager()
    expect(manager.getRecalledMessage('unknown')).toBeUndefined()
  })

  it('clearAllExpirationTimers clears all recalled messages', () => {
    const manager = createRecallManager()
    manager.recordRecallMsg({ messageId: 'msg1', content: 'a', originalType: 1, isSelf: true })
    manager.recordRecallMsg({ messageId: 'msg2', content: 'b', originalType: 1, isSelf: true })

    manager.clearAllExpirationTimers()

    expect(manager.getRecalledMessage('msg1')).toBeUndefined()
    expect(manager.getRecalledMessage('msg2')).toBeUndefined()
  })

  it('clearAllExpirationTimers sends clearTimer for each message', () => {
    const manager = createRecallManager()
    manager.recordRecallMsg({ messageId: 'msg1', content: 'a', originalType: 1, isSelf: true })
    manager.recordRecallMsg({ messageId: 'msg2', content: 'b', originalType: 1, isSelf: true })

    mockPostMessage.mockClear()
    manager.clearAllExpirationTimers()

    const clearCalls = mockPostMessage.mock.calls.filter((call) => call[0].type === 'clearTimer')
    expect(clearCalls.length).toBe(2)
  })

  it('cleanupExpiredRecalledMessages removes expired messages', () => {
    const manager = createRecallManager()
    manager.recordRecallMsg({ messageId: 'msg1', content: 'old', originalType: 1, isSelf: false })

    // Force the recallTime to be old
    const recalled = manager.recalledMessages['msg1']
    if (recalled) {
      recalled.recallTime = Date.now() - RECALL_EXPIRATION_TIME - 1000
    }

    manager.cleanupExpiredRecalledMessages()
    expect(manager.getRecalledMessage('msg1')).toBeUndefined()
  })

  it('cleanupExpiredRecalledMessages keeps non-expired messages', () => {
    const manager = createRecallManager()
    manager.recordRecallMsg({ messageId: 'msg1', content: 'recent', originalType: 1, isSelf: false })

    manager.cleanupExpiredRecalledMessages()
    expect(manager.getRecalledMessage('msg1')).toBeDefined()
  })

  it('timer worker timeout event removes message', () => {
    const manager = createRecallManager()
    manager.recordRecallMsg({ messageId: 'msg1', content: 'test', originalType: 1, isSelf: true })

    // Simulate the timer worker firing a timeout
    if (mockWorker.onmessage) {
      mockWorker.onmessage({ data: { type: 'timeout', msgId: 'msg1' } })
    }

    expect(manager.getRecalledMessage('msg1')).toBeUndefined()
  })
})
