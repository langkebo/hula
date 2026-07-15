import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoScrollGuard } from '@/composables/chat/useAutoScrollGuard'

describe('useAutoScrollGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('initializes with isAutoScrolling as false', () => {
    const { isAutoScrolling } = useAutoScrollGuard()
    expect(isAutoScrolling.value).toBe(false)
  })

  it('sets isAutoScrolling to true when enableAutoScroll is called', () => {
    const { isAutoScrolling, enableAutoScroll } = useAutoScrollGuard()
    enableAutoScroll(500)
    expect(isAutoScrolling.value).toBe(true)
  })

  it('resets isAutoScrolling to false after duration', async () => {
    const { isAutoScrolling, enableAutoScroll } = useAutoScrollGuard()
    enableAutoScroll(500)
    expect(isAutoScrolling.value).toBe(true)

    vi.advanceTimersByTime(600)
    await vi.runAllTimersAsync()
    expect(isAutoScrolling.value).toBe(false)
  })

  it('extends duration when enableAutoScroll is called multiple times', () => {
    const { isAutoScrolling, enableAutoScroll } = useAutoScrollGuard()
    enableAutoScroll(300)
    expect(isAutoScrolling.value).toBe(true)

    vi.advanceTimersByTime(200)
    enableAutoScroll(300)

    vi.advanceTimersByTime(250)
    expect(isAutoScrolling.value).toBe(true)
  })

  it('stops guard immediately when stopAutoScrollGuard is called', () => {
    const { isAutoScrolling, enableAutoScroll, stopAutoScrollGuard } = useAutoScrollGuard()
    enableAutoScroll(500)
    expect(isAutoScrolling.value).toBe(true)

    stopAutoScrollGuard()
    expect(isAutoScrolling.value).toBe(false)
  })
})
