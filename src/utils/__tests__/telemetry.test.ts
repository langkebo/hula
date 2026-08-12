import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

import { errorTracker } from '@/utils/ErrorTracker'
import { type TelemetryEvent, track } from '@/utils/telemetry'

describe('telemetry 事件总线 (O2)', () => {
  beforeEach(() => {
    errorTracker.clearErrors()
    errorTracker.terminate()
  })

  afterEach(() => {
    errorTracker.terminate()
    vi.restoreAllMocks()
  })

  describe('error 事件分发', () => {
    it('Error 对象直接传递给 ErrorTracker', () => {
      errorTracker.initialize({ enableGlobalHandlers: false })
      const spy = vi.spyOn(errorTracker, 'trackError')
      const err = new Error('test error')

      track({ kind: 'error', name: 'test', error: err })

      expect(spy).toHaveBeenCalledWith('manual', err, {})
    })

    it('非 Error 对象包装为 Error', () => {
      errorTracker.initialize({ enableGlobalHandlers: false })
      const spy = vi.spyOn(errorTracker, 'trackError')

      track({ kind: 'error', name: 'test', error: 'string error' })

      expect(spy).toHaveBeenCalledWith('manual', expect.any(Error), {})
      expect((spy.mock.calls[0][1] as Error).message).toBe('string error')
    })
  })

  describe('health 事件分发', () => {
    it('warn 级别调用 trackManual', () => {
      errorTracker.initialize({ enableGlobalHandlers: false })
      const spy = vi.spyOn(errorTracker, 'trackManual')

      track({ kind: 'health', name: 'friend_manager_degraded', severity: 'warn', context: { reason: 'test' } })

      expect(spy).toHaveBeenCalledWith('friend_manager_degraded', { reason: 'test' })
    })

    it('error 级别调用 trackManual', () => {
      errorTracker.initialize({ enableGlobalHandlers: false })
      const spy = vi.spyOn(errorTracker, 'trackManual')

      track({ kind: 'health', name: 'critical_failure', severity: 'error' })

      expect(spy).toHaveBeenCalledWith('critical_failure', {})
    })

    it('info 级别不调用 trackManual', () => {
      errorTracker.initialize({ enableGlobalHandlers: false })
      const spy = vi.spyOn(errorTracker, 'trackManual')

      track({ kind: 'health', name: 'info_event', severity: 'info' })

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('perf 事件分发', () => {
    it('不抛异常（预留接口）', () => {
      const event: TelemetryEvent = { kind: 'perf', name: 'startup', durationMs: 1200 }

      expect(() => track(event)).not.toThrow()
    })
  })

  describe('健壮性', () => {
    it('track 内部异常不影响主流程', () => {
      vi.spyOn(errorTracker, 'trackError').mockImplementation(() => {
        throw new Error('internal error')
      })

      expect(() => track({ kind: 'error', name: 'test', error: new Error('test') })).not.toThrow()
    })
  })
})
