import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => mockLogger)
}))

import { createNetworkError, createValidationError, globalErrorHandler } from '../errorHandler'
import type { AppError } from '../errors'
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

  describe('handleMatrixError display seam', () => {
    const captureContexts = () => {
      const contexts: Record<string, unknown>[] = []
      const unsubscribe = globalErrorHandler.onError((_error, context) => {
        if (context) contexts.push(context)
      })
      return { contexts, unsubscribe }
    }

    it('displays the localized copy resolved from i18nKey', () => {
      const { contexts, unsubscribe } = captureContexts()
      try {
        const err = Object.assign(new Error('token unknown'), { errcode: 'M_UNKNOWN_TOKEN' })
        globalErrorHandler.handleMatrixError(err)
      } finally {
        unsubscribe()
      }
      expect(contexts.at(-1)?.userMessage).toBe('会话已过期，请重新登录')
    })

    it('keeps the original message when the AppError has no i18nKey', () => {
      const { contexts, unsubscribe } = captureContexts()
      try {
        const appError: AppError = {
          kind: 'retryable',
          code: 'TIMEOUT',
          message: '请求超时，请稍后重试'
        }
        globalErrorHandler.handleMatrixError(appError)
      } finally {
        unsubscribe()
      }
      expect(contexts.at(-1)?.userMessage).toBe('请求超时，请稍后重试')
    })

    it('keeps the original message when i18nKey does not resolve to copy', () => {
      const { contexts, unsubscribe } = captureContexts()
      try {
        const appError: AppError = {
          kind: 'fatal',
          code: 'UNKNOWN',
          message: '原始错误消息',
          correlationId: 'corr-1',
          i18nKey: 'error.matrix.this_key_does_not_exist'
        }
        globalErrorHandler.handleMatrixError(appError)
      } finally {
        unsubscribe()
      }
      expect(contexts.at(-1)?.userMessage).toBe('原始错误消息')
    })
  })
})
