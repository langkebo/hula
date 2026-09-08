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

  it('persists and restores from localStorage (non-sensitive types)', () => {
    service.enqueue('receipt', '!room:test', { eventId: '$event:123' })
    const restored = new OfflineQueueService()
    expect(restored.getPendingCount()).toBe(1)
  })

  it('redacts sensitive payload fields on persist (F-13)', () => {
    service.enqueue('message', '!room:test', { text: 'hello', msgtype: 'm.text' })
    // 验证 text 字段被脱敏为 '[redacted]' 后写入 localStorage
    const stored = localStorage.getItem('tjg-offline-queue')
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed[0].payload.text).toBe('[redacted]')
    // msgtype 等非敏感字段应保留原值
    expect(parsed[0].payload.msgtype).toBe('m.text')
  })

  it('marks redacted message operations as failed on restore (F-13)', () => {
    service.enqueue('message', '!room:test', { text: 'hello' })
    const restored = new OfflineQueueService()
    // 被脱敏的操作无法 replay，应被标记为 failed 并从 pending 队列中移除
    expect(restored.getPendingCount()).toBe(0)
    const queue = restored.getQueue()
    expect(queue.length).toBe(0) // failed operations are filtered out on restore
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

  it('marks replay failures as failed after exhausting in-call retries', async () => {
    let _callCount = 0
    service.setReplayFn(async () => {
      _callCount++
      throw new Error('fail')
    })
    service.enqueue('message', '!room:test', { text: 'fail' })

    const result = await service.replayAll()
    expect(result.succeeded).toBe(0)
    expect(result.failed).toBe(1)
    expect(service.getQueue()[0].retryCount).toBe(3)
    expect(service.getQueue()[0].status).toBe('failed')
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
    service.enqueue('message', '!room:fail', { text: 'fail' })
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
