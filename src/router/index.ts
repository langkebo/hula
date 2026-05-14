import {
  createRouter,
  createWebHistory,
  type NavigationGuardNext,
  type RouteLocationNormalized,
  type RouteRecordRaw,
  type Router
} from 'vue-router'
import { createAuthGuard } from '@/router/authGuard'
import { getCommonRoutes } from '@/router/routes/common'
import { getDesktopRoutes } from '@/router/routes/desktop'
import { getMobileRoutes } from '@/router/routes/mobile'
import { detectAppPlatform, shouldBypassAuthForE2E } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RouterGuard')

const { BASE_URL } = import.meta.env

const appPlatform = detectAppPlatform()
const isMobile = appPlatform === 'mobile'

const getAllRoutes = (): Array<RouteRecordRaw> => {
  const commonRoutes = getCommonRoutes()
  if (isMobile) {
    return [...commonRoutes, ...getMobileRoutes()]
  } else {
    return [...commonRoutes, ...getDesktopRoutes()]
  }
}

const router: Router = createRouter({
  history: createWebHistory(BASE_URL),
  routes: getAllRoutes()
})

const authGuard = createAuthGuard({
  isMobile,
  hasAuthenticatedSession: async () => {
    const { sessionOrchestrator } = await import('@/services/matrix/auth/SessionOrchestrator')
    return sessionOrchestrator.hasAuthenticatedSession()
  },
  verifyAdminAccess: async () => {
    const { useAdminStore } = await import('@/stores/domains/admin/admin')
    return useAdminStore().verifyAdminAccess()
  },
  logger,
  shouldBypassAuth: () => shouldBypassAuthForE2E()
})

router.beforeEach(async (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => {
  const title = to.meta.title as string | undefined
  if (title) {
    document.title = `${title} - HuLa`
  }
  return authGuard(to, from, next)
})

export default router
