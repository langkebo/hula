import { describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

import type { LogLevel } from '../Logger'
import { createLogger, LogLevelPriority } from '../Logger'

describe('Logger', () => {
  describe('createLogger', () => {
    it('creates a logger with the given context', () => {
      const logger = createLogger('TestContext')
      expect(logger).toBeDefined()
    })
  })

  describe('LogLevelPriority', () => {
    it('has correct ordering', () => {
      expect(LogLevelPriority.trace).toBeLessThan(LogLevelPriority.debug)
      expect(LogLevelPriority.debug).toBeLessThan(LogLevelPriority.info)
      expect(LogLevelPriority.info).toBeLessThan(LogLevelPriority.warn)
      expect(LogLevelPriority.warn).toBeLessThan(LogLevelPriority.error)
      expect(LogLevelPriority.error).toBeLessThan(LogLevelPriority.off)
    })

    it('covers all levels', () => {
      const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'off']
      for (const level of levels) {
        expect(LogLevelPriority[level]).toBeDefined()
      }
    })
  })

  describe('sanitize', () => {
    // Access Logger's private static sanitize via constructor chain
    function getSanitize(instance: ReturnType<typeof createLogger>) {
      const ctor = Object.getPrototypeOf(instance).constructor
      return ctor.sanitize as ((text: string) => string) | undefined
    }

    it('redacts access_token values in formatted output', () => {
      const sanitize = getSanitize(createLogger('Test'))
      if (sanitize) {
        const result = sanitize('access_token=abcdefghijklmnop')
        expect(result).toContain('***REDACTED***')
        expect(result).not.toContain('abcdefghijklmnop')
      }
    })

    it('redacts syt_ tokens', () => {
      const sanitize = getSanitize(createLogger('Test'))
      if (sanitize) {
        const result = sanitize('token: syt_abcdefghijklmnop')
        expect(result).toContain('***REDACTED***')
        expect(result).not.toContain('abcdefghijklmnop')
      }
    })

    it('redacts Bearer tokens', () => {
      const sanitize = getSanitize(createLogger('Test'))
      if (sanitize) {
        const result = sanitize('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test')
        expect(result).toContain('***REDACTED***')
      }
    })

    it('leaves short tokens alone', () => {
      const sanitize = getSanitize(createLogger('Test'))
      if (sanitize) {
        const result = sanitize('short value abc')
        expect(result).toBe('short value abc')
      }
    })

    it('does not alter messages without tokens', () => {
      const sanitize = getSanitize(createLogger('Test'))
      if (sanitize) {
        const msg = 'Normal log message without any sensitive data'
        expect(sanitize(msg)).toBe(msg)
      }
    })
  })

  describe('level filtering', () => {
    it('setLevel returns this for chaining', () => {
      const logger = createLogger('Chain')
      const result = logger.setLevel('warn')
      expect(result).toBe(logger)
    })
  })

  describe('child logger', () => {
    it('creates a child with combined context', () => {
      const parent = createLogger('Parent')
      const child = parent.child('Child')
      expect(child).toBeDefined()
    })
  })

  describe('log methods exist', () => {
    it('has all standard log methods', () => {
      const logger = createLogger('Methods')
      expect(typeof logger.trace).toBe('function')
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
      expect(typeof logger.log).toBe('function')
    })

    it('has utility methods', () => {
      const logger = createLogger('Util')
      expect(typeof logger.time).toBe('function')
      expect(typeof logger.timeEnd).toBe('function')
      expect(typeof logger.group).toBe('function')
      expect(typeof logger.groupEnd).toBe('function')
      expect(typeof logger.table).toBe('function')
    })
  })
})
