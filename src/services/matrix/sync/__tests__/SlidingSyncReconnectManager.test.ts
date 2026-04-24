import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SlidingSyncReconnectManager } from '../SlidingSyncReconnectManager'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

describe('SlidingSyncReconnectManager', () => {
  let manager: SlidingSyncReconnectManager

  beforeEach(() => {
    vi.useFakeTimers()
    manager = new SlidingSyncReconnectManager({ maxRetries: 3, baseDelay: 100, jitter: false })
  })

  afterEach(() => {
    manager.destroy()
    vi.useRealTimers()
  })

  it('starts in idle state', () => {
    expect(manager.getState()).toBe('idle')
    expect(manager.getRetryCount()).toBe(0)
  })

  it('transitions to connected on onConnected', () => {
    const onStateChange = vi.fn()
    manager.registerCallbacks({ onStateChange })
    manager.onConnected()
    expect(manager.getState()).toBe('connected')
    expect(onStateChange).toHaveBeenCalledWith('connected', 0)
  })

  it('schedules reconnect on disconnect', () => {
    const onStateChange = vi.fn()
    manager.registerCallbacks({ onStateChange })
    manager.onDisconnected(new Error('test'))
    expect(manager.getState()).toBe('reconnecting')
    expect(manager.getRetryCount()).toBe(1)
  })

  it('uses exponential backoff', async () => {
    const onReconnectAttempt = vi.fn()
    manager.setReconnectFn(async () => {
      throw new Error('fail')
    })
    manager.registerCallbacks({ onReconnectAttempt })

    manager.onDisconnected()
    expect(onReconnectAttempt).toHaveBeenCalledWith(1, 100)

    await vi.advanceTimersByTimeAsync(100)
    expect(onReconnectAttempt).toHaveBeenCalledWith(2, 200)
  })

  it('fails after max retries', async () => {
    const onFailed = vi.fn()
    manager.setReconnectFn(async () => {
      throw new Error('fail')
    })
    manager.registerCallbacks({ onFailed })

    manager.onDisconnected()
    await vi.advanceTimersByTimeAsync(100)
    await vi.advanceTimersByTimeAsync(200)
    await vi.advanceTimersByTimeAsync(400)

    expect(manager.getState()).toBe('failed')
    expect(onFailed).toHaveBeenCalled()
  })

  it('resets retry count on successful reconnect', () => {
    manager.onDisconnected()
    expect(manager.getRetryCount()).toBe(1)
    manager.onConnected()
    expect(manager.getRetryCount()).toBe(0)
    expect(manager.getState()).toBe('connected')
  })

  it('calls onReconnected callback', () => {
    const onReconnected = vi.fn()
    manager.registerCallbacks({ onReconnected })
    manager.onDisconnected()
    manager.onConnected()
    expect(onReconnected).toHaveBeenCalledTimes(1)
  })

  it('reset clears state', () => {
    manager.onDisconnected()
    manager.reset()
    expect(manager.getState()).toBe('idle')
    expect(manager.getRetryCount()).toBe(0)
  })
})
