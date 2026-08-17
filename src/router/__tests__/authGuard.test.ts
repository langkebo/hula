import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: vi.fn((message: string, _type: string) => {
      ;(globalThis as { $message?: { warning?: (m: string) => void } }).$message?.warning?.(message)
    }),
    showError: vi.fn(),
    showProgressFeedback: vi.fn(),
    clearFeedback: vi.fn(),
    startLoading: vi.fn(),
    finishLoading: vi.fn(),
    errorLoading: vi.fn()
  })
}))

import { createAuthGuard, isPublicRoute } from '../authGuard'

const mockWarn = vi.fn()
const mockError = vi.fn()
const mockHasAuthenticatedSession = vi.fn()
const mockVerifyAdminAccess = vi.fn()

const createRoute = (path: string, requiresAdmin = false) =>
  ({
    path,
    matched: requiresAdmin ? [{ meta: { requiresAdmin: true } }] : [{ meta: {} }],
    meta: {}
  }) as any

describe('authGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).$message = { warning: vi.fn() }
  })

  it('allows public routes without authentication', async () => {
    const guard = createAuthGuard({
      isMobile: false,
      hasAuthenticatedSession: mockHasAuthenticatedSession,
      verifyAdminAccess: mockVerifyAdminAccess,
      logger: {
        warn: mockWarn,
        error: mockError
      }
    })

    const result = await guard(createRoute('/login'))

    expect(result).toBe(true)
    expect(mockHasAuthenticatedSession).not.toHaveBeenCalled()
  })

  it('allows auxiliary desktop windows without authentication', async () => {
    const guard = createAuthGuard({
      isMobile: false,
      hasAuthenticatedSession: mockHasAuthenticatedSession,
      verifyAdminAccess: mockVerifyAdminAccess,
      logger: {
        warn: mockWarn,
        error: mockError
      }
    })

    const result1 = await guard(createRoute('/capture'))
    const result2 = await guard(createRoute('/checkupdate'))

    expect(result1).toBe(true)
    expect(result2).toBe(true)
    expect(mockHasAuthenticatedSession).not.toHaveBeenCalled()
  })

  it('redirects unauthenticated desktop users to login', async () => {
    mockHasAuthenticatedSession.mockResolvedValue(false)

    const guard = createAuthGuard({
      isMobile: false,
      hasAuthenticatedSession: mockHasAuthenticatedSession,
      verifyAdminAccess: mockVerifyAdminAccess,
      logger: {
        warn: mockWarn,
        error: mockError
      }
    })

    const result = await guard(createRoute('/home'))

    expect(result).toBe('/login')
    expect(mockWarn).toHaveBeenCalledWith('未登录，跳转到 /login')
  })

  it('redirects unauthenticated mobile users to mobile login', async () => {
    mockHasAuthenticatedSession.mockResolvedValue(false)

    const guard = createAuthGuard({
      isMobile: true,
      hasAuthenticatedSession: mockHasAuthenticatedSession,
      verifyAdminAccess: mockVerifyAdminAccess,
      logger: {
        warn: mockWarn,
        error: mockError
      }
    })

    const result = await guard(createRoute('/mobile/home'))

    expect(result).toBe('/mobile/login')
  })

  it('blocks protected admin routes for non-admin users', async () => {
    mockHasAuthenticatedSession.mockResolvedValue(true)
    mockVerifyAdminAccess.mockResolvedValue(false)

    const guard = createAuthGuard({
      isMobile: false,
      hasAuthenticatedSession: mockHasAuthenticatedSession,
      verifyAdminAccess: mockVerifyAdminAccess,
      logger: {
        warn: mockWarn,
        error: mockError
      }
    })

    const result = await guard(createRoute('/admin/users', true))

    expect(mockVerifyAdminAccess).toHaveBeenCalledTimes(1)
    expect(result).toBe('/')
    // authGuard 不再直接操作 window.$message，而是通过 useActionFeedback
    expect(window.$message.warning).toHaveBeenCalledWith('error.matrix.forbidden')
  })

  it('allows authenticated users through protected routes', async () => {
    mockHasAuthenticatedSession.mockResolvedValue(true)

    const guard = createAuthGuard({
      isMobile: false,
      hasAuthenticatedSession: mockHasAuthenticatedSession,
      verifyAdminAccess: mockVerifyAdminAccess,
      logger: {
        warn: mockWarn,
        error: mockError
      }
    })

    const result = await guard(createRoute('/message'))

    expect(result).toBe(true)
  })

  it('bypasses auth when E2E harness is enabled', async () => {
    const guard = createAuthGuard({
      isMobile: true,
      hasAuthenticatedSession: mockHasAuthenticatedSession,
      verifyAdminAccess: mockVerifyAdminAccess,
      logger: {
        warn: mockWarn,
        error: mockError
      },
      shouldBypassAuth: () => true
    })

    const result = await guard(createRoute('/mobile/dynamic'))

    expect(result).toBe(true)
    expect(mockHasAuthenticatedSession).not.toHaveBeenCalled()
  })

  it('falls back to login when auth check throws', async () => {
    const failure = new Error('boom')
    mockHasAuthenticatedSession.mockRejectedValue(failure)

    const guard = createAuthGuard({
      isMobile: false,
      hasAuthenticatedSession: mockHasAuthenticatedSession,
      verifyAdminAccess: mockVerifyAdminAccess,
      logger: {
        warn: mockWarn,
        error: mockError
      }
    })

    const result = await guard(createRoute('/message'))

    expect(mockError).toHaveBeenCalledWith('认证检查错误:', failure)
    expect(result).toBe('/login')
  })
})

describe('isPublicRoute', () => {
  it('matches oidc callback and nested public paths', () => {
    expect(isPublicRoute('/oidc/callback')).toBe(true)
    expect(isPublicRoute('/capture')).toBe(true)
    expect(isPublicRoute('/checkupdate')).toBe(true)
    expect(isPublicRoute('/mobile/privacyAgreement/detail')).toBe(true)
    expect(isPublicRoute('/message')).toBe(false)
  })
})
