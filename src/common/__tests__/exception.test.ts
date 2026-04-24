import { describe, it, expect, vi } from 'vitest'
import { AppException, ErrorType } from '../exception'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

// Mock window.$message
const mockMessageError = vi.fn()
Object.defineProperty(window, '$message', {
  value: { error: mockMessageError },
  writable: true
})

describe('exception', () => {
  describe('ErrorType', () => {
    it('has all expected types', () => {
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

  describe('AppException', () => {
    it('creates with message and default type', () => {
      const ex = new AppException('test error')
      expect(ex.message).toBe('test error')
      expect(ex.name).toBe('AppException')
      expect(ex.type).toBe(ErrorType.Unknown)
      expect(ex.code).toBeUndefined()
      expect(ex.details).toBeUndefined()
    })

    it('creates with custom error details', () => {
      const ex = new AppException('network fail', {
        type: ErrorType.Network,
        code: 500,
        details: { endpoint: '/api/test' }
      })
      expect(ex.type).toBe(ErrorType.Network)
      expect(ex.code).toBe(500)
      expect(ex.details).toEqual({ endpoint: '/api/test' })
    })

    it('is an instance of Error', () => {
      const ex = new AppException('test')
      expect(ex).toBeInstanceOf(Error)
      expect(ex).toBeInstanceOf(AppException)
    })

    it('toJSON returns serializable object', () => {
      const ex = new AppException('serialize me', {
        type: ErrorType.Server,
        code: 503,
        details: { retry: true }
      })
      const json = ex.toJSON()
      expect(json).toEqual({
        name: 'AppException',
        message: 'serialize me',
        type: ErrorType.Server,
        code: 503,
        details: { retry: true }
      })
    })

    it('toJSON omits undefined fields', () => {
      const ex = new AppException('minimal')
      const json = ex.toJSON()
      expect(json.name).toBe('AppException')
      expect(json.message).toBe('minimal')
      expect(json.type).toBe(ErrorType.Unknown)
      expect(json.code).toBeUndefined()
      expect(json.details).toBeUndefined()
    })

    it('handles all error types', () => {
      for (const type of Object.values(ErrorType)) {
        const ex = new AppException('test', { type })
        expect(ex.type).toBe(type)
      }
    })
  })
})
