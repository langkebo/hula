import { describe, it, expect, vi } from 'vitest'
import { ApiError, NotFoundError, AuthError, RetryableError, BaseManager } from '../BaseManager'
import { MatrixError } from 'matrix-js-sdk'

vi.mock('@tauri-apps/plugin-log', () => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn()
}))

class TestManager extends BaseManager {}

describe('BaseManager', () => {
  const manager = new TestManager()

  describe('normalizeError', () => {
    it('should return ApiError as-is', () => {
      const error = new ApiError('TEST', 'test error', 400)
      const result = (manager as any).normalizeError(error, 'test')
      expect(result).toBe(error)
    })

    it('should convert MatrixError with 401 to AuthError', () => {
      const error: any = new MatrixError('Token expired')
      error.errcode = 'M_UNKNOWN_TOKEN'
      error.httpStatus = 401

      const result = (manager as any).normalizeError(error, 'testOp')
      expect(result).toBeInstanceOf(AuthError)
      expect(result.message).toContain('testOp failed')
    })

    it('should convert MatrixError with 404 to NotFoundError', () => {
      const error: any = new MatrixError('Not found')
      error.errcode = 'M_NOT_FOUND'
      error.httpStatus = 404

      const result = (manager as any).normalizeError(error, 'findItem')
      expect(result).toBeInstanceOf(NotFoundError)
    })

    it('should convert MatrixError with other status to ApiError', () => {
      const error: any = new MatrixError('Forbidden')
      error.errcode = 'M_FORBIDDEN'
      error.httpStatus = 403

      const result = (manager as any).normalizeError(error, 'test')
      expect(result).toBeInstanceOf(ApiError)
      expect(result.code).toBe('M_FORBIDDEN')
      expect(result.httpStatus).toBe(403)
    })

    it('should convert network error to RetryableError', () => {
      const error = new Error('ECONNRESET connection lost')
      const result = (manager as any).normalizeError(error, 'test')
      expect(result).toBeInstanceOf(RetryableError)
    })

    it('should convert timeout error to RetryableError', () => {
      const error = new Error('Request timeout after 30s')
      const result = (manager as any).normalizeError(error, 'test')
      expect(result).toBeInstanceOf(RetryableError)
    })

    it('should convert generic Error to ApiError', () => {
      const error = new Error('Something went wrong')
      const result = (manager as any).normalizeError(error, 'test')
      expect(result).toBeInstanceOf(ApiError)
      expect(result.code).toBe('UNKNOWN')
    })

    it('should convert non-Error to ApiError', () => {
      const result = (manager as any).normalizeError('string error', 'test')
      expect(result).toBeInstanceOf(ApiError)
      expect(result.message).toContain('string error')
    })
  })

  describe('handleError', () => {
    it('should throw when throwOnError=true', () => {
      const error = new Error('test')
      expect(() => (manager as any).handleError(error, 'test', 'default', true)).toThrow(ApiError)
    })

    it('should return default value when throwOnError=false', () => {
      const error = new Error('test')
      const result = (manager as any).handleError(error, 'test', 'default', false)
      expect(result).toBe('default')
    })

    it('should return null default value', () => {
      const error = new Error('test')
      const result = (manager as any).handleError(error, 'test', null, false)
      expect(result).toBeNull()
    })

    it('should return array default value', () => {
      const error = new Error('test')
      const result = (manager as any).handleError(error, 'test', [], false)
      expect(result).toEqual([])
    })
  })
})

describe('ApiError', () => {
  it('should create with correct properties', () => {
    const error = new ApiError('M_TEST', 'test message', 500, new Error('cause'))
    expect(error.code).toBe('M_TEST')
    expect(error.message).toBe('test message')
    expect(error.httpStatus).toBe(500)
    expect(error.cause).toBeInstanceOf(Error)
    expect(error.name).toBe('ApiError')
  })
})

describe('NotFoundError', () => {
  it('should create with 404 status', () => {
    const error = new NotFoundError('not found')
    expect(error.code).toBe('M_NOT_FOUND')
    expect(error.httpStatus).toBe(404)
    expect(error.name).toBe('NotFoundError')
  })
})

describe('AuthError', () => {
  it('should create with 401 status', () => {
    const error = new AuthError('unauthorized')
    expect(error.code).toBe('M_UNKNOWN_TOKEN')
    expect(error.httpStatus).toBe(401)
    expect(error.name).toBe('AuthError')
  })
})

describe('RetryableError', () => {
  it('should create with 0 status', () => {
    const error = new RetryableError('network error')
    expect(error.code).toBe('RETRYABLE')
    expect(error.httpStatus).toBe(0)
    expect(error.name).toBe('RetryableError')
  })
})
