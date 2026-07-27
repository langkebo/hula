import { beforeEach, describe, expect, it, vi } from 'vitest'

// Shared mock for showFeedback so tests can assert on it (hoisted for vi.mock factory)
const { showFeedbackMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn()
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock,
    showProgressFeedback: vi.fn(),
    clearFeedback: vi.fn()
  })
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

// Mock matrixErrorTranslator so toAppError classifies generic errors as fatal
vi.mock('@/common/matrixErrorTranslator', () => ({
  translateMatrixError: vi.fn().mockReturnValue({ recoverable: false, userMessage: 'translated error' })
}))

import { withErrorHandling } from '@/services/matrix/utils/withErrorHandling'

describe('withErrorHandling', () => {
  beforeEach(() => {
    showFeedbackMock.mockClear()
  })

  describe('success path', () => {
    it('returns the result when the operation succeeds', async () => {
      const result = await withErrorHandling(() => Promise.resolve(42), { feature: 'test' })
      expect(result).toBe(42)
    })

    it('does not show feedback on success', async () => {
      await withErrorHandling(() => Promise.resolve('ok'), { feature: 'test' })
      expect(showFeedbackMock).not.toHaveBeenCalled()
    })
  })

  describe('retryable errors', () => {
    it('retries up to maxRetries times then returns undefined', async () => {
      const op = vi.fn().mockRejectedValue(new Error('NetworkError: fetch failed'))
      const result = await withErrorHandling(op, {
        feature: 'test',
        maxRetries: 2,
        retryDelayMs: 0,
        feedback: 'silent'
      })
      expect(result).toBeUndefined()
      expect(op).toHaveBeenCalledTimes(3) // initial + 2 retries
    })

    it('succeeds on retry after initial failure', async () => {
      const op = vi
        .fn()
        .mockRejectedValueOnce(new Error('NetworkError: fetch failed'))
        .mockResolvedValueOnce('recovered')
      const result = await withErrorHandling(op, {
        feature: 'test',
        maxRetries: 2,
        retryDelayMs: 0,
        feedback: 'silent'
      })
      expect(result).toBe('recovered')
      expect(op).toHaveBeenCalledTimes(2)
    })
  })

  describe('fatal errors', () => {
    it('shows error toast and returns undefined when feedback is toast', async () => {
      const op = vi.fn().mockRejectedValue(new Error('unexpected fatal error'))
      const result = await withErrorHandling(op, {
        feature: 'test',
        feedback: 'toast'
      })
      expect(result).toBeUndefined()
      expect(showFeedbackMock).toHaveBeenCalledTimes(1)
      expect(showFeedbackMock).toHaveBeenCalledWith(expect.any(String), 'error', expect.any(String))
    })

    it('does not show toast when feedback is silent', async () => {
      const op = vi.fn().mockRejectedValue(new Error('unexpected fatal error'))
      await withErrorHandling(op, {
        feature: 'test',
        feedback: 'silent'
      })
      expect(showFeedbackMock).not.toHaveBeenCalled()
    })
  })

  describe('auth errors', () => {
    it('calls onAuthError callback when auth error occurs', async () => {
      const authError = Object.assign(new Error('Token expired'), {
        errcode: 'M_UNKNOWN_TOKEN',
        httpStatus: 401
      })
      const onAuthError = vi.fn()
      const op = vi.fn().mockRejectedValue(authError)
      const result = await withErrorHandling(op, {
        feature: 'test',
        feedback: 'silent',
        onAuthError
      })
      expect(result).toBeUndefined()
      expect(onAuthError).toHaveBeenCalledTimes(1)
      expect(onAuthError).toHaveBeenCalledWith(expect.objectContaining({ kind: 'auth' }))
    })

    it('does not retry auth errors', async () => {
      const authError = Object.assign(new Error('Forbidden'), {
        errcode: 'M_FORBIDDEN',
        httpStatus: 403
      })
      const onAuthError = vi.fn()
      const op = vi.fn().mockRejectedValue(authError)
      await withErrorHandling(op, {
        feature: 'test',
        maxRetries: 3,
        feedback: 'silent',
        onAuthError
      })
      expect(op).toHaveBeenCalledTimes(1) // no retries
    })
  })

  describe('feedback defaults', () => {
    it('defaults to toast feedback when feedback option is omitted', async () => {
      const op = vi.fn().mockRejectedValue(new Error('unexpected fatal error'))
      await withErrorHandling(op, { feature: 'test' })
      expect(showFeedbackMock).toHaveBeenCalledTimes(1)
    })

    it('shows error toast when retries are exhausted with toast feedback', async () => {
      const op = vi.fn().mockRejectedValue(new Error('NetworkError: fetch failed'))
      await withErrorHandling(op, {
        feature: 'test',
        maxRetries: 1,
        retryDelayMs: 0,
        feedback: 'toast'
      })
      expect(showFeedbackMock).toHaveBeenCalledTimes(1)
      expect(showFeedbackMock).toHaveBeenCalledWith(expect.any(String), 'error', 'assertive')
    })
  })
})
