import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TimerManager } from '../TimerManager'

describe('TimerManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('setTimeout', () => {
    it('invokes callback after the delay', () => {
      const manager = new TimerManager()
      const cb = vi.fn()
      manager.setTimeout(cb, 100)
      expect(cb).not.toHaveBeenCalled()
      vi.advanceTimersByTime(100)
      expect(cb).toHaveBeenCalledTimes(1)
    })

    it('removes timer from active set after firing', () => {
      const manager = new TimerManager()
      manager.setTimeout(() => {}, 100)
      expect(manager.getActiveCount().timeouts).toBe(1)
      vi.advanceTimersByTime(100)
      expect(manager.getActiveCount().timeouts).toBe(0)
    })
  })

  describe('setInterval', () => {
    it('invokes callback repeatedly', () => {
      const manager = new TimerManager()
      const cb = vi.fn()
      manager.setInterval(cb, 50)
      vi.advanceTimersByTime(150)
      expect(cb).toHaveBeenCalledTimes(3)
    })

    it('keeps interval id in active set until cleared', () => {
      const manager = new TimerManager()
      const id = manager.setInterval(() => {}, 50)
      expect(manager.getActiveCount().intervals).toBe(1)
      manager.clearInterval(id)
      expect(manager.getActiveCount().intervals).toBe(0)
    })
  })

  describe('clearTimeout / clearInterval', () => {
    it('clearTimeout cancels pending timeout', () => {
      const manager = new TimerManager()
      const cb = vi.fn()
      const id = manager.setTimeout(cb, 100)
      manager.clearTimeout(id)
      vi.advanceTimersByTime(200)
      expect(cb).not.toHaveBeenCalled()
    })

    it('clearTimeout is a no-op for unknown id', () => {
      const manager = new TimerManager()
      expect(() => manager.clearTimeout(99999)).not.toThrow()
    })

    it('clearInterval stops further callbacks', () => {
      const manager = new TimerManager()
      const cb = vi.fn()
      const id = manager.setInterval(cb, 50)
      vi.advanceTimersByTime(60)
      manager.clearInterval(id)
      vi.advanceTimersByTime(200)
      expect(cb).toHaveBeenCalledTimes(1)
    })
  })

  describe('clearAll', () => {
    it('clears all timeouts and intervals', () => {
      const manager = new TimerManager()
      const t = vi.fn()
      const i = vi.fn()
      manager.setTimeout(t, 100)
      manager.setInterval(i, 50)
      manager.clearAll()
      vi.advanceTimersByTime(500)
      expect(t).not.toHaveBeenCalled()
      expect(i).not.toHaveBeenCalled()
      expect(manager.getActiveCount().total).toBe(0)
    })
  })

  describe('getActiveCount', () => {
    it('reports zero when nothing scheduled', () => {
      const manager = new TimerManager()
      expect(manager.getActiveCount()).toEqual({ timeouts: 0, intervals: 0, total: 0 })
    })

    it('reports current active timers and intervals', () => {
      const manager = new TimerManager()
      manager.setTimeout(() => {}, 100)
      manager.setTimeout(() => {}, 200)
      manager.setInterval(() => {}, 100)
      expect(manager.getActiveCount()).toEqual({ timeouts: 2, intervals: 1, total: 3 })
    })
  })
})
