import { createSharedComposable } from '@vueuse/core'
import { ref, computed } from 'vue'
import { useUserStore } from '@/stores/domains/user/user'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { isDesktop, isMobile } from '@/utils/PlatformConstants'
import { loadLanguage } from '@/services/i18n'
import { updateSettings } from '@/services/tauriCommand'
import { initializePlatform } from '@/utils/PlatformConstants'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('Bootstrap')

export type BootstrapState = 'idle' | 'initializing' | 'ready' | 'error'

const useSharedBootstrap = createSharedComposable(() => {
  const state = ref<BootstrapState>('idle')
  const loadingMessage = ref('')
  const loadingProgress = ref(0)
  const error = ref<string | null>(null)

  const userStore = useUserStore()
  const settingStore = useSettingStore()

  const isLoading = computed(() => state.value === 'initializing')

  async function setLoading(msg: string, progress: number) {
    loadingMessage.value = msg
    loadingProgress.value = progress
  }

  async function bootstrap(): Promise<void> {
    if (state.value === 'ready') {
      return
    }

    state.value = 'initializing'
    error.value = null

    try {
      await setLoading('初始化平台...', 10)
      initializePlatform()

      await setLoading('恢复配置...', 30)
      await Promise.all([restoreProxySettings(), restoreTheme(), restoreLanguage()])

      await setLoading('检查会话...', 80)
      await checkSession()

      await setLoading('就绪', 100)
      state.value = 'ready'

      preloadCriticalRoutes()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化失败'
      state.value = 'error'
      throw err
    }
  }

  async function restoreProxySettings() {
    const proxySettingsStr = localStorage.getItem('proxySettings')
    if (!proxySettingsStr) return

    try {
      const proxySettings = JSON.parse(proxySettingsStr)
      const baseUrl =
        proxySettings.apiType + '://' + proxySettings.apiIp + ':' + proxySettings.apiPort + proxySettings.apiSuffix
      const wsUrl =
        proxySettings.wsType + '://' + proxySettings.wsIp + ':' + proxySettings.wsPort + proxySettings.wsSuffix

      await updateSettings({ baseUrl, wsUrl })
    } catch (err) {
      logger.warn('恢复代理设置失败:', err)
    }
  }

  async function restoreTheme() {
    if (!settingStore.themes.content) {
      settingStore.initTheme('os')
    } else {
      settingStore.normalizeThemeState()
    }
  }

  async function restoreLanguage() {
    const lang = settingStore.page.lang === 'AUTO' ? navigator.language : settingStore.page.lang
    loadLanguage(lang)
  }

  async function checkSession() {
    const hasSession = userStore.isLoggedIn
    if (!hasSession) {
      logger.debug('无可恢复会话')
    }
  }

  function preloadCriticalRoutes() {
    const scheduleIdleWork =
      typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? window.requestIdleCallback.bind(window)
        : (callback: IdleRequestCallback) => window.setTimeout(() => callback({} as IdleDeadline), 1)

    scheduleIdleWork(() => {
      if (isDesktop()) {
        import('@/views/homeWindow/message/index.vue')
        import('@/layout/index.vue')
      } else if (isMobile()) {
        import('@/mobile/views/message/index.vue')
      }
    })
  }

  return {
    state,
    isLoading,
    loadingMessage,
    loadingProgress,
    error,
    bootstrap
  }
})

export function useBootstrap() {
  return useSharedBootstrap()
}

export default useBootstrap
