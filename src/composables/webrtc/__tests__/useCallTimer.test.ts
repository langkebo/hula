import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCallTimer } from '../useCallTimer'

describe('useCallTimer', () => {
  let now = 0
  let rafCb: FrameRequestCallback | null = null
  let rafHandle = 0

  beforeEach(() => {
    now = 0
    rafCb = null
    rafHandle = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => {
        rafCb = cb
        return ++rafHandle
      })
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('starts at 0 and exposes readable callDuration', () => {
    const { callDuration } = useCallTimer()
    expect(callDuration.value).toBe(0)
  })

  it('advances callDuration to the whole-second elapsed since startCallTimer', () => {
    const { callDuration, startCallTimer } = useCallTimer()
    now = 1000
    startCallTimer()
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)

    rafCb?.(4500)
    expect(callDuration.value).toBe(3)
    rafCb?.(7200)
    expect(callDuration.value).toBe(6)
  })

  it('stopCallTimer cancels the animation frame and resets duration', () => {
    const { callDuration, startCallTimer, stopCallTimer } = useCallTimer()
    startCallTimer()
    rafCb?.(3000)
    expect(callDuration.value).toBe(3)

    stopCallTimer()
    expect(cancelAnimationFrame).toHaveBeenCalledWith(rafHandle)
    expect(callDuration.value).toBe(0)
  })

  it('stopCallTimer is a no-op when not running', () => {
    const { stopCallTimer } = useCallTimer()
    expect(() => stopCallTimer()).not.toThrow()
    expect(cancelAnimationFrame).not.toHaveBeenCalled()
  })
})
