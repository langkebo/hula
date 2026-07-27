import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'

const PUBLIC_ROUTE_PREFIXES = [
  '/login',
  '/capture',
  '/checkupdate',
  '/register',
  '/qrCode',
  '/forgetPassword',
  '/mobile/login',
  '/mobile/splashscreen',
  '/mobile/MobileForgetPassword',
  '/mobile/serviceAgreement',
  '/mobile/privacyAgreement',
  '/oidc/callback'
]

interface AuthGuardLogger {
  warn(message: string): void
  error(message: string, error?: unknown): void
}

interface CreateAuthGuardOptions {
  isMobile: boolean
  hasAuthenticatedSession: () => Promise<boolean>
  verifyAdminAccess: () => Promise<boolean>
  logger: AuthGuardLogger
  shouldBypassAuth?: (to: RouteLocationNormalized) => boolean
}

export const isPublicRoute = (path: string): boolean => {
  return PUBLIC_ROUTE_PREFIXES.some((route) => path === route || path.startsWith(route + '/'))
}

export const createAuthGuard = ({
  isMobile,
  hasAuthenticatedSession,
  verifyAdminAccess,
  logger,
  shouldBypassAuth
}: CreateAuthGuardOptions) => {
  return async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
    if (isPublicRoute(to.path)) {
      return next()
    }

    if (shouldBypassAuth?.(to)) {
      logger.warn(`[E2E] 已绕过认证检查: ${to.fullPath || to.path}`)
      return next()
    }

    const loginPath = isMobile ? '/mobile/login' : '/login'

    try {
      const isLoggedIn = await hasAuthenticatedSession()
      if (!isLoggedIn) {
        logger.warn(`未登录，跳转到 ${loginPath}`)
        return next(loginPath)
      }

      const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin)
      if (requiresAdmin) {
        const isAdmin = await verifyAdminAccess()
        if (!isAdmin) {
          logger.warn(`非管理员尝试访问受限路径: ${to.path}`)
          return next('/404')
        }
      }

      return next()
    } catch (error) {
      logger.error('认证检查错误:', error)
      if (to.path !== loginPath) {
        return next(loginPath)
      }
      return next()
    }
  }
}
