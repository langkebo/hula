import { createSharedComposable } from '@vueuse/core'
import { ref, computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { useSettingStore } from '@/stores/setting'
import { isDesktop } from '@/utils/PlatformConstants'
import { loadLanguage } from '@/services/i18n'
import { updateSettings } from '@/services/tauriCommand'
import { initializePlatform } from '@/utils/PlatformConstants'
import { useNotificationPermission } from './useNotificationPermission'
import { useMediaPermission } from './useMediaPermission'
import { useFileSystemPermission } from './useFileSystemPermission'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('Bootstrap')

export type BootstrapState = 'idle' | 'initializing' | 'ready' | 'error'

export interface BootstrapResult {
  state: BootstrapState
  isReady: boolean
  isLoading: boolean
  loadingMessage: string
  loadingProgress: number
  error: string | null
  capabilities: {
    notification: 'granted' | 'denied' | 'default' | 'unsupported'
    media: 'granted' | 'denied' | 'default' | 'unsupported'
    fileSystem: boolean
    webview: boolean
  }
}

const useSharedBootstrap = createSharedComposable(() => {
  const state = ref<BootstrapState>('idle')
  const loadingMessage = ref('')
  const loadingProgress = ref(0)
  const error = ref<string | null>(null)

  const userStore = useUserStore()
  const settingStore = useSettingStore()

  const { permission: notificationPermission } = useNotificationPermission()
  const { permission: mediaPermission } = useMediaPermission()
  const { isSupported: fileSystemSupported } = useFileSystemPermission()

  const isLoading = computed(() => state.value === 'initializing')
  const isReady = computed(() => state.value === 'ready')
  const isError = computed(() => state.value === 'error')

  const capabilities = computed(() => ({
    notification: notificationPermission.value,
    media: mediaPermission.value,
    fileSystem: fileSystemSupported.value,
    webview: isDesktop()
  }))

  async function setLoading(msg: string, progress: number) {
    loadingMessage.value = msg
    loadingProgress.value = progress
  }

  async function bootstrap(): Promise<BootstrapResult> {
    if (state.value === 'ready') {
      return getResult()
    }

    state.value = 'initializing'
    error.value = null

    try {
      await setLoading('初始化平台...', 10)
      initializePlatform()

      await setLoading('恢复代理设置...', 20)
      await restoreProxySettings()

      await setLoading('恢复主题...', 40)
      await restoreTheme()

      await setLoading('加载语言...', 60)
      await restoreLanguage()

      await setLoading('检查会话...', 80)
      await checkSession()

      await setLoading('就绪', 100)
      state.value = 'ready'

      return getResult()
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

  function getResult(): BootstrapResult {
    return {
      state: state.value,
      isReady: isReady.value,
      isLoading: isLoading.value,
      loadingMessage: loadingMessage.value,
      loadingProgress: loadingProgress.value,
      error: error.value,
      capabilities: capabilities.value
    }
  }

  function reset() {
    state.value = 'idle'
    loadingMessage.value = ''
    loadingProgress.value = 0
    error.value = null
  }

  return {
    state,
    isReady,
    isLoading,
    isError,
    loadingMessage,
    loadingProgress,
    error,
    capabilities,
    bootstrap,
    reset,
    getResult
  }
})

export function useBootstrap() {
  return useSharedBootstrap()
}

export default useBootstrap
