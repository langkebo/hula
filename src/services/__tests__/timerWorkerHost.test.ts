import { beforeEach, describe, expect, it, vi } from 'vitest'

type MockMessageEvent = { data: unknown }

class MockWorker {
  postMessage = vi.fn()
  terminate = vi.fn()
  onmessage: ((event: MockMessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  constructor() {
    mockInstances.push(this)
  }
}

let mockInstances: MockWorker[] = []

beforeEach(() => {
  vi.resetModules()
  mockInstances = []
  vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker)
})

describe('timerWorkerHost', () => {
  it('shares one Worker across acquired handles', async () => {
    const { acquireTimerWorker } = await import('../timerWorkerHost')
    const a = acquireTimerWorker()
    const b = acquireTimerWorker()
    expect(mockInstances).toHaveLength(1)
    a.release()
    b.release()
  })

  it('namespaces msgId per channel and routes replies back with the original id', async () => {
    const { acquireTimerWorker } = await import('../timerWorkerHost')
    const a = acquireTimerWorker()
    const b = acquireTimerWorker()
    const seenA: Array<{ type: string; msgId: string }> = []
    const seenB: Array<{ type: string; msgId: string }> = []
    a.onMessage((e) => seenA.push(e as { type: string; msgId: string }))
    b.onMessage((e) => seenB.push(e as { type: string; msgId: string }))

    // 两个消费者使用同一个 msgId 'checkUpdate'
    a.postMessage({ type: 'startTimer', msgId: 'checkUpdate', duration: 1 })
    b.postMessage({ type: 'startTimer', msgId: 'checkUpdate', duration: 1 })

    const rawA = mockInstances[0].postMessage.mock.calls[0][0]
    const rawB = mockInstances[0].postMessage.mock.calls[1][0]
    expect(rawA.msgId).not.toBe(rawB.msgId)
    expect(rawA.msgId.endsWith('checkUpdate')).toBe(true)

    // 模拟 worker 只回 channel A 的 timeout
    mockInstances[0].onmessage?.({ data: { type: 'timeout', msgId: rawA.msgId } })
    expect(seenA).toEqual([{ type: 'timeout', msgId: 'checkUpdate' }])
    expect(seenB).toEqual([])

    a.release()
    b.release()
  })

  it('broadcasts allTimersCompleted to every channel', async () => {
    const { acquireTimerWorker } = await import('../timerWorkerHost')
    const a = acquireTimerWorker()
    const b = acquireTimerWorker()
    const aEvents: string[] = []
    const bEvents: string[] = []
    a.onMessage((e) => aEvents.push(e.type))
    b.onMessage((e) => bEvents.push(e.type))

    mockInstances[0].onmessage?.({ data: { type: 'allTimersCompleted' } })
    expect(aEvents).toEqual(['allTimersCompleted'])
    expect(bEvents).toEqual(['allTimersCompleted'])

    a.release()
    b.release()
  })

  it('terminates the Worker only after the last release, then lazily recreates', async () => {
    const { acquireTimerWorker } = await import('../timerWorkerHost')
    const a = acquireTimerWorker()
    const b = acquireTimerWorker()
    a.release()
    expect(mockInstances[0].terminate).not.toHaveBeenCalled()
    b.release()
    expect(mockInstances[0].terminate).toHaveBeenCalledTimes(1)

    const c = acquireTimerWorker()
    expect(mockInstances).toHaveLength(2)
    c.release()
  })

  it('does not deliver to unsubscribed handlers', async () => {
    const { acquireTimerWorker } = await import('../timerWorkerHost')
    const a = acquireTimerWorker()
    const seen: string[] = []
    const off = a.onMessage((e) => seen.push(e.type))
    off()
    mockInstances[0].onmessage?.({ data: { type: 'allTimersCompleted' } })
    expect(seen).toEqual([])
    a.release()
  })

  it('broadcasts worker errors to all channels', async () => {
    const { acquireTimerWorker } = await import('../timerWorkerHost')
    const a = acquireTimerWorker()
    const onError = vi.fn()
    a.onError(onError)
    const err = new Event('error') as ErrorEvent
    mockInstances[0].onerror?.(err)
    expect(onError).toHaveBeenCalledWith(err)
    a.release()
  })
})
