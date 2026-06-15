import { describe, expect, it, vi } from 'vitest'

// Mock matrixErrorTranslator before importing errors.ts
vi.mock('@/common/matrixErrorTranslator', () => ({
  translateMatrixError: vi.fn().mockReturnValue({ recoverable: false, userMessage: 'translated error' })
}))

// Mock useActionFeedback (used by AppException)
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: vi.fn()
  })
}))

// Mock tauri plugin-log
vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

import {
  type AppError,
  type AppErrorAuth,
  type AppErrorFatal,
  type AppErrorNotFound,
  type AppErrorRetryable,
  type AppErrorValidation,
  fingerprint,
  isAuthError,
  isRetryable,
  toAppError
} from '@/common/errors'
import { AppException, ErrorType } from '@/common/exception'
import { translateMatrixError } from '@/common/matrixErrorTranslator'

describe('errors', () => {
  describe('fingerprint', () => {
    it('returns fingerprint for Error objects', () => {
      const err = new Error('test message')
      const fp = fingerprint(err)
      expect(fp).toContain('Error')
      expect(fp).toContain('test message')
    })

    it('returns fingerprint with errcode', () => {
      const err = Object.assign(new Error('rate limit'), { errcode: 'M_LIMIT_EXCEEDED' })
      const fp = fingerprint(err)
      expect(fp).toContain('M_LIMIT_EXCEEDED')
    })

    it('returns fingerprint with httpStatus', () => {
      const err = Object.assign(new Error('not found'), { httpStatus: 404 })
      const fp = fingerprint(err)
      expect(fp).toContain('404')
    })

    it('returns fingerprint for non-Error values', () => {
      const fp = fingerprint('plain string error')
      expect(fp).toContain('raw:')
      expect(fp).toContain('plain string error')
    })

    it('returns fingerprint for null/undefined', () => {
      const fp = fingerprint(null)
      expect(fp).toBe('raw:null')
    })

    it('truncates long messages', () => {
      const longMessage = 'x'.repeat(200)
      const err = new Error(longMessage)
      const fp = fingerprint(err)
      expect(fp.length).toBeLessThan(150)
    })

    it('uses name field from error object', () => {
      const err = Object.assign(new Error('msg'), { name: 'CustomError' })
      const fp = fingerprint(err)
      expect(fp).toContain('CustomError')
    })
  })

  describe('toAppError', () => {
    it('returns fatal error for null input', () => {
      const result = toAppError(null)
      expect(result.kind).toBe('fatal')
      expect((result as AppErrorFatal).code).toBe('UNKNOWN')
    })

    it('returns fatal error for undefined input', () => {
      const result = toAppError(undefined)
      expect(result.kind).toBe('fatal')
      expect((result as AppErrorFatal).code).toBe('UNKNOWN')
      expect((result as AppErrorFatal).correlationId).toBeTruthy()
    })

    it('returns same AppError if already an AppError (idempotent)', () => {
      const existing: AppError = {
        kind: 'auth',
        code: 'M_UNKNOWN_TOKEN',
        recoverable: true,
        message: 'token error'
      }
      const result = toAppError(existing)
      expect(result).toBe(existing)
    })

    it('converts AppException.Auth to AppError auth', () => {
      const ex = new AppException('auth failed', { type: ErrorType.Authentication })
      const result = toAppError(ex)
      expect(result.kind).toBe('auth')
      expect((result as AppErrorAuth).code).toBe(ErrorType.Authentication)
      expect((result as AppErrorAuth).recoverable).toBe(true)
    })

    it('converts AppException.NotFound to AppError not_found', () => {
      const ex = new AppException('not found', { type: ErrorType.NotFound })
      const result = toAppError(ex, { resource: 'user' })
      expect(result.kind).toBe('not_found')
      expect((result as AppErrorNotFound).resource).toBe('user')
    })

    it('converts AppException.Validation to AppError validation', () => {
      const ex = new AppException('invalid', { type: ErrorType.Validation })
      const result = toAppError(ex, { field: 'username' })
      expect(result.kind).toBe('validation')
      expect((result as AppErrorValidation).field).toBe('username')
    })

    it('converts AppException.RateLimit to AppError retryable', () => {
      const ex = new AppException('rate limited', {
        type: ErrorType.RateLimit,
        details: { retryAfterMs: 5000 }
      })
      const result = toAppError(ex)
      expect(result.kind).toBe('retryable')
      expect((result as AppErrorRetryable).retryAfterMs).toBe(5000)
    })

    it('converts AppException.Network to AppError retryable', () => {
      const ex = new AppException('network error', { type: ErrorType.Network })
      const result = toAppError(ex)
      expect(result.kind).toBe('retryable')
    })

    it('converts AppException.Permission to AppError auth (non-recoverable)', () => {
      const ex = new AppException('forbidden', { type: ErrorType.Permission })
      const result = toAppError(ex)
      expect(result.kind).toBe('auth')
      expect((result as AppErrorAuth).recoverable).toBe(false)
    })

    it('converts TlsError to fatal', () => {
      const err = Object.assign(new Error('TLS handshake failed'), { name: 'TlsError' })
      const result = toAppError(err)
      expect(result.kind).toBe('fatal')
      expect((result as AppErrorFatal).code).toBe('TLS_ERROR')
    })

    it('converts NetworkError to retryable', () => {
      const err = Object.assign(new Error('fetch failed'), { name: 'NetworkError' })
      const result = toAppError(err)
      expect(result.kind).toBe('retryable')
      expect((result as AppErrorRetryable).code).toBe('NETWORK_ERROR')
    })

    it('converts TimeoutError to retryable', () => {
      const err = Object.assign(new Error('request timeout'), { name: 'TimeoutError' })
      const result = toAppError(err)
      expect(result.kind).toBe('retryable')
      expect((result as AppErrorRetryable).code).toBe('TIMEOUT')
    })

    it('converts AbortError to retryable', () => {
      const err = Object.assign(new Error('aborted'), { name: 'AbortError' })
      const result = toAppError(err)
      expect(result.kind).toBe('retryable')
      expect((result as AppErrorRetryable).code).toBe('ABORT')
    })

    it('converts M_LIMIT_EXCEEDED to retryable', () => {
      const err = Object.assign(new Error('rate limit exceeded'), { errcode: 'M_LIMIT_EXCEEDED' })
      const result = toAppError(err)
      expect(result.kind).toBe('retryable')
      expect((result as AppErrorRetryable).code).toBe('M_LIMIT_EXCEEDED')
    })

    it('converts HTTP 429 to retryable', () => {
      const err = Object.assign(new Error('too many requests'), { httpStatus: 429 })
      const result = toAppError(err)
      expect(result.kind).toBe('retryable')
    })

    it('converts M_UNKNOWN_TOKEN to auth (recoverable)', () => {
      const err = Object.assign(new Error('unknown token'), { errcode: 'M_UNKNOWN_TOKEN' })
      const result = toAppError(err)
      expect(result.kind).toBe('auth')
      expect((result as AppErrorAuth).recoverable).toBe(true)
    })

    it('converts M_FORBIDDEN to auth (non-recoverable)', () => {
      const err = Object.assign(new Error('forbidden'), { errcode: 'M_FORBIDDEN' })
      const result = toAppError(err)
      expect(result.kind).toBe('auth')
      expect((result as AppErrorAuth).recoverable).toBe(false)
    })

    it('converts M_NOT_FOUND to not_found', () => {
      const err = Object.assign(new Error('not found'), { errcode: 'M_NOT_FOUND' })
      const result = toAppError(err, { resource: 'room' })
      expect(result.kind).toBe('not_found')
      expect((result as AppErrorNotFound).resource).toBe('room')
    })

    it('converts HTTP 404 to not_found', () => {
      const err = Object.assign(new Error('page not found'), { httpStatus: 404 })
      const result = toAppError(err)
      expect(result.kind).toBe('not_found')
    })

    it('converts M_INVALID_USERNAME to validation', () => {
      const err = Object.assign(new Error('bad username'), { errcode: 'M_INVALID_USERNAME' })
      const result = toAppError(err, { field: 'username' })
      expect(result.kind).toBe('validation')
      expect((result as AppErrorValidation).code).toBe('M_INVALID_USERNAME')
    })

    it('converts M_USER_IN_USE to validation', () => {
      const err = Object.assign(new Error('already registered'), { errcode: 'M_USER_IN_USE' })
      const result = toAppError(err)
      expect(result.kind).toBe('validation')
    })

    it('converts HTTP 401 to auth (recoverable)', () => {
      const err = Object.assign(new Error('unauthorized'), { httpStatus: 401 })
      const result = toAppError(err)
      expect(result.kind).toBe('auth')
      expect((result as AppErrorAuth).recoverable).toBe(true)
    })

    it('converts HTTP 403 to auth (non-recoverable)', () => {
      const err = Object.assign(new Error('forbidden'), { httpStatus: 403 })
      const result = toAppError(err)
      expect(result.kind).toBe('auth')
      expect((result as AppErrorAuth).recoverable).toBe(false)
    })

    it('converts HTTP 500 to retryable', () => {
      const err = Object.assign(new Error('server error'), { httpStatus: 500 })
      const result = toAppError(err)
      expect(result.kind).toBe('retryable')
      expect((result as AppErrorRetryable).code).toBe('HTTP_500')
    })

    it('converts HTTP 503 to retryable', () => {
      const err = Object.assign(new Error('unavailable'), { httpStatus: 503 })
      const result = toAppError(err)
      expect(result.kind).toBe('retryable')
    })

    it('falls back to translateMatrixError for unrecognized errors', () => {
      const err = new Error('some random error')
      const result = toAppError(err)
      expect(translateMatrixError).toHaveBeenCalled()
      expect(result.kind).toBe('fatal')
      expect((result as AppErrorFatal).correlationId).toBeTruthy()
    })

    it('falls back to retryable when translateMatrixError says recoverable', () => {
      vi.mocked(translateMatrixError).mockReturnValueOnce({
        recoverable: true,
        userMessage: 'retry plz',
        level: 'toast'
      })
      const err = new Error('transient')
      const result = toAppError(err)
      expect(result.kind).toBe('retryable')
    })

    it('converts plain string input to fatal', () => {
      const result = toAppError('plain text error')
      expect(result.kind).toBe('fatal')
    })

    it('sets i18nKey for known matrix errors', () => {
      const err = Object.assign(new Error('token unknown'), { errcode: 'M_UNKNOWN_TOKEN' })
      const result = toAppError(err)
      expect((result as AppErrorAuth).i18nKey).toBeTruthy()
    })
  })

  describe('isRetryable', () => {
    it('returns true for retryable kind', () => {
      const err: AppError = { kind: 'retryable', message: 'retry' }
      expect(isRetryable(err)).toBe(true)
    })

    it('returns false for auth kind', () => {
      const err: AppError = { kind: 'auth', code: 'x', recoverable: true, message: 'auth' }
      expect(isRetryable(err)).toBe(false)
    })

    it('returns false for fatal kind', () => {
      const err: AppError = { kind: 'fatal', code: 'x', message: 'fatal', correlationId: 'abc' }
      expect(isRetryable(err)).toBe(false)
    })

    it('narrows type', () => {
      const err: AppError = { kind: 'retryable', message: 'retry' }
      if (isRetryable(err)) {
        expect(err.kind).toBe('retryable')
      }
    })
  })

  describe('isAuthError', () => {
    it('returns true for auth kind', () => {
      const err: AppError = { kind: 'auth', code: 'x', recoverable: true, message: 'auth' }
      expect(isAuthError(err)).toBe(true)
    })

    it('returns false for retryable kind', () => {
      const err: AppError = { kind: 'retryable', message: 'retry' }
      expect(isAuthError(err)).toBe(false)
    })

    it('returns false for validation kind', () => {
      const err: AppError = { kind: 'validation', code: 'x', message: 'bad' }
      expect(isAuthError(err)).toBe(false)
    })

    it('narrows type', () => {
      const err: AppError = { kind: 'auth', code: 'M_FORBIDDEN', recoverable: false, message: 'nope' }
      if (isAuthError(err)) {
        expect(err.recoverable).toBe(false)
      }
    })
  })
})
