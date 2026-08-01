import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invokeMock, hasTauriRuntimeMock, showFeedbackMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  hasTauriRuntimeMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: hasTauriRuntimeMock
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

import { AppException } from '@/common/exception'
import { invokeSilently, invokeWithErrorHandler, invokeWithResult } from '@/utils/TauriInvokeHandler'

describe('TauriInvokeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasTauriRuntimeMock.mockReturnValue(true)
  })

  describe('invokeWithResult', () => {
    it('非 Tauri 环境返回 err', async () => {
      hasTauriRuntimeMock.mockReturnValue(false)
      const result = await invokeWithResult('some_command')
      expect(result.isOk()).toBe(false)
      expect(result.isErr()).toBe(true)
      const error = result.isErr() ? result.error : null
      expect(error).toBeInstanceOf(AppException)
      expect(error?.message).toContain('Tauri runtime not available')
      expect(error?.message).toContain('some_command')
      expect(invokeMock).not.toHaveBeenCalled()
    })

    it('Tauri 环境成功调用返回 ok(result)', async () => {
      invokeMock.mockResolvedValue({ data: 'test' })
      const result = await invokeWithResult<{ data: string }>('some_command')
      expect(result.isOk()).toBe(true)
      expect(result.isErr()).toBe(false)
      expect(result.isOk() ? result.value : null).toEqual({ data: 'test' })
      expect(invokeMock).toHaveBeenCalledWith('some_command', undefined)
    })

    it('Tauri 环境调用失败返回 err(AppException)', async () => {
      invokeMock.mockRejectedValue(new Error('boom'))
      const result = await invokeWithResult('some_command')
      expect(result.isErr()).toBe(true)
      const error = result.isErr() ? result.error : null
      expect(error).toBeInstanceOf(AppException)
      expect(error?.message).toBe('boom')
    })

    it('字符串错误消息', async () => {
      invokeMock.mockRejectedValue('string error message')
      const result = await invokeWithResult('some_command')
      expect(result.isErr()).toBe(true)
      const error = result.isErr() ? result.error : null
      expect(error).toBeInstanceOf(AppException)
      expect(error?.message).toBe('string error message')
    })

    it('Error 对象错误消息', async () => {
      invokeMock.mockRejectedValue(new Error('error instance message'))
      const result = await invokeWithResult('some_command')
      expect(result.isErr()).toBe(true)
      const error = result.isErr() ? result.error : null
      expect(error).toBeInstanceOf(AppException)
      expect(error?.message).toBe('error instance message')
    })

    it('自定义错误消息 customErrorMessage', async () => {
      invokeMock.mockRejectedValue(new Error('original'))
      const result = await invokeWithResult('some_command', undefined, {
        customErrorMessage: 'custom error message'
      })
      expect(result.isErr()).toBe(true)
      const error = result.isErr() ? result.error : null
      expect(error).toBeInstanceOf(AppException)
      expect(error?.message).toBe('custom error message')
    })
  })

  describe('invokeWithErrorHandler', () => {
    it('非 Tauri 环境抛出 AppException', async () => {
      hasTauriRuntimeMock.mockReturnValue(false)
      let caught: unknown
      try {
        await invokeWithErrorHandler('some_command')
      } catch (e) {
        caught = e
      }
      expect(caught).toBeInstanceOf(AppException)
      expect((caught as AppException).message).toContain('Tauri runtime not available')
      expect((caught as AppException).message).toContain('some_command')
      expect(invokeMock).not.toHaveBeenCalled()
    })

    it('Tauri 环境成功调用返回 result', async () => {
      invokeMock.mockResolvedValue('success')
      const result = await invokeWithErrorHandler<string>('some_command')
      expect(result).toBe('success')
      expect(invokeMock).toHaveBeenCalledWith('some_command', undefined)
    })

    it('Tauri 环境调用失败抛出 AppException', async () => {
      invokeMock.mockRejectedValue(new Error('fail'))
      let caught: unknown
      try {
        await invokeWithErrorHandler('some_command')
      } catch (e) {
        caught = e
      }
      expect(caught).toBeInstanceOf(AppException)
      expect((caught as AppException).message).toBe('fail')
    })
  })

  describe('invokeSilently', () => {
    it('成功调用返回 result', async () => {
      invokeMock.mockResolvedValue(42)
      const result = await invokeSilently<number>('some_command')
      expect(result).toBe(42)
      expect(invokeMock).toHaveBeenCalledWith('some_command', undefined)
    })

    it('失败返回 null', async () => {
      invokeMock.mockRejectedValue(new Error('silent fail'))
      const result = await invokeSilently('some_command')
      expect(result).toBeNull()
    })
  })
})
