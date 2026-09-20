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

  it('redacts nested message body on persist（真实调用方 payload 形状）', () => {
    // 真实形状：MatrixEventService 走 { roomId, eventType, content: { body, msgtype } }
    service.enqueue('message', '!room:test', {
      roomId: '!room:test',
      eventType: 'm.room.message',
      content: { msgtype: 'm.text', body: 'SECRET_NESTED_BODY' }
    })

    const stored = localStorage.getItem('tjg-offline-queue')
    expect(stored).toBeTruthy()
    // 明文不得出现在任何位置
    expect(stored).not.toContain('SECRET_NESTED_BODY')
    const parsed = JSON.parse(stored!)
    expect(parsed[0].payload.content.body).toBe('[redacted]')
    // 非敏感字段保留，保证队列结构可用于诊断
    expect(parsed[0].payload.content.msgtype).toBe('m.text')
    expect(parsed[0].payload.eventType).toBe('m.room.message')
  })

  it('redacts deeply nested { tempMsgId, payload } 形状', () => {
    service.enqueue('message', '!room:test', {
      tempMsgId: 'tmp-1',
      payload: { body: { msgtype: 'm.image', body: 'SECRET_DEEP' } }
    })

    const stored = localStorage.getItem('tjg-offline-queue')
    expect(stored).not.toContain('SECRET_DEEP')
    const parsed = JSON.parse(stored!)
    expect(parsed[0].payload.payload.body).toBe('[redacted]')
  })

  it('嵌套载荷被脱敏的操作在 restore 后不得残留为 pending', () => {
    service.enqueue('message', '!room:test', {
      roomId: '!room:test',
      eventType: 'm.room.message',
      content: { msgtype: 'm.text', body: 'SECRET_RESTORE' }
    })

    const restored = new OfflineQueueService()
    // 内容已丢失，无法 replay：必须按失败处理而不是留在 pending
    expect(restored.getPendingCount()).toBe(0)
    expect(restored.getQueue().length).toBe(0)
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
