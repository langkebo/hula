import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

import { createAuthGuard, isPublicRoute } from '../authGuard'

const mockWarn = vi.fn()
const mockError = vi.fn()
const mockHasAuthenticatedSession = vi.fn()
const mockVerifyAdminAccess = vi.fn()
const next = vi.fn()

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

    await guard(createRoute('/login'), createRoute('/'), next)

    expect(next).toHaveBeenCalledWith()
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

    await guard(createRoute('/capture'), createRoute('/'), next)
    await guard(createRoute('/checkupdate'), createRoute('/'), next)

    expect(next).toHaveBeenNthCalledWith(1)
    expect(next).toHaveBeenNthCalledWith(2)
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

    await guard(createRoute('/home'), createRoute('/'), next)

    expect(next).toHaveBeenCalledWith('/login')
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

    await guard(createRoute('/mobile/home'), createRoute('/'), next)

    expect(next).toHaveBeenCalledWith('/mobile/login')
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

    await guard(createRoute('/admin/users', true), createRoute('/'), next)

    expect(mockVerifyAdminAccess).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith('/')
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

    await guard(createRoute('/message'), createRoute('/'), next)

    expect(next).toHaveBeenCalledWith()
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

    await guard(createRoute('/mobile/dynamic'), createRoute('/'), next)

    expect(next).toHaveBeenCalledWith()
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

    await guard(createRoute('/message'), createRoute('/'), next)

    expect(mockError).toHaveBeenCalledWith('认证检查错误:', failure)
    expect(next).toHaveBeenCalledWith('/login')
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
