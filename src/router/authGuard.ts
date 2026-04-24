import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'

export const PUBLIC_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/forgetPassword',
  '/mobile/login',
  '/mobile/splashscreen',
  '/mobile/MobileForgetPassword',
  '/mobile/serviceAgreement',
  '/mobile/privacyAgreement',
  '/oidc/callback'
]

export interface AuthGuardLogger {
  warn(message: string): void
  error(message: string, error?: unknown): void
}

export interface CreateAuthGuardOptions {
  isMobile: boolean
  hasAuthenticatedSession: () => Promise<boolean>
  verifyAdminAccess: () => Promise<boolean>
  logger: AuthGuardLogger
}

export const isPublicRoute = (path: string): boolean => {
  return PUBLIC_ROUTE_PREFIXES.some((route) => path === route || path.startsWith(route + '/'))
}

export const createAuthGuard = ({
  isMobile,
  hasAuthenticatedSession,
  verifyAdminAccess,
  logger
}: CreateAuthGuardOptions) => {
  return async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationGuardNext) => {
    if (isPublicRoute(to.path)) {
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
