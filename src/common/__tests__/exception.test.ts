import { describe, expect, it, vi } from 'vitest'

const { mockShowFeedback } = vi.hoisted(() => ({
  mockShowFeedback: vi.fn()
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: mockShowFeedback
  })
}))

import { AppException, ErrorType } from '@/common/exception'

describe('AppException', () => {
  describe('construction', () => {
    it('creates with message only', () => {
      const ex = new AppException('test error')
      expect(ex).toBeInstanceOf(Error)
      expect(ex).toBeInstanceOf(AppException)
      expect(ex.message).toBe('test error')
      expect(ex.name).toBe('AppException')
      expect(ex.type).toBe(ErrorType.Unknown)
    })

    it('creates with message and type', () => {
      const ex = new AppException('network failed', { type: ErrorType.Network })
      expect(ex.type).toBe(ErrorType.Network)
      expect(ex.message).toBe('network failed')
    })

    it('creates with message and code', () => {
      const ex = new AppException('server error', {
        type: ErrorType.Server,
        code: 500
      })
      expect(ex.type).toBe(ErrorType.Server)
      expect(ex.code).toBe(500)
    })

    it('creates with details', () => {
      const details = { retryAfterMs: 3000, endpoint: '/api/test' }
      const ex = new AppException('rate limited', {
        type: ErrorType.RateLimit,
        details
      })
      expect(ex.details).toEqual(details)
    })

    it('default type is Unknown when not provided', () => {
      const ex = new AppException('unknown')
      expect(ex.type).toBe(ErrorType.Unknown)
    })

    it('code is undefined when not provided', () => {
      const ex = new AppException('error')
      expect(ex.code).toBeUndefined()
    })

    it('details is undefined when not provided', () => {
      const ex = new AppException('error')
      expect(ex.details).toBeUndefined()
    })
  })

  describe('toJSON', () => {
    it('serializes basic exception', () => {
      const ex = new AppException('test', { type: ErrorType.Validation })
      const json = ex.toJSON()
      expect(json).toEqual({
        name: 'AppException',
        message: 'test',
        type: ErrorType.Validation,
        code: undefined,
        details: undefined
      })
    })

    it('serializes exception with code', () => {
      const ex = new AppException('test', {
        type: ErrorType.Server,
        code: 503
      })
      const json = ex.toJSON()
      expect(json.code).toBe(503)
    })

    it('serializes exception with details', () => {
      const details = { foo: 'bar' }
      const ex = new AppException('test', {
        type: ErrorType.Network,
        details
      })
      const json = ex.toJSON()
      expect(json.details).toEqual({ foo: 'bar' })
    })
  })

  describe('toString', () => {
    it('toString returns message', () => {
      const ex = new AppException('custom error')
      expect(ex.toString()).toContain('custom error')
    })
  })

  describe('error types', () => {
    it('all ErrorType enums are accessible', () => {
      expect(ErrorType.Network).toBe('Network')
      expect(ErrorType.Server).toBe('Server')
      expect(ErrorType.Client).toBe('Client')
      expect(ErrorType.Validation).toBe('Validation')
      expect(ErrorType.Authentication).toBe('Authentication')
      expect(ErrorType.Unknown).toBe('Unknown')
      expect(ErrorType.TokenExpired).toBe('TokenExpired')
      expect(ErrorType.TokenInvalid).toBe('TokenInvalid')
      expect(ErrorType.RateLimit).toBe('RateLimit')
      expect(ErrorType.Permission).toBe('Permission')
      expect(ErrorType.NotFound).toBe('NotFound')
    })
  })

  describe('isError and Error inheritance', () => {
    it('can be caught as Error', () => {
      try {
        throw new AppException('caught')
      } catch (e) {
        expect(e).toBeInstanceOf(Error)
        expect((e as AppException).message).toBe('caught')
      }
    })

    it('instanceof catches AppException', () => {
      function throwsAppException() {
        throw new AppException('specific', { type: ErrorType.Permission })
      }
      try {
        throwsAppException()
      } catch (e) {
        expect(e).toBeInstanceOf(AppException)
        expect((e as AppException).type).toBe(ErrorType.Permission)
      }
    })
  })

  describe('stack trace', () => {
    it('has stack trace', () => {
      const ex = new AppException('with stack')
      expect(ex.stack).toBeDefined()
    })
  })

  describe('showError behavior', () => {
    it('does not call showFeedback when showError is false', () => {
      mockShowFeedback.mockClear()
      new AppException('silent error', {
        type: ErrorType.Validation,
        showError: false
      })
      expect(mockShowFeedback).not.toHaveBeenCalled()
    })

    it('calls showFeedback when showError is true', () => {
      vi.useFakeTimers()
      vi.advanceTimersByTime(2001)
      mockShowFeedback.mockClear()
      const ex = new AppException('user visible', {
        type: ErrorType.Network,
        showError: true
      })
      expect(mockShowFeedback).toHaveBeenCalledWith('user visible', 'error')
      expect(ex.message).toBe('user visible')
      vi.advanceTimersByTime(2001)
      vi.useRealTimers()
    })

    it('does not show error more than once within 2s window', () => {
      vi.useFakeTimers()
      vi.advanceTimersByTime(2001)
      mockShowFeedback.mockClear()
      new AppException('first error', {
        type: ErrorType.Network,
        showError: true
      })
      expect(mockShowFeedback).toHaveBeenCalledTimes(1)
      new AppException('second error', {
        type: ErrorType.Network,
        showError: true
      })
      expect(mockShowFeedback).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(2001)
      vi.useRealTimers()
    })
  })

  describe('with partial ErrorDetails', () => {
    it('accepts empty error details', () => {
      const ex = new AppException('test', {})
      expect(ex.type).toBe(ErrorType.Unknown)
    })

    it('partial type only', () => {
      const ex = new AppException('test', { type: ErrorType.NotFound })
      expect(ex.type).toBe(ErrorType.NotFound)
      expect(ex.code).toBeUndefined()
    })
  })
})
