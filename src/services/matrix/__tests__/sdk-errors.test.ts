import { describe, expect, it } from 'vitest'
import type { AppError } from '@/common/errors'
import { attachAppError, getSdkErrorCode, normalizeSdkError } from '@/services/matrix/sdk-errors'

type WithAppError = Error & { appError?: AppError }

describe('sdk-errors', () => {
  describe('normalizeSdkError', () => {
    it('maps NetworkError to retryable AppError', () => {
      const err = Object.assign(new Error('failed to fetch'), { name: 'NetworkError' })
      const appError = normalizeSdkError(err)
      expect(appError.kind).toBe('retryable')
      if ('code' in appError) expect(appError.code).toBe('NETWORK_ERROR')
    })

    it('maps generic Error to fatal AppError preserving message', () => {
      const appError = normalizeSdkError(new Error('Invalid password'))
      expect(appError.kind).toBe('fatal')
      expect(appError.message).toContain('Invalid password')
    })
  })

  describe('getSdkErrorCode', () => {
    it('reads top-level errcode', () => {
      const err = Object.assign(new Error('forbidden'), { errcode: 'M_FORBIDDEN' })
      expect(getSdkErrorCode(err)).toBe('M_FORBIDDEN')
    })

    it('falls back to data.errcode', () => {
      const err = Object.assign(new Error('limit'), { data: { errcode: 'M_LIMIT_EXCEEDED' } })
      expect(getSdkErrorCode(err)).toBe('M_LIMIT_EXCEEDED')
    })

    it('returns undefined for non-error inputs', () => {
      expect(getSdkErrorCode('boom')).toBeUndefined()
      expect(getSdkErrorCode(undefined)).toBeUndefined()
    })
  })

  describe('attachAppError', () => {
    it('attaches a non-enumerable appError to thrown errors', () => {
      const err: WithAppError = new Error('Invalid password')
      attachAppError(err)
      expect(err.appError).toBeDefined()
      expect(err.appError?.kind).toBe('fatal')
      expect(Object.keys(err)).not.toContain('appError')
    })

    it('returns the original error reference for fluent rethrow', () => {
      const err = new Error('boom')
      expect(attachAppError(err)).toBe(err)
    })

    it('does not overwrite an existing appError property', () => {
      const existing: AppError = { kind: 'fatal', code: 'TEST_FATAL', message: 'preset', correlationId: 'corr-test' }
      const err = Object.assign(new Error('boom'), { appError: existing }) as WithAppError
      attachAppError(err)
      expect(err.appError).toBe(existing)
    })

    it('classifies network failures as retryable', () => {
      const err = Object.assign(new Error('failed to fetch'), { name: 'NetworkError' }) as WithAppError
      attachAppError(err)
      expect(err.appError?.kind).toBe('retryable')
      if (err.appError && 'code' in err.appError) {
        expect(err.appError.code).toBe('NETWORK_ERROR')
      }
    })

    it('handles non-object inputs without throwing', () => {
      expect(() => attachAppError('string err' as unknown as Error)).not.toThrow()
      expect(() => attachAppError(null as unknown as Error)).not.toThrow()
    })
  })
})
