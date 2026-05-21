import 'uno.css'
import '@unocss/reset/eric-meyer.css'
import '@/styles/css/design-tokens.css'
import App from '@/App.vue'
import { AppException } from '@/common/exception.ts'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import vResize from '@/directives/v-resize'
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
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Main')
const { showFeedback } = useActionFeedback()

performance.mark('hula-init-start')

initializePlatform()
startWebVitalObserver({
  prometheusEndpoint: import.meta.env.VITE_PROMETHEUS_ENDPOINT,
  debug: import.meta.env.DEV
})
errorTracker.initialize()

performance.mark('hula-platform-ready')

if (isIOS() && hasTauriRuntime()) {
  invokeSilently('request_ios_badge_authorization')
}

if (process.env.NODE_ENV === 'development') {
  import('@/utils/Console.ts').then((module) => {
    module.consolePrint()
  })

  // Expose stores for performance testing
  import('@/stores/domains/chat/chat/message').then((module) => {
    window.hulaChatStore = module.useChatStore()
  })
  import('@/stores/domains/widget/global').then((module) => {
    window.hulaGlobalStore = module.useGlobalStore()
  })
  import('@/stores/domains/user/user').then((module) => {
    window.hulaUserStore = module.useUserStore()
  })
  import('@/router/index').then((module) => {
    window.hulaRouter = module.default
  })
  window.pinia = pinia

  Object.defineProperty(window, '__hula_cache_stats', {
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

performance.mark('hula-app-create-start')
const app = createApp(App)
performance.mark('hula-app-create-end')

performance.mark('hula-plugin-install-start')
app
  .use(router)
  .use(pinia)
  .use(setupI18n)
  .directive('resize', vResize)
  .directive('slide', vSlide)
  .directive('safe-html', vSafeHtml)

// Register capability store resolver to break circular dependency
// (must be called after pinia is installed)
registerCapabilityStoreResolver(() => useCapabilityStore())
performance.mark('hula-plugin-install-end')

performance.mark('hula-mount-start')
app.mount('#app')
performance.mark('hula-mount-end')

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
  performance.mark('hula-router-ready')
  performance.measure('hula-total-boot', 'hula-init-start', 'hula-router-ready')
  performance.measure('hula-app-creation', 'hula-app-create-start', 'hula-app-create-end')
  performance.measure('hula-plugin-install', 'hula-plugin-install-start', 'hula-plugin-install-end')
  performance.measure('hula-mount-to-ready', 'hula-mount-start', 'hula-router-ready')

  const measures = performance.getEntriesByType('measure')
  if (import.meta.env.DEV) {
    measures.forEach((measure) => {
      logger.debug(`性能指标 [${measure.name}]: ${measure.duration.toFixed(2)}ms`)
    })
  }
})
