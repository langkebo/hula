import {
  createRouter,
  createWebHistory,
  type RouteLocationNormalized,
  type RouteRecordRaw,
  type Router
} from 'vue-router'
import { createAuthGuard } from '@/router/authGuard'
import { getCommonRoutes } from '@/router/routes/common'
import { getDesktopRoutes } from '@/router/routes/desktop'
import { getMobileRoutes } from '@/router/routes/mobile'
import { createSecretChatGuard } from '@/router/secretChatGuard'
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

/**
 * 私密聊天门禁（方案 P0-0-c）。所有依赖走动态导入，避免把设置/加密模块拖进首屏。
 */
const secretChatGuard = createSecretChatGuard({
  logger,
  fallbackPath: isMobile ? '/mobile/message' : '/message',
  isConfigured: async () => {
    const { useSettingStore } = await import('@/stores/domains/settings/setting')
    return useSettingStore().isSecretChatConfigured()
  },
  isUnlocked: async () => {
    const { isSecretChatUnlocked } = await import('@/stores/domains/settings/secretChatSession')
    return isSecretChatUnlocked()
  },
  isPrivateRoom: async (roomId) => {
    const { isPrivateRoom } = await import('@/services/matrix/privateChat/privateRoomRegistry')
    return isPrivateRoom(roomId)
  },
  ensureRegistryReady: async () => {
    const { ensurePrivateRoomRegistryReady } = await import('@/services/matrix/privateChat/privateRoomRegistry')
    await ensurePrivateRoomRegistryReady()
  },
  openUnlock: async (pendingPath) => {
    const { openSecretChatUnlock } = await import('@/composables/secretChat/useSecretChatGate')
    openSecretChatUnlock(pendingPath)
  },
  warnNotConfigured: async () => {
    const [{ useI18nGlobal }, { useActionFeedback }] = await Promise.all([
      import('@/services/i18n'),
      import('@/composables/common/useActionFeedback')
    ])
    useActionFeedback().showFeedback(useI18nGlobal().t('home.secret_chat.no_password'), 'warning')
  }
})

router.beforeEach(async (to: RouteLocationNormalized) => {
  const title = to.meta.title as string | undefined
  if (title) {
    document.title = `${title} - Tjg`
  }
  const authResult = await authGuard(to)
  if (authResult !== true) {
    return authResult
  }
  // 认证之后才判私密门禁：未登录时先去登录页，不要先弹解锁框
  return secretChatGuard(to)
})

export default router
