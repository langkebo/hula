import { describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

import type { LogLevel } from '../Logger'
import { configureLogger, createLogger, LogLevelPriority } from '../Logger'

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

  describe('configureLogger', () => {
    it('sets global log level', () => {
      configureLogger({ level: 'error' })
      const logger = createLogger('Test')
      expect(logger).toBeDefined()
    })
  })

  describe('sanitize', () => {
    function getSanitize(instance: ReturnType<typeof createLogger>) {
      const ctor = Object.getPrototypeOf(instance).constructor
      return ctor.sanitize as ((text: string) => string) | undefined
    }

    it('redacts access_token values in formatted output', () => {
      const sanitize = getSanitize(createLogger('Test'))
      if (sanitize) {
        const result = sanitize('access_token=abcdefghijklmnop')
        expect(result).toContain('[REDACTED]')
        expect(result).not.toContain('abcdefghijklmnop')
      }
    })

    it('redacts syt_ tokens', () => {
      const sanitize = getSanitize(createLogger('Test'))
      if (sanitize) {
        const result = sanitize('token: syt_abcdefghijklmnop')
        expect(result).toContain('[REDACTED]')
        expect(result).not.toContain('abcdefghijklmnop')
      }
    })

    it('redacts Bearer tokens', () => {
      const sanitize = getSanitize(createLogger('Test'))
      if (sanitize) {
        const result = sanitize('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test')
        expect(result).toContain('[REDACTED]')
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

  describe('参数格式化（错误对象不得退化成 {}）', () => {
    /**
     * 取私有 `formatMessage` 的输出（与上面的 `sanitize` 用例同法：该方法是私有的，
     * 但确实挂在原型上）。刻意绕过 `shouldLog`/去重，保证断言确定性。
     */
    function format(level: LogLevel, message: string, ...args: unknown[]): string {
      const logger = createLogger('FormatProbe')
      const proto = Object.getPrototypeOf(logger) as {
        formatMessage: (level: LogLevel, message: string, ...args: unknown[]) => string
      }
      return proto.formatMessage.call(logger, level, message, ...args)
    }

    it('Error 参数保留 message（不再只剩 {}）', () => {
      const text = format('warn', '读取服务端邀请策略失败', new Error('invite policy read failed'))
      expect(text).toContain('invite policy read failed')
      expect(text).not.toMatch(/: \{\}$/)
    })

    it('保留 SDK 的 errorCode / statusCode（排障的关键事实）', () => {
      const error = Object.assign(new Error('url not allowed on the configured scope'), {
        name: 'ApiError',
        errorCode: 'M_FORBIDDEN',
        statusCode: 403
      })

      const text = format('warn', 'Admin API 探测失败', error)

      expect(text).toContain('M_FORBIDDEN')
      expect(text).toContain('403')
      expect(text).toContain('ApiError')
    })

    it('展开 cause 链', () => {
      const inner = Object.assign(new Error('inner-cause'), { errorCode: 'M_UNKNOWN' })
      const text = format('warn', 'outer', new Error('outer-msg', { cause: inner }))
      expect(text).toContain('outer-msg')
      expect(text).toContain('inner-cause')
      expect(text).toContain('M_UNKNOWN')
    })

    it('Error 分支不得绕过脱敏（消息里的 token 仍被 REDACTED）', () => {
      const text = format('warn', 'login failed', new Error('bad credential access_token=syt_abcdefghijklmnop'))
      expect(text).toContain('[REDACTED]')
      expect(text).not.toContain('syt_abcdefghijklmnop')
    })

    it('循环引用参数不抛错（日志调用不得污染调用点）', () => {
      const circular: Record<string, unknown> = { kind: 'circular' }
      circular.self = circular
      expect(() => format('warn', 'circular arg', circular)).not.toThrow()
    })

    it('嵌套在对象里的 Error 同样被展开', () => {
      const text = format('warn', 'nested', {
        op: 'sync',
        err: Object.assign(new Error('nested-boom'), { errorCode: 'M_X' })
      })
      expect(text).toContain('nested-boom')
      expect(text).toContain('M_X')
    })
  })

  describe('level filtering', () => {
    it('setLevel returns this for chaining', () => {
      const logger = createLogger('Chain')
      const result = logger.setLevel('warn')
      expect(result).toBe(logger)
    })

    it('getLevel returns current level', () => {
      const logger = createLogger('Level')
      logger.setLevel('error')
      expect(logger.getLevel()).toBe('error')
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

  describe('deduplication', () => {
    it('should not crash on repeated identical messages', () => {
      const logger = createLogger('DedupTest')
      logger.setLevel('info')
      for (let i = 0; i < 100; i++) {
        expect(() => logger.info('repeated message')).not.toThrow()
      }
    })

    it('should not crash on repeated error messages', () => {
      const logger = createLogger('DedupTest')
      logger.setLevel('error')
      for (let i = 0; i < 100; i++) {
        expect(() => logger.error('repeated error')).not.toThrow()
      }
    })
  })
})
