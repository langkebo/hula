import 'uno.css'
import '@unocss/reset/eric-meyer.css'
import '@/styles/css/design-tokens.css'
import '@/styles/scss/global/responsive.scss'
import '@/styles/scss/global/typography.scss'
import App from '@/App.vue'
import { AppException } from '@/common/exception.ts'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import vResize from '@/directives/v-resize'
import vRipple from '@/directives/v-ripple'
import { vSafeHtml } from '@/directives/v-safe-html'
import vSlide from '@/directives/v-slide.ts'
import router from '@/router'
import { setupI18n } from '@/services/i18n'
import { registerCapabilityStoreResolver } from '@/services/matrix/MatrixCapabilityService'
import { pinia } from '@/stores'
import { useCapabilityStore } from '@/stores/domains/chat/capability'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { errorTracker } from '@/utils/ErrorTracker'
import { initializePlatform, isIOS, isMobile } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { startWebVitalObserver } from '@/utils/WebVitalsObserver'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { MatrixCacheManager } from '@/services/matrix/MatrixCacheManager'
import { markTjgAppReady } from '@/utils/AppReady'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Main')
const { showFeedback } = useActionFeedback()

// Pre-emptively hide splash screen on mobile to reduce perceived startup time
if (isMobile() && hasTauriRuntime()) {
  invokeSilently('hide_splash_screen').catch(() => {})
}

performance.mark('tjg-init-start')

initializePlatform()
startWebVitalObserver({
  prometheusEndpoint: import.meta.env.VITE_PROMETHEUS_ENDPOINT,
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

  Object.defineProperty(window, '__tjg_cache_stats', {
    get: () => MatrixCacheManager.getStats()
  })
  MatrixCacheManager.enableStatsReporting()

  if (isMobile()) {
    import('eruda').then((module) => {
      const eruda = 'default' in module ? module.default : module
      eruda.init()
    })
  }
}

export const forceUpdateMessageTop = (topValue: number) => {
  const messages = document.querySelectorAll('.n-message-container.n-message-container--top')

  messages.forEach((el) => {
    const dom = el as HTMLElement
    dom.style.top = `${topValue}px`
  })
}

if (isMobile()) {
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', setup)
  } else {
    setup()
  }
}

async function setup() {
  if (!hasTauriRuntime()) return
  await invokeSilently('set_complete', { task: 'frontend' })
}

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

// Expose pinia for E2E tests and mark readiness
window.pinia = pinia
window.__TJG_PINIA_READY__ = true

// Register capability store resolver to break circular dependency
// (must be called after pinia is installed)
registerCapabilityStoreResolver(() => useCapabilityStore())
performance.mark('tjg-plugin-install-end')

performance.mark('tjg-mount-start')
app.mount('#app')
performance.mark('tjg-mount-end')
markTjgAppReady('mounted')

app.config.errorHandler = (err, instance, info) => {
  if (err instanceof Error) {
    errorTracker.trackVueError(err, {
      component: instance?.$options?.name ?? instance?.$options?.__name ?? undefined,
      action: info ?? undefined
    })
  }

  if (err instanceof AppException) {
    showFeedback(err.message, 'error')
    return
  }
  throw err
}

router.isReady().then(() => {
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
