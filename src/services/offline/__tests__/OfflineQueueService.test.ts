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

  it('嵌套载荷被脱敏的操作在 restore 后标记为 failed 且不可重试（H-8）', () => {
    service.enqueue('message', '!room:test', {
      roomId: '!room:test',
      eventType: 'm.room.message',
      content: { msgtype: 'm.text', body: 'SECRET_RESTORE' }
    })

    const restored = new OfflineQueueService()
    // 内容已丢失，无法 replay：必须按失败处理而不是留在 pending
    expect(restored.getPendingCount()).toBe(0)
    // 但记录不能静默消失，否则用户以为消息已发出
    expect(restored.getFailedCount()).toBe(1)
    expect(restored.getQueue()[0].status).toBe('failed')
    expect(restored.getQueue()[0].payloadRedacted).toBe(true)
    // 脱敏记录不允许重发（会把 [redacted] 当正文发出去）
    expect(restored.retryFailed()).toBe(0)
  })

  it('marks redacted message operations as failed on restore (F-13)', () => {
    service.enqueue('message', '!room:test', { text: 'hello' })
    const restored = new OfflineQueueService()
    // 被脱敏的操作无法 replay，应被标记为 failed 并保留在队列中供 UI 提示
    expect(restored.getPendingCount()).toBe(0)
    expect(restored.getFailedCount()).toBe(1)
    expect(restored.getQueue()[0].status).toBe('failed')
  })

  it('persists failed operations across restarts（H-8）', async () => {
    service.setReplayFn(async () => {
      throw new Error('fail')
    })
    service.enqueue('receipt', '!room:test', { eventId: '$event:1' })
    await service.replayAll()
    expect(service.getFailedCount()).toBe(1)

    const restored = new OfflineQueueService()
    expect(restored.getFailedCount()).toBe(1)
    expect(restored.getPendingCount()).toBe(0)
  })

  it('retryFailed 将 failed 重置为 pending 并可重新投递（H-8）', async () => {
    service.setReplayFn(async () => {
      throw new Error('fail')
    })
    service.enqueue('receipt', '!room:test', { eventId: '$event:1' })
    await service.replayAll()
    expect(service.getFailedCount()).toBe(1)

    const reset = service.retryFailed()
    expect(reset).toBe(1)
    expect(service.getPendingCount()).toBe(1)
    expect(service.getQueue()[0].retryCount).toBe(0)

    service.setReplayFn(async () => {})
    const result = await service.replayAll()
    expect(result.succeeded).toBe(1)
    expect(service.getQueue().length).toBe(0)
  })

  it('队列超过上限时淘汰最旧的操作（H-8）', () => {
    for (let i = 0; i < 205; i++) {
      service.enqueue('receipt', `!room:${i}`, { eventId: `$event:${i}` })
    }

    expect(service.getQueue().length).toBe(200)
    // 最旧的 5 个被淘汰，队首应为第 6 个入队的操作
    expect(service.getQueue()[0].roomId).toBe('!room:5')
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

  describe('连接就绪重放', () => {
    /** 极简的 connectionState 事件源替身 */
    const createSource = (initial: string) => {
      const handlers = new Set<(data: unknown) => void>()
      let state = initial
      return {
        source: {
          on: (_event: 'connectionState', handler: (data: unknown) => void) => handlers.add(handler),
          off: (_event: 'connectionState', handler: (data: unknown) => void) => handlers.delete(handler),
          getConnectionState: () => state
        },
        emit(next: string) {
          state = next
          for (const handler of handlers) handler({ state: next })
        },
        handlerCount: () => handlers.size
      }
    }

    it('CONNECTED 状态迁移触发队列重放', async () => {
      const replayed = vi.fn(async () => {})
      service.setReplayFn(replayed)
      service.enqueue('receipt', '!room:test', { eventId: '$event:1' })

      const { source, emit } = createSource('CONNECTING')
      service.startConnectionListener(source)
      emit('CONNECTED')

      await vi.waitFor(() => expect(replayed).toHaveBeenCalledTimes(1))
      expect(service.getPendingCount()).toBe(0)
    })

    it('CATCHUP 也视为就绪（历史补齐不阻塞发送）', async () => {
      const replayed = vi.fn(async () => {})
      service.setReplayFn(replayed)
      service.enqueue('receipt', '!room:test', { eventId: '$event:1' })

      const { source, emit } = createSource('CONNECTING')
      service.startConnectionListener(source)
      emit('CATCHUP')

      await vi.waitFor(() => expect(replayed).toHaveBeenCalledTimes(1))
    })

    it('未就绪状态不触发重放', async () => {
      const replayed = vi.fn(async () => {})
      service.setReplayFn(replayed)
      service.enqueue('receipt', '!room:test', { eventId: '$event:1' })

      const { source, emit } = createSource('DISCONNECTED')
      service.startConnectionListener(source)
      emit('CONNECTING')
      emit('RECONNECTING')

      await Promise.resolve()
      expect(replayed).not.toHaveBeenCalled()
      expect(service.getPendingCount()).toBe(1)
    })

    it('启动时连接已就绪也会重放（不会再产生状态迁移事件）', async () => {
      const replayed = vi.fn(async () => {})
      service.setReplayFn(replayed)
      service.enqueue('receipt', '!room:test', { eventId: '$event:1' })

      const { source } = createSource('CONNECTED')
      service.startConnectionListener(source)

      await vi.waitFor(() => expect(replayed).toHaveBeenCalledTimes(1))
    })

    it('stopConnectionListener 解除订阅；重复启动不会注册多次', () => {
      const { source, handlerCount } = createSource('DISCONNECTED')
      service.startConnectionListener(source)
      service.startConnectionListener(source)
      expect(handlerCount()).toBe(1)

      service.stopConnectionListener()
      expect(handlerCount()).toBe(0)
    })
  })
})
