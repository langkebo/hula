import { describe, expect, it, vi } from 'vitest'
import { fingerprint, isAuthError, isRetryable, toAppError } from '../errors'
import { AppException, ErrorType } from '../exception'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

describe('§18.8.2 — toAppError discriminated union', () => {
  it('passes through an existing AppError unchanged (idempotent)', () => {
    const already = { kind: 'retryable' as const, code: 'X', message: 'x' }
    expect(toAppError(already)).toBe(already)
  })

  it('null / undefined → fatal with correlation id', () => {
    const err = toAppError(null)
    expect(err.kind).toBe('fatal')
    if (err.kind === 'fatal') {
      expect(err.code).toBe('UNKNOWN')
      expect(err.correlationId).toBeTruthy()
    }
  })

  describe('Matrix errcode mapping', () => {
    it('M_LIMIT_EXCEEDED → retryable with retry_after_ms', () => {
      const err = toAppError({
        name: 'MatrixError',
        message: 'slow down',
        errcode: 'M_LIMIT_EXCEEDED',
        retry_after_ms: 1500
      })
      expect(err.kind).toBe('retryable')
      if (err.kind === 'retryable') {
        expect(err.code).toBe('M_LIMIT_EXCEEDED')
        expect(err.retryAfterMs).toBe(1500)
      }
    })

    it('M_UNKNOWN_TOKEN → auth, recoverable', () => {
      const err = toAppError({ name: 'MatrixError', message: 'relogin', errcode: 'M_UNKNOWN_TOKEN' })
      expect(err.kind).toBe('auth')
      if (err.kind === 'auth') {
        expect(err.recoverable).toBe(true)
        expect(err.code).toBe('M_UNKNOWN_TOKEN')
      }
    })

    it('M_FORBIDDEN → auth, not recoverable', () => {
      const err = toAppError({ name: 'MatrixError', message: 'forbidden', errcode: 'M_FORBIDDEN' })
      expect(err.kind).toBe('auth')
      if (err.kind === 'auth') {
        expect(err.recoverable).toBe(false)
      }
    })

    it('M_NOT_FOUND → not_found, carries resource hint', () => {
      const err = toAppError(
        { name: 'MatrixError', message: 'no such room', errcode: 'M_NOT_FOUND' },
        { resource: 'room:!abc' }
      )
      expect(err.kind).toBe('not_found')
      if (err.kind === 'not_found') {
        expect(err.resource).toBe('room:!abc')
      }
    })

    it('M_BAD_JSON → validation with field', () => {
      const err = toAppError({ name: 'MatrixError', message: 'bad json', errcode: 'M_BAD_JSON' }, { field: 'body' })
      expect(err.kind).toBe('validation')
      if (err.kind === 'validation') {
        expect(err.field).toBe('body')
        expect(err.code).toBe('M_BAD_JSON')
      }
    })
  })

  describe('HTTP status fallback', () => {
    it('httpStatus 401 → auth recoverable', () => {
      const err = toAppError(Object.assign(new Error('unauthorized'), { httpStatus: 401 }))
      expect(isAuthError(err) && err.recoverable).toBe(true)
    })

    it('httpStatus 403 → auth non-recoverable', () => {
      const err = toAppError(Object.assign(new Error('forbidden'), { httpStatus: 403 }))
      expect(isAuthError(err) && err.recoverable).toBe(false)
    })

    it('httpStatus 404 → not_found', () => {
      const err = toAppError(Object.assign(new Error('nope'), { httpStatus: 404 }), { resource: 'widget:42' })
      expect(err.kind).toBe('not_found')
      if (err.kind === 'not_found') {
        expect(err.resource).toBe('widget:42')
      }
    })

    it('httpStatus 503 → retryable', () => {
      const err = toAppError(Object.assign(new Error('unavailable'), { httpStatus: 503 }))
      expect(isRetryable(err)).toBe(true)
      if (err.kind === 'retryable') {
        expect(err.code).toBe('HTTP_503')
      }
    })
  })

  describe('transport-level errors from runtimeFetch', () => {
    it('NetworkError (by name) → retryable', () => {
      const e = new Error('Unable to connect')
      e.name = 'NetworkError'
      expect(toAppError(e).kind).toBe('retryable')
    })

    it('TlsError → fatal with TLS_ERROR code', () => {
      const e = new Error('cert failure')
      e.name = 'TlsError'
      const out = toAppError(e)
      expect(out.kind).toBe('fatal')
      if (out.kind === 'fatal') {
        expect(out.code).toBe('TLS_ERROR')
        expect(out.correlationId).toBeTruthy()
      }
    })

    it('TimeoutError → retryable', () => {
      const e = new Error('timeout')
      e.name = 'TimeoutError'
      expect(toAppError(e).kind).toBe('retryable')
    })

    it('category from details (no name match) is honored', () => {
      const e = Object.assign(new Error('abort'), { details: { category: 'abort' } })
      const out = toAppError(e)
      expect(out.kind).toBe('retryable')
      if (out.kind === 'retryable') {
        expect(out.code).toBe('ABORT')
      }
    })
  })

  describe('AppException mapping', () => {
    it('ErrorType.Authentication → auth', () => {
      const ex = new AppException('need login', { type: ErrorType.Authentication })
      expect(toAppError(ex).kind).toBe('auth')
    })

    it('ErrorType.RateLimit → retryable with retryAfterMs', () => {
      const ex = new AppException('slow', { type: ErrorType.RateLimit, details: { retryAfterMs: 2000 } })
      const out = toAppError(ex)
      expect(out.kind).toBe('retryable')
      if (out.kind === 'retryable') {
        expect(out.retryAfterMs).toBe(2000)
      }
    })

    it('ErrorType.Validation → validation', () => {
      const ex = new AppException('bad input', { type: ErrorType.Validation })
      expect(toAppError(ex, { field: 'email' }).kind).toBe('validation')
    })

    it('ErrorType.NotFound → not_found', () => {
      const ex = new AppException('missing', { type: ErrorType.NotFound })
      expect(toAppError(ex, { resource: 'user:@a:b' }).kind).toBe('not_found')
    })

    it('ErrorType.Unknown → fatal', () => {
      const ex = new AppException('?', { type: ErrorType.Unknown })
      expect(toAppError(ex).kind).toBe('fatal')
    })
  })

  describe('fingerprint', () => {
    it('collapses errors with identical shape', () => {
      const a = Object.assign(new Error('slow'), { errcode: 'M_LIMIT_EXCEEDED' })
      const b = Object.assign(new Error('slow'), { errcode: 'M_LIMIT_EXCEEDED' })
      expect(fingerprint(a)).toBe(fingerprint(b))
    })

    it('distinguishes different error codes', () => {
      const a = Object.assign(new Error('x'), { errcode: 'M_FORBIDDEN' })
      const b = Object.assign(new Error('x'), { errcode: 'M_NOT_FOUND' })
      expect(fingerprint(a)).not.toBe(fingerprint(b))
    })

    it('produces raw:<prefix> for non-Error values', () => {
      expect(fingerprint('just a string')).toMatch(/^raw:/)
    })

    it('truncates long messages', () => {
      const longMsg = 'x'.repeat(500)
      const fp = fingerprint(new Error(longMsg))
      expect(fp.length).toBeLessThan(200)
    })
  })
})
