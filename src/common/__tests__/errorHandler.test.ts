import { describe, it, expect, vi, beforeEach } from 'vitest'
import { globalErrorHandler, createValidationError, createNetworkError } from '../errorHandler'
import { ErrorType } from '../exception'

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('globalErrorHandler', () => {
    it('should handle Error instances', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const error = new Error('test error')
      globalErrorHandler.handleError(error)
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle non-Error objects', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      globalErrorHandler.handleError('string error')
      globalErrorHandler.handleError(123)
      globalErrorHandler.handleError(null)
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
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
      // Mock window.$message
      const mockMessage = { error: vi.fn() }
      vi.stubGlobal('$message', mockMessage)

      const error = createValidationError('Invalid input', { field: 'username' })
      expect(error.message).toBe('Invalid input')
      expect(error.type).toBe(ErrorType.Validation)

      vi.unstubAllGlobals()
    })

    it('should create Network errors', () => {
      const error = createNetworkError('Network failed', { status: 500 })
      expect(error.message).toBe('Network failed')
      expect(error.type).toBe(ErrorType.Network)
    })
  })
})
