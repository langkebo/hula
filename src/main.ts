import 'uno.css'
import '@unocss/reset/eric-meyer.css'
import '@/styles/css/design-tokens.css'
import '@/styles/scss/global/base.scss'
import '@/styles/scss/global/glass.scss'
import '@/styles/scss/global/responsive.scss'
import '@/styles/scss/global/typography.scss'
import App from '@/App.vue'
import { AppException } from '@/common/exception.ts'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import vClickable from '@/directives/v-clickable'
import vResize from '@/directives/v-resize'
import vRipple from '@/directives/v-ripple'
import { vSafeHtml } from '@/directives/v-safe-html'
import vSlide from '@/directives/v-slide.ts'
import { getPlatformBoot, registerPlatformBoot } from '@/platform/platformBoot'
import { registerSessionEventStrategy } from '@/platform/sessionEventStrategy'
import { registerStorageLayout } from '@/platform/storageLayout'
import router from '@/router'
import { setupI18n } from '@/services/i18n'
import { registerStrictDevicePolicyPreferences } from '@/services/matrix/crypto/strictDevicePolicyBootstrap'
import { registerExtensionHealthReporter } from '@/services/matrix/extensionHealthSink'
import { matrixCapabilityService, registerCapabilityStoreResolver } from '@/services/matrix/MatrixCapabilityService'
import { registerVoipCapabilityResolver } from '@/services/matrix/media/voipHelpers'
import { registerPrivacyPreferenceHooks } from '@/services/matrix/privacyPreferences'
import { pinia } from '@/stores'
import { useCapabilityStore } from '@/stores/domains/chat/capability'
import { useGlassEffectStore } from '@/stores/domains/settings/glassEffect'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { errorTracker } from '@/utils/ErrorTracker'
import { initializePlatform, isIOS } from '@/utils/PlatformConstants'
import { applyPerformanceTier } from '@/utils/performanceTier'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { createWebVitalsObserver } from '@/utils/WebVitalsObserver'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { markTjgAppReady } from '@/utils/AppReady'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Main')
const { showFeedback } = useActionFeedback()

// 性能分级必须在首次绘制前完成：液态玻璃等重特效依赖 <html>.low-perf / .medium-perf 决定模糊档位
applyPerformanceTier()

performance.mark('tjg-init-start')

initializePlatform()
// 平台差异实现经构建期入口（@/platform/entries/bindings）装配，运行期不再做平台分派（P3/A8）
registerStorageLayout()
registerPlatformBoot()
registerSessionEventStrategy()
const prometheusEndpoint = import.meta.env.VITE_PROMETHEUS_ENDPOINT
// 实例由组合根创建，工具模块不再维护全局单例（CQ-06）。
createWebVitalsObserver().start({
  ...(prometheusEndpoint === undefined ? {} : { prometheusEndpoint }),
  debug: import.meta.env.DEV
})
errorTracker.initialize()

performance.mark('tjg-platform-ready')

if (isIOS() && hasTauriRuntime()) {
  invokeSilently('request_ios_badge_authorization')
}

if (process.env.NODE_ENV === 'development') {
  import('@/utils/Console.ts').then((module) => {
    module.consolePrint()
  })

  // Expose stores for performance testing
  import('@/stores/domains/chat/chat/message').then((module) => {
    window.tjgChatStore = module.useChatStore()
  })
  import('@/stores/domains/widget/global').then((module) => {
    window.tjgGlobalStore = module.useGlobalStore()
  })
  import('@/stores/domains/user/user').then((module) => {
    window.tjgUserStore = module.useUserStore()
  })
  import('@/router/index').then((module) => {
    window.tjgRouter = module.default
  })
  window.pinia = pinia
}

// 平台差异启动逻辑（开发期调试控制台、首屏完成信号）由平台实现提供（P3/A8）
getPlatformBoot().afterPlatformInitialize()

performance.mark('tjg-app-create-start')
const app = createApp(App)
performance.mark('tjg-app-create-end')

performance.mark('tjg-plugin-install-start')
app
  .use(router)
  .use(pinia)
  .use(setupI18n)
  .directive('resize', vResize)
  .directive('slide', vSlide)
  .directive('safe-html', vSafeHtml)
  .directive('ripple', vRipple)
  .directive('clickable', vClickable)

// 液态玻璃 store 同步性能档位；DOM 降级类仍由顶部 applyPerformanceTier() 写入
// （docs/UI优化方案-v2.4.md §7.2：applyPerformanceTier → pinia → syncTier → 首屏）
useGlassEffectStore(pinia).syncTier()

// Expose pinia for E2E tests and mark readiness
window.pinia = pinia
window.__TJG_PINIA_READY__ = true

// Register capability store resolver to break circular dependency
// (must be called after pinia is installed)
registerCapabilityStoreResolver(() => useCapabilityStore())

// VoIP 可用性唯一取自能力服务（CAP-07），探针侧不再自判 callEventHandler
registerVoipCapabilityResolver(() => matrixCapabilityService.canUseVoip())

// 注入隐私偏好读取器，打破 service → setting store 的循环依赖
// （MatrixTypingService / MatrixPresenceService / MatrixReceiptService 不再直接 import Pinia）
registerPrivacyPreferenceHooks({
  isSendTypingNotificationsEnabled: () => useSettingStore(pinia).sendTypingNotificationsEnabled,
  isShowOnlineStatusEnabled: () => useSettingStore(pinia).showOnlineStatusEnabled,
  isSendReadReceiptsEnabled: () => useSettingStore(pinia).sendReadReceiptsEnabled
})

// 注入严格模式偏好读取器，打破 service → setting store 的循环依赖
// （strictDevicePolicyBootstrap 不再直接 import Pinia）
registerStrictDevicePolicyPreferences({
  ensureLoaded: () => useSettingStore(pinia).ensurePreferenceSettings(),
  isBlockUnverifiedDevicesEnabled: () => useSettingStore(pinia).blockUnverifiedDevicesEnabled,
  listRoomOverrides: () => useSettingStore(pinia).strictUnverifiedRooms
})

// 注入扩展健康状态接收器，打破 service → capability store 的循环依赖
// （MatrixConnectionManager 只上报状态，不直接 import Pinia）
registerExtensionHealthReporter((statuses) => useCapabilityStore(pinia).setExtensionHealthBatch(statuses))
performance.mark('tjg-plugin-install-end')

performance.mark('tjg-mount-start')
app.mount('#app')
performance.mark('tjg-mount-end')
markTjgAppReady('mounted')

app.config.errorHandler = (err, instance, info) => {
  if (err instanceof Error) {
    const component = instance?.$options?.name ?? instance?.$options?.__name
    errorTracker.trackVueError(err, {
      ...(component === undefined ? {} : { component }),
      action: info ?? undefined
    })
  }

  if (err instanceof AppException) {
    showFeedback(err.message, 'error')
    return
  }
  throw err
}

router
  .isReady()
  .then(() => {
    markTjgAppReady('router-ready')
    performance.mark('tjg-router-ready')
    performance.measure('tjg-total-boot', 'tjg-init-start', 'tjg-router-ready')
    performance.measure('tjg-app-creation', 'tjg-app-create-start', 'tjg-app-create-end')
    performance.measure('tjg-plugin-install', 'tjg-plugin-install-start', 'tjg-plugin-install-end')
    performance.measure('tjg-mount-to-ready', 'tjg-mount-start', 'tjg-router-ready')

    const measures = performance.getEntriesByType('measure')
    if (import.meta.env.DEV) {
      measures.forEach((measure) => {
        logger.debug(`性能指标 [${measure.name}]: ${measure.duration.toFixed(2)}ms`)
      })
    }
  })
  .catch((err) => {
    // F-2 修复：路由就绪失败时记录日志，避免 unhandledrejection
    logger.error('router.isReady failed:', err)
  })
