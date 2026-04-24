import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    error: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => mockLogger)
}))

import { globalErrorHandler, createValidationError, createNetworkError } from '../errorHandler'
import { ErrorType } from '../exception'

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('globalErrorHandler', () => {
    it('should handle Error instances', () => {
      const error = new Error('test error')
      globalErrorHandler.handleError(error)
      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('should handle non-Error objects', () => {
      globalErrorHandler.handleError('string error')
      globalErrorHandler.handleError(123)
      globalErrorHandler.handleError(null)
      expect(mockLogger.error).toHaveBeenCalledTimes(3)
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
