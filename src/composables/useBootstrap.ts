import { createSharedComposable } from '@vueuse/core'
import { computed, ref } from 'vue'
import { getDefaultMatrixEndpointConfig } from '@/services/backend'
import { applyLanguagePreference } from '@/services/i18n'
import { updateSettings } from '@/services/tauriCommand'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'
import { initializePlatform, isDesktop, isMobile } from '@/utils/PlatformConstants'
import { parseStoredProxySettings } from '@/utils/proxySettings'

const logger = createLogger('Bootstrap')

type BootstrapState = 'idle' | 'initializing' | 'ready' | 'error'

const BOOTSTRAP_TIMEOUT_MS = 15_000

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

  function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | undefined> {
    let timer: ReturnType<typeof setTimeout> | null = null
    return Promise.race([
      promise.finally(() => {
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
      }),
      new Promise<undefined>((resolve) => {
        timer = setTimeout(() => {
          timer = null
          logger.warn(`${label} 超时 (${ms}ms)，跳过`)
          resolve(undefined)
        }, ms)
      })
    ])
  }

  async function bootstrap(): Promise<void> {
    if (state.value === 'ready') {
      return
    }

    state.value = 'initializing'
    error.value = null

    // 兜底：如果 bootstrap 在超时内未完成，强制转为 ready 避免白屏
    const safetyTimer = setTimeout(() => {
      if (state.value === 'initializing') {
        logger.warn(`bootstrap 超过 ${BOOTSTRAP_TIMEOUT_MS}ms 未完成，强制转为 ready`)
        state.value = 'ready'
      }
    }, BOOTSTRAP_TIMEOUT_MS)

    try {
      await setLoading('初始化平台...', 10)
      initializePlatform()

      await setLoading('恢复配置...', 30)
      await withTimeout(
        Promise.allSettled([restoreProxySettings(), restoreTheme(), restoreLanguage()]),
        8_000,
        '恢复配置'
      )

      await setLoading('检查会话...', 80)
      await checkSession()

      await setLoading('就绪', 100)
      state.value = 'ready'

      preloadCriticalRoutes()
    } catch (err) {
      error.value = err instanceof Error ? err.message : '初始化失败'
      state.value = 'error'
      throw err
    } finally {
      clearTimeout(safetyTimer)
    }
  }

  async function restoreProxySettings() {
    const proxySettingsStr = localStorage.getItem('proxySettings')
    if (!proxySettingsStr) return

    try {
      const proxySettings = parseStoredProxySettings(proxySettingsStr, getDefaultMatrixEndpointConfig().homeserverUrl)
      if (!proxySettings) {
        localStorage.removeItem('proxySettings')
        return
      }

      const normalizedSettings = JSON.stringify(proxySettings)
      if (normalizedSettings !== proxySettingsStr) {
        localStorage.setItem('proxySettings', normalizedSettings)
      }

      const baseUrl =
        proxySettings.apiType + '://' + proxySettings.apiIp + ':' + proxySettings.apiPort + proxySettings.apiSuffix
      const wsUrl =
        proxySettings.wsType + '://' + proxySettings.wsIp + ':' + proxySettings.wsPort + proxySettings.wsSuffix

      await withTimeout(updateSettings({ baseUrl, wsUrl }), 3_000, '恢复代理设置')
    } catch (err) {
      logger.warn('恢复代理设置失败:', err)
    }
  }

  async function restoreTheme() {
    settingStore.ensureThemeReady()
  }

  async function restoreLanguage() {
    await applyLanguagePreference(settingStore.languagePreference)
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
