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

router.beforeEach(async (to: RouteLocationNormalized) => {
  const title = to.meta.title as string | undefined
  if (title) {
    document.title = `${title} - Tjg`
  }
  const authResult = await authGuard(to)
  if (authResult !== true) {
    return authResult
  }

  // 私密聊天硬门禁（方案 P0-0-c）：
  // 未配置密码 → 引导设置并挡回消息页；已配置未解锁 → 记录意图、弹解锁框、挡回消息页。
  // 守卫不阻塞等待用户输入，解锁成功后由对话框按 pendingPath 回跳。
  if (to.path === '/secretChat' || to.path.startsWith('/secretChat/')) {
    const [{ useSettingStore }, { isSecretChatUnlocked }, { openSecretChatUnlock }] = await Promise.all([
      import('@/stores/domains/settings/setting'),
      import('@/stores/domains/settings/secretChatSession'),
      import('@/composables/secretChat/useSecretChatGate')
    ])
    const settingStore = useSettingStore()
    if (!settingStore.isSecretChatConfigured()) {
      logger.warn('私密聊天未配置密码，已拦截访问')
      const { useI18nGlobal } = await import('@/services/i18n')
      const { useActionFeedback } = await import('@/composables/common/useActionFeedback')
      useActionFeedback().showFeedback(useI18nGlobal().t('home.secret_chat.no_password'), 'warning')
      return '/message'
    }
    if (!isSecretChatUnlocked()) {
      logger.warn('私密聊天处于锁定态，已请求解锁')
      openSecretChatUnlock(to.fullPath)
      return '/message'
    }
  }

  return true
})

export default router
