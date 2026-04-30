import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OfflineQueueService } from '../OfflineQueueService'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

describe('OfflineQueueService', () => {
  let service: OfflineQueueService

  beforeEach(() => {
    localStorage.clear()
    service = new OfflineQueueService()
  })

  it('enqueues operations', () => {
    const id = service.enqueue('message', '!room:test', { text: 'hello' })
    expect(id).toBeTruthy()
    expect(service.getPendingCount()).toBe(1)
    expect(service.getQueue().length).toBe(1)
    expect(service.getQueue()[0].type).toBe('message')
  })

  it('persists and restores from localStorage', () => {
    service.enqueue('message', '!room:test', { text: 'hello' })
    const restored = new OfflineQueueService()
    expect(restored.getPendingCount()).toBe(1)
  })

  it('replays operations in order', async () => {
    const replayed: string[] = []
    service.setReplayFn(async (op) => {
      replayed.push(op.id)
    })
    service.enqueue('message', '!room:1', { text: 'a' })
    service.enqueue('receipt', '!room:2', { eventId: 'b' })

    const result = await service.replayAll()
    expect(result.succeeded).toBe(2)
    expect(result.failed).toBe(0)
    expect(replayed.length).toBe(2)
    expect(service.getPendingCount()).toBe(0)
  })

  it('handles replay failures with retry', async () => {
    let _callCount = 0
    service.setReplayFn(async () => {
      _callCount++
      throw new Error('fail')
    })
    service.enqueue('message', '!room:test', { text: 'fail' })

    const result = await service.replayAll()
    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(0)
    expect(service.getQueue()[0].retryCount).toBe(1)
    expect(service.getQueue()[0].status).toBe('pending')
  })

  it('marks operations as failed after max retries', async () => {
    service.setReplayFn(async () => {
      throw new Error('fail')
    })
    service.enqueue('message', '!room:test', { text: 'fail' })

    await service.replayAll()
    await service.replayAll()
    await service.replayAll()

    expect(service.getQueue()[0].status).toBe('failed')
  })

  it('removes specific operations', () => {
    const id = service.enqueue('message', '!room:test', { text: 'hello' })
    service.removeOperation(id)
    expect(service.getPendingCount()).toBe(0)
  })

  it('clears all operations', () => {
    service.enqueue('message', '!room:1', { text: 'a' })
    service.enqueue('message', '!room:2', { text: 'b' })
    service.clearAll()
    expect(service.getQueue().length).toBe(0)
  })

  it('clears only failed operations', async () => {
    const failRoom = true
    service.setReplayFn(async (op) => {
      if (op.roomId === '!room:fail' && failRoom) {
        throw new Error('fail')
      }
    })
    const _failId = service.enqueue('message', '!room:fail', { text: 'fail' })
    service.enqueue('message', '!room:ok', { text: 'ok' })

    // Exhaust all retries for the fail item
    await service.replayAll()
    await service.replayAll()
    await service.replayAll()

    // Now the fail item should be 'failed', ok item should have been replayed successfully already
    const failedCount = service.getQueue().filter((op) => op.status === 'failed').length
    expect(failedCount).toBeGreaterThanOrEqual(1)

    service.clearFailed()
    const remaining = service.getQueue()
    expect(remaining.every((op) => op.status !== 'failed')).toBe(true)
  })
})
