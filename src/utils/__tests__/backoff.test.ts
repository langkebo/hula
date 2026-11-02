import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeBackoffDelay, sleep } from '../backoff'

describe('computeBackoffDelay', () => {
  it('按 2 的幂次增长', () => {
    expect(computeBackoffDelay({ baseDelayMs: 1000, attempt: 0 })).toBe(1000)
    expect(computeBackoffDelay({ baseDelayMs: 1000, attempt: 1 })).toBe(2000)
    expect(computeBackoffDelay({ baseDelayMs: 1000, attempt: 4 })).toBe(16000)
  })

  it('收敛到 maxDelayMs 上限', () => {
    expect(computeBackoffDelay({ baseDelayMs: 1000, attempt: 10, maxDelayMs: 30000 })).toBe(30000)
  })

  it('负数 attempt 按 0 处理', () => {
    expect(computeBackoffDelay({ baseDelayMs: 500, attempt: -3 })).toBe(500)
  })

  it('小数 attempt 向下取整', () => {
    expect(computeBackoffDelay({ baseDelayMs: 100, attempt: 1.9 })).toBe(200)
  })
})

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('等待指定时长后 resolve', async () => {
    let settled = false
    const pending = sleep(500).then(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(499)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(settled).toBe(true)
  })

  it('负值按 0 处理，立即 resolve', async () => {
    let settled = false
    const pending = sleep(-100).then(() => {
      settled = true
    })

    await vi.advanceTimersByTimeAsync(0)
    await pending
    expect(settled).toBe(true)
  })
})
