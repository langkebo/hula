/**
 * TimerManager 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TimerManager } from '../TimerManager'

describe('TimerManager', () => {
  let timerManager: TimerManager

  beforeEach(() => {
    timerManager = new TimerManager()
    vi.useFakeTimers()
  })

  afterEach(() => {
    timerManager.clearAll()
    vi.useRealTimers()
  })

  describe('setTimeout', () => {
    it('应该创建并追踪 timeout', () => {
      const callback = vi.fn()
      const id = timerManager.setTimeout(callback, 1000)

      expect(id).toBeDefined()
      expect(timerManager.getActiveCount().timeouts).toBe(1)
    })

    it('应该在延迟后执行回调', () => {
      const callback = vi.fn()
      timerManager.setTimeout(callback, 1000)

      vi.advanceTimersByTime(1000)

      expect(callback).toHaveBeenCalled()
    })
  })

  describe('setInterval', () => {
    it('应该创建并追踪 interval', () => {
      const callback = vi.fn()
      const id = timerManager.setInterval(callback, 1000)

      expect(id).toBeDefined()
      expect(timerManager.getActiveCount().intervals).toBe(1)
    })

    it('应该重复执行回调', () => {
      const callback = vi.fn()
      timerManager.setInterval(callback, 1000)

      vi.advanceTimersByTime(3000)

      expect(callback).toHaveBeenCalledTimes(3)
    })
  })

  describe('clearTimeout', () => {
    it('应该清除指定的 timeout', () => {
      const callback = vi.fn()
      const id = timerManager.setTimeout(callback, 1000)

      timerManager.clearTimeout(id)

      vi.advanceTimersByTime(1000)

      expect(callback).not.toHaveBeenCalled()
      expect(timerManager.getActiveCount().timeouts).toBe(0)
    })

    it('应该忽略未知的 timeout ID', () => {
      expect(() => timerManager.clearTimeout(999999)).not.toThrow()
    })
  })

  describe('clearInterval', () => {
    it('应该清除指定的 interval', () => {
      const callback = vi.fn()
      const id = timerManager.setInterval(callback, 1000)

      timerManager.clearInterval(id)

      vi.advanceTimersByTime(3000)

      expect(callback).not.toHaveBeenCalled()
      expect(timerManager.getActiveCount().intervals).toBe(0)
    })

    it('应该忽略未知的 interval ID', () => {
      expect(() => timerManager.clearInterval(999999)).not.toThrow()
    })
  })

  describe('clearAll', () => {
    it('应该清除所有定时器', () => {
      const timeoutCallback = vi.fn()
      const intervalCallback = vi.fn()

      timerManager.setTimeout(timeoutCallback, 1000)
      timerManager.setInterval(intervalCallback, 1000)

      timerManager.clearAll()

      vi.advanceTimersByTime(3000)

      expect(timeoutCallback).not.toHaveBeenCalled()
      expect(intervalCallback).not.toHaveBeenCalled()
      expect(timerManager.getActiveCount().total).toBe(0)
    })
  })

  describe('getActiveCount', () => {
    it('应该返回正确的定时器计数', () => {
      timerManager.setTimeout(() => {}, 1000)
      timerManager.setTimeout(() => {}, 2000)
      timerManager.setInterval(() => {}, 1000)

      const count = timerManager.getActiveCount()

      expect(count.timeouts).toBe(2)
      expect(count.intervals).toBe(1)
      expect(count.total).toBe(3)
    })

    it('初始状态应该返回零', () => {
      const count = timerManager.getActiveCount()

      expect(count.timeouts).toBe(0)
      expect(count.intervals).toBe(0)
      expect(count.total).toBe(0)
    })
  })
})
