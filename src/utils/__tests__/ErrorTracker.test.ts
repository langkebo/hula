import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

import { type ErrorContext, errorTracker } from '@/utils/ErrorTracker'

describe('ErrorTracker', () => {
  beforeEach(() => {
    errorTracker.clearErrors()
    errorTracker.terminate()
  })

  afterEach(() => {
    errorTracker.terminate()
  })

  describe('initialization', () => {
    it('initializes successfully', () => {
      errorTracker.initialize({ enableGlobalHandlers: false })
      const errors = errorTracker.getErrors()
      expect(errors).toEqual([])
    })

    it('does not re-initialize if already initialized', () => {
      errorTracker.initialize({ enableGlobalHandlers: false })
      const _initialTime = Date.now()
      errorTracker.initialize({ enableGlobalHandlers: false })
      // Should not throw and should keep working
      expect(errorTracker.getErrors()).toEqual([])
    })

    it('initializes with custom config', () => {
      errorTracker.initialize({
        maxStoredErrors: 50,
        dedupWindow: 30000,
        enableGlobalHandlers: false
      })
      expect(errorTracker.getErrors()).toEqual([])
    })

    // O6 契约：重复 init 不应重复注册全局 handler
    it('重复 init 不重复注册 window.onerror / onunhandledrejection', () => {
      errorTracker.initialize({ enableGlobalHandlers: true })
      const handlerAfterFirstInit = window.onerror
      const rejectionHandlerAfterFirstInit = window.onunhandledrejection

      errorTracker.initialize({ enableGlobalHandlers: true })

      expect(window.onerror).toBe(handlerAfterFirstInit)
      expect(window.onunhandledrejection).toBe(rejectionHandlerAfterFirstInit)
    })
  })

  describe('tracking errors', () => {
    beforeEach(() => {
      errorTracker.initialize({ enableGlobalHandlers: false })
    })

    it('tracks unhandled errors', () => {
      const err = new Error('test unhandled error')
      errorTracker.trackError('unhandled', err)
      const errors = errorTracker.getErrors()
      expect(errors).toHaveLength(1)
      expect(errors[0].type).toBe('unhandled')
      expect(errors[0].message).toBe('test unhandled error')
    })

    it('tracks promise errors', () => {
      const err = new Error('promise rejection')
      errorTracker.trackError('promise', err)
      const errors = errorTracker.getErrors()
      expect(errors).toHaveLength(1)
      expect(errors[0].type).toBe('promise')
    })

    it('tracks vue errors via trackVueError', () => {
      const err = new Error('vue component error')
      errorTracker.trackVueError(err)
      const errors = errorTracker.getErrors()
      expect(errors).toHaveLength(1)
      expect(errors[0].type).toBe('vue')
    })

    it('tracks manual errors via trackManual', () => {
      errorTracker.trackManual('manual tracking test')
      const errors = errorTracker.getErrors()
      expect(errors).toHaveLength(1)
      expect(errors[0].type).toBe('manual')
      expect(errors[0].message).toBe('manual tracking test')
    })
  })

  describe('error context', () => {
    beforeEach(() => {
      errorTracker.initialize({ enableGlobalHandlers: false })
    })

    it('stores error context', () => {
      const context: ErrorContext = {
        component: 'LoginForm',
        action: 'submitLogin',
        route: '/login'
      }
      const err = new Error('login error')
      errorTracker.trackError('manual', err, context)
      const errors = errorTracker.getErrors()
      expect(errors[0].context).toEqual(context)
    })

    it('context defaults to empty object', () => {
      const err = new Error('no context')
      errorTracker.trackError('manual', err)
      const errors = errorTracker.getErrors()
      expect(errors[0].context).toEqual({})
    })
  })

  describe('deduplication', () => {
    beforeEach(() => {
      errorTracker.initialize({
        enableGlobalHandlers: false,
        dedupWindow: 999999 // very long dedup window
      })
    })

    it('increments count for duplicate errors within dedup window', () => {
      const err = new Error('duplicate')
      errorTracker.trackError('manual', err)
      errorTracker.trackError('manual', err)
      errorTracker.trackError('manual', err)
      const errors = errorTracker.getErrors()
      expect(errors).toHaveLength(1)
      expect(errors[0].count).toBe(3)
    })

    it('records firstSeen and lastSeen', () => {
      const err = new Error('timing test')
      const before = Date.now()
      errorTracker.trackError('manual', err)
      const errors = errorTracker.getErrors()
      expect(errors[0].firstSeen).toBeGreaterThanOrEqual(before)
      expect(errors[0].lastSeen).toBeGreaterThanOrEqual(errors[0].firstSeen)
    })

    it('different errors are stored separately', () => {
      errorTracker.trackError('manual', new Error('error A'))
      errorTracker.trackError('manual', new Error('error B'))
      const errors = errorTracker.getErrors()
      expect(errors).toHaveLength(2)
    })

    it('error with different context is treated as different error', () => {
      const err = new Error('same message')
      errorTracker.trackError('manual', err, { component: 'CompA' })
      errorTracker.trackError('manual', err, { component: 'CompB' })
      const errors = errorTracker.getErrors()
      expect(errors).toHaveLength(2)
    })
  })

  describe('ignored messages', () => {
    beforeEach(() => {
      errorTracker.initialize({ enableGlobalHandlers: false })
    })

    it('ignores ResizeObserver messages', () => {
      const err = new Error('ResizeObserver loop completed with undelivered notifications')
      errorTracker.trackError('manual', err)
      expect(errorTracker.getErrors()).toHaveLength(0)
    })

    it('ignores ResizeObserver limit exceeded', () => {
      const err = new Error('ResizeObserver loop limit exceeded')
      errorTracker.trackError('manual', err)
      expect(errorTracker.getErrors()).toHaveLength(0)
    })

    it('ignores insecure operation messages', () => {
      const err = new Error('The operation is insecure')
      errorTracker.trackError('manual', err)
      expect(errorTracker.getErrors()).toHaveLength(0)
    })

    it('ignores seemly rgba warnings', () => {
      const err = new Error('[seemly/rgba]: Invalid color value')
      errorTracker.trackError('manual', err)
      expect(errorTracker.getErrors()).toHaveLength(0)
    })

    it('ignores window not found messages', () => {
      const err = new Error('window not found')
      errorTracker.trackError('manual', err)
      expect(errorTracker.getErrors()).toHaveLength(0)
    })

    it('does not ignore normal error messages', () => {
      const err = new Error('a real application error')
      errorTracker.trackError('manual', err)
      expect(errorTracker.getErrors()).toHaveLength(1)
    })
  })

  describe('filtering by type', () => {
    beforeEach(() => {
      errorTracker.initialize({ enableGlobalHandlers: false })
    })

    it('filters errors by type', () => {
      errorTracker.trackError('manual', new Error('m1'))
      errorTracker.trackError('unhandled', new Error('u1'))
      errorTracker.trackError('promise', new Error('p1'))
      errorTracker.trackError('vue', new Error('v1'))

      expect(errorTracker.getErrors('manual')).toHaveLength(1)
      expect(errorTracker.getErrors('unhandled')).toHaveLength(1)
      expect(errorTracker.getErrors('promise')).toHaveLength(1)
      expect(errorTracker.getErrors('vue')).toHaveLength(1)
    })
  })

  describe('error count', () => {
    beforeEach(() => {
      errorTracker.initialize({
        enableGlobalHandlers: false,
        dedupWindow: 999999
      })
    })

    it('counts total errors including duplicates', () => {
      const err = new Error('repeated')
      errorTracker.trackError('manual', err)
      errorTracker.trackError('manual', err)
      errorTracker.trackError('manual', err)
      expect(errorTracker.getErrorCount()).toBe(3)
    })

    it('counts errors by type', () => {
      errorTracker.trackError('manual', new Error('m'))
      errorTracker.trackError('unhandled', new Error('u'))
      expect(errorTracker.getErrorCount('manual')).toBe(1)
      expect(errorTracker.getErrorCount('unhandled')).toBe(1)
    })
  })

  describe('error summary', () => {
    beforeEach(() => {
      errorTracker.initialize({
        enableGlobalHandlers: false,
        dedupWindow: 999999
      })
    })

    it('provides error summary', () => {
      errorTracker.trackError('manual', new Error('m'))
      errorTracker.trackError('unhandled', new Error('u'))
      errorTracker.trackError('promise', new Error('p'))
      errorTracker.trackError('vue', new Error('v'))

      const summary = errorTracker.getErrorSummary()
      expect(summary.total).toBe(4)
      expect(summary.manual).toBe(1)
      expect(summary.unhandled).toBe(1)
      expect(summary.promise).toBe(1)
      expect(summary.vue).toBe(1)
      expect(summary.topErrors).toHaveLength(4)
    })

    it('topErrors limits to specified count', () => {
      for (let i = 0; i < 10; i++) {
        errorTracker.trackError('manual', new Error(`err${i}`))
      }
      const summary = errorTracker.getErrorSummary()
      expect(summary.topErrors.length).toBeLessThanOrEqual(5)
    })
  })

  describe('getTopErrors', () => {
    beforeEach(() => {
      errorTracker.initialize({
        enableGlobalHandlers: false,
        dedupWindow: 999999
      })
    })

    it('returns top errors sorted by count', () => {
      const frequent = new Error('frequent error')
      const rare = new Error('rare error')
      errorTracker.trackError('manual', frequent)
      errorTracker.trackError('manual', frequent)
      errorTracker.trackError('manual', frequent)
      errorTracker.trackError('manual', rare)

      const top = errorTracker.getTopErrors(5)
      expect(top[0].message).toBe('frequent error')
      expect(top[0].count).toBe(3)
    })
  })

  describe('cleanup', () => {
    it('clearErrors removes all errors', () => {
      errorTracker.initialize({ enableGlobalHandlers: false })
      errorTracker.trackError('manual', new Error('e1'))
      errorTracker.trackError('manual', new Error('e2'))
      errorTracker.clearErrors()
      expect(errorTracker.getErrors()).toHaveLength(0)
    })

    it('terminate clears errors and resets initialized state', () => {
      errorTracker.initialize({ enableGlobalHandlers: false })
      errorTracker.trackError('manual', new Error('e1'))
      errorTracker.terminate()
      expect(errorTracker.getErrors()).toHaveLength(0)
      // Re-initialize should work after terminate
      errorTracker.initialize({ enableGlobalHandlers: false })
      expect(errorTracker.getErrors()).toHaveLength(0)
    })
  })

  describe('max stored errors', () => {
    it('enforces maxStoredErrors limit', () => {
      errorTracker.initialize({
        enableGlobalHandlers: false,
        maxStoredErrors: 5,
        dedupWindow: 0 // no dedup window, each is unique
      })

      for (let i = 0; i < 20; i++) {
        errorTracker.trackError('manual', new Error(`error ${i}`))
      }
      // Should keep only the 5 most recent
      expect(errorTracker.getErrors().length).toBeLessThanOrEqual(5)
    })
  })

  describe('tracked error structure', () => {
    beforeEach(() => {
      errorTracker.initialize({ enableGlobalHandlers: false })
    })

    it('tracked error has all required fields', () => {
      const err = new Error('structured test')
      const context: ErrorContext = { component: 'Test', route: '/' }
      errorTracker.trackError('manual', err, context)

      const tracked = errorTracker.getErrors()[0]
      expect(tracked).toBeDefined()
      expect(tracked.type).toBe('manual')
      expect(tracked.message).toBe('structured test')
      expect(tracked.stack).toBeDefined()
      expect(tracked.context).toEqual(context)
      expect(typeof tracked.timestamp).toBe('number')
      expect(typeof tracked.fingerprint).toBe('string')
      expect(typeof tracked.count).toBe('number')
      expect(typeof tracked.firstSeen).toBe('number')
      expect(typeof tracked.lastSeen).toBe('number')
    })
  })
})
