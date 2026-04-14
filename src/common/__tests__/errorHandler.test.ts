import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { globalErrorHandler, createValidationError, createNetworkError } from '../errorHandler'
import { ErrorType } from '../exception'

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('$message', { error: vi.fn() })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('globalErrorHandler', () => {
    it('should handle Error instances', () => {
      const error = new Error('test error')
      expect(() => globalErrorHandler.handleError(error)).not.toThrow()
    })

    it('should handle non-Error objects', () => {
      expect(() => globalErrorHandler.handleError('string error')).not.toThrow()
      expect(() => globalErrorHandler.handleError(123)).not.toThrow()
      expect(() => globalErrorHandler.handleError(null)).not.toThrow()
    })

    it('should call registered callbacks', () => {
      const callback = vi.fn()
      const unsubscribe = globalErrorHandler.onError(callback)

      globalErrorHandler.handleError(new Error('test'))

      expect(callback).toHaveBeenCalled()

      unsubscribe()
      globalErrorHandler.handleError(new Error('test2'))
      expect(callback).toHaveBeenCalledTimes(1) // Only called once after unsubscribe
    })

    it('should create Validation errors', () => {
      const error = createValidationError('Invalid input', { field: 'username' })
      expect(error.message).toBe('Invalid input')
      expect(error.type).toBe(ErrorType.Validation)
    })

    it('should create Network errors', () => {
      const error = createNetworkError('Network failed', { status: 500 })
      expect(error.message).toBe('Network failed')
      expect(error.type).toBe(ErrorType.Network)
    })
  })
})
