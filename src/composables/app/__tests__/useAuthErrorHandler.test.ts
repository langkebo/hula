import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppError, AppErrorAuth } from '@/common/errors'
import { type AuthErrorHandlerDeps, useAuthErrorHandler } from '@/composables/app/useAuthErrorHandler'

describe('useAuthErrorHandler — 认证错误统一处理 (§9.3.3)', () => {
  let deps: AuthErrorHandlerDeps
  const refreshTokenMock = vi.fn<() => Promise<boolean>>()
  const logoutMock = vi.fn<() => Promise<void> | void>()
  const redirectToLoginMock = vi.fn<() => void>()
  const showFeedbackMock = vi.fn<(message: string, type: 'error' | 'warning' | 'info') => void>()

  beforeEach(() => {
    vi.clearAllMocks()
    deps = {
      refreshToken: refreshTokenMock,
      logout: logoutMock,
      redirectToLogin: redirectToLoginMock,
      showFeedback: showFeedbackMock
    }
  })

  function makeAuthError(code: string, recoverable = true): AppErrorAuth {
    return { kind: 'auth', code, recoverable, message: code }
  }

  describe('Token 过期类错误（可恢复）', () => {
    it('M_UNKNOWN_TOKEN 触发 refreshToken', async () => {
      refreshTokenMock.mockResolvedValue(true)
      const { handleAuthError } = useAuthErrorHandler(deps)
      await handleAuthError(makeAuthError('M_UNKNOWN_TOKEN'))
      expect(refreshTokenMock).toHaveBeenCalledTimes(1)
    })

    it('M_MISSING_TOKEN 触发 refreshToken', async () => {
      refreshTokenMock.mockResolvedValue(true)
      const { handleAuthError } = useAuthErrorHandler(deps)
      await handleAuthError(makeAuthError('M_MISSING_TOKEN'))
      expect(refreshTokenMock).toHaveBeenCalledTimes(1)
    })

    it('UNAUTHORIZED (401) 触发 refreshToken', async () => {
      refreshTokenMock.mockResolvedValue(true)
      const { handleAuthError } = useAuthErrorHandler(deps)
      await handleAuthError(makeAuthError('UNAUTHORIZED'))
      expect(refreshTokenMock).toHaveBeenCalledTimes(1)
    })

    it('refreshToken 成功时不跳转登录页', async () => {
      refreshTokenMock.mockResolvedValue(true)
      const { handleAuthError } = useAuthErrorHandler(deps)
      await handleAuthError(makeAuthError('M_UNKNOWN_TOKEN'))
      expect(redirectToLoginMock).not.toHaveBeenCalled()
      expect(logoutMock).not.toHaveBeenCalled()
    })

    it('refreshToken 失败时调用 logout 并跳转登录页', async () => {
      refreshTokenMock.mockResolvedValue(false)
      const { handleAuthError } = useAuthErrorHandler(deps)
      await handleAuthError(makeAuthError('M_UNKNOWN_TOKEN'))
      expect(logoutMock).toHaveBeenCalledTimes(1)
      expect(redirectToLoginMock).toHaveBeenCalledTimes(1)
    })

    it('refreshToken 抛异常时也调用 logout 并跳转登录页', async () => {
      refreshTokenMock.mockRejectedValue(new Error('refresh 失败'))
      const { handleAuthError } = useAuthErrorHandler(deps)
      await handleAuthError(makeAuthError('M_UNKNOWN_TOKEN'))
      expect(logoutMock).toHaveBeenCalledTimes(1)
      expect(redirectToLoginMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('权限不足类错误（不可恢复）', () => {
    it('M_FORBIDDEN 显示无权限提示，不刷新 token', async () => {
      const { handleAuthError } = useAuthErrorHandler(deps)
      await handleAuthError(makeAuthError('M_FORBIDDEN', false))
      expect(refreshTokenMock).not.toHaveBeenCalled()
      expect(showFeedbackMock).toHaveBeenCalledWith(expect.stringContaining('权限'), 'error')
    })

    it('FORBIDDEN 显示无权限提示，不跳转登录页', async () => {
      const { handleAuthError } = useAuthErrorHandler(deps)
      await handleAuthError(makeAuthError('FORBIDDEN', false))
      expect(refreshTokenMock).not.toHaveBeenCalled()
      expect(redirectToLoginMock).not.toHaveBeenCalled()
      expect(showFeedbackMock).toHaveBeenCalledWith(expect.stringContaining('权限'), 'error')
    })

    it('M_GUEST_ACCESS_FORBIDDEN 显示访客受限提示', async () => {
      const { handleAuthError } = useAuthErrorHandler(deps)
      await handleAuthError(makeAuthError('M_GUEST_ACCESS_FORBIDDEN', false))
      expect(showFeedbackMock).toHaveBeenCalledWith(expect.stringContaining('访客'), 'warning')
    })
  })

  describe('非 auth 错误', () => {
    it('非 auth 类型的 AppError 不触发认证处理', async () => {
      const { handleAuthError } = useAuthErrorHandler(deps)
      const err: AppError = { kind: 'retryable', code: 'NETWORK_ERROR', message: '网络错误' }
      await handleAuthError(err)
      expect(refreshTokenMock).not.toHaveBeenCalled()
      expect(logoutMock).not.toHaveBeenCalled()
      expect(redirectToLoginMock).not.toHaveBeenCalled()
      expect(showFeedbackMock).not.toHaveBeenCalled()
    })

    it('返回 false 表示未处理非 auth 错误', async () => {
      const { handleAuthError } = useAuthErrorHandler(deps)
      const err: AppError = { kind: 'fatal', code: 'UNKNOWN', message: 'x', correlationId: 'c' }
      const handled = await handleAuthError(err)
      expect(handled).toBe(false)
    })

    it('返回 true 表示已处理 auth 错误', async () => {
      refreshTokenMock.mockResolvedValue(true)
      const { handleAuthError } = useAuthErrorHandler(deps)
      const handled = await handleAuthError(makeAuthError('M_UNKNOWN_TOKEN'))
      expect(handled).toBe(true)
    })
  })

  describe('无 refreshToken 依赖', () => {
    it('未提供 refreshToken 时，token 过期直接 logout 并跳转', async () => {
      const { handleAuthError } = useAuthErrorHandler({
        logout: logoutMock,
        redirectToLogin: redirectToLoginMock,
        showFeedback: showFeedbackMock
      })
      await handleAuthError(makeAuthError('M_UNKNOWN_TOKEN'))
      expect(logoutMock).toHaveBeenCalledTimes(1)
      expect(redirectToLoginMock).toHaveBeenCalledTimes(1)
    })
  })
})
