import type { RouteLocationNormalized } from 'vue-router'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useI18nGlobal } from '@/services/i18n'

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
  /** 仅桌面端提供；移动端裁剪 admin 后不注入，requiresAdmin 路由一律拒绝 */
  verifyAdminAccess?: (() => Promise<boolean>) | undefined
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
  return async (to: RouteLocationNormalized) => {
    if (isPublicRoute(to.path)) {
      return true
    }

    /**
     * E2E 旁路**只替代「登录态」这一层**，不放行 `requiresAdmin`。
     *
     * 历史实现是 `return true`（连后台权限一起绕过），后果：`?e2e=1&mockAuth=1` 下
     * 非管理员账号可以直接进 `/admin/dashboard`（2026-11-14 实测），
     * 于是「管理后台权限」这条路径在 e2e 里根本无法被验证 —— 这也正是 admin e2e 长期为 0 的原因之一。
     */
    const bypassAuth = shouldBypassAuth?.(to) ?? false
    if (bypassAuth) {
      logger.warn(`[E2E] 已绕过登录态检查: ${to.fullPath || to.path}`)
    }

    // 平台判定与「用户此刻站在哪套路由里」可能不一致：
    // - 移动端产物保留了桌面窗口路由（?platform=desktop 覆盖）；
    // - 浏览器 E2E 里整页重载可能丢掉 `?platform=mobile` 标记。
    // 一旦不一致，用户会从移动端页面被甩到**桌面登录页**（手机上看到 PC 布局）。
    // 因此以用户所见为准：目标在 /mobile/** 下就回移动登录页。
    const loginPath = isMobile || to.path.startsWith('/mobile') ? '/mobile/login' : '/login'

    try {
      const isLoggedIn = bypassAuth || (await hasAuthenticatedSession())
      if (!isLoggedIn) {
        logger.warn(`未登录，跳转到 ${loginPath}`)
        return loginPath
      }

      const requiresAdmin = to.matched.some((record) => record.meta.requiresAdmin)
      if (requiresAdmin) {
        const isAdmin = verifyAdminAccess ? await verifyAdminAccess() : false
        if (!isAdmin) {
          logger.warn(`非管理员尝试访问受限路径: ${to.path}`)
          const i18n = useI18nGlobal()
          useActionFeedback().showFeedback(i18n.t('error.matrix.forbidden'), 'warning')
          return '/'
        }
      }

      return true
    } catch (error) {
      logger.error('认证检查错误:', error)
      if (to.path !== loginPath) {
        return loginPath
      }
      return true
    }
  }
}
