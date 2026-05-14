import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetCircuitBreakersForTest, CircuitOpenError, useCircuitBreaker } from '../useCircuitBreaker'

afterEach(() => {
  __resetCircuitBreakersForTest()
  vi.useRealTimers()
})

describe('useCircuitBreaker', () => {
  it('opens after threshold failures in the window', async () => {
    const t = 0
    const breaker = useCircuitBreaker('a', {
      failureThreshold: 3,
      failureWindowMs: 1_000,
      openMs: 5_000,
      now: () => t
    })

    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error('x')))).rejects.toThrow('x')
    }
    expect(breaker.state.value).toBe('open')

    await expect(breaker.execute(() => Promise.resolve('ok'))).rejects.toBeInstanceOf(CircuitOpenError)
  })

  it('transitions to half-open after openMs then closes on probe success', async () => {
    let t = 0
    const breaker = useCircuitBreaker('b', {
      failureThreshold: 2,
      failureWindowMs: 1_000,
      openMs: 100,
      now: () => t
    })

    await expect(breaker.execute(() => Promise.reject(new Error('e')))).rejects.toThrow('e')
    await expect(breaker.execute(() => Promise.reject(new Error('e')))).rejects.toThrow('e')
    expect(breaker.state.value).toBe('open')

    t += 150
    expect(breaker.canPass()).toBe(true)
    expect(breaker.state.value).toBe('half-open')

    const out = await breaker.execute(() => Promise.resolve('ok'))
    expect(out).toBe('ok')
    expect(breaker.state.value).toBe('closed')
  })

  it('re-opens when probe fails in half-open state', async () => {
    let t = 0
    const breaker = useCircuitBreaker('c', {
      failureThreshold: 1,
      failureWindowMs: 1_000,
      openMs: 100,
      now: () => t
    })

    await expect(breaker.execute(() => Promise.reject(new Error('e')))).rejects.toThrow('e')
    expect(breaker.state.value).toBe('open')

    t += 150
    expect(breaker.canPass()).toBe(true)
    expect(breaker.state.value).toBe('half-open')

    await expect(breaker.execute(() => Promise.reject(new Error('e')))).rejects.toThrow('e')
    expect(breaker.state.value).toBe('open')
  })

  it('isolates state per service name', async () => {
    const a = useCircuitBreaker('svc-a', { failureThreshold: 1 })
    const b = useCircuitBreaker('svc-b', { failureThreshold: 1 })

    await expect(a.execute(() => Promise.reject(new Error('e')))).rejects.toThrow('e')
    expect(a.state.value).toBe('open')
    expect(b.state.value).toBe('closed')
  })
})
