/**
 * Logger 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogger, LogLevelPriority } from '../Logger'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

describe('Logger', () => {
  let logger: ReturnType<typeof createLogger>

  beforeEach(() => {
    vi.clearAllMocks()
    logger = createLogger('TestContext')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createLogger 工厂函数', () => {
    it('应该创建 logger 实例', () => {
      expect(logger).toBeDefined()
    })
  })

  describe('日志级别优先级', () => {
    it('应该定义正确的优先级顺序', () => {
      expect(LogLevelPriority.trace).toBeLessThan(LogLevelPriority.debug)
      expect(LogLevelPriority.debug).toBeLessThan(LogLevelPriority.info)
      expect(LogLevelPriority.info).toBeLessThan(LogLevelPriority.warn)
      expect(LogLevelPriority.warn).toBeLessThan(LogLevelPriority.error)
      expect(LogLevelPriority.off).toBeGreaterThan(LogLevelPriority.error)
    })
  })

  describe('日志方法', () => {
    it('info 应该不抛出错误', () => {
      expect(() => logger.info('Test info message')).not.toThrow()
    })

    it('warn 应该不抛出错误', () => {
      expect(() => logger.warn('Test warn message')).not.toThrow()
    })

    it('error 应该不抛出错误', () => {
      expect(() => logger.error('Test error message')).not.toThrow()
    })

    it('应该支持多个参数', () => {
      expect(() => logger.info('Message', { key: 'value' }, 123)).not.toThrow()
    })
  })
})
