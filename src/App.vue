<template>
  <div class="h-100vh w-100vw">
    <NaiveProvider :message-max="3" :notific-max="3" class="h-full">
      <ConnectionStatusBanner
        :state="connectionState"
        :retry-count="connectionRetryCount"
        @retry="handleConnectionRetry" />
      <NetworkStatusBar />
      <SplashScreen
        v-if="showSplash"
        :visible="showSplash"
        :percentage="bootstrapProgress"
        :loading-text="bootstrapMessage"
        :show-error="!!bootstrapError"
        :error-message="bootstrapError || undefined"
        :retryable="true"
        @retry="handleBootstrapRetry" />
      <div v-else-if="!isLock" class="h-full">
        <router-view />
      </div>
      <LockScreen v-else />
      <GlobalAriaLive />
    </NaiveProvider>
    <MemoryMonitor v-if="isDev && showMemoryMonitor && isHomeDesktopWindow" />
  </div>
  <component :is="mobileRtcCallFloatCell" v-if="mobileRtcCallFloatCell" />
</template>

<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { exit } from '@tauri-apps/plugin-process'
import { useOfflineQueueReplay } from '@/composables/app/useOfflineQueueReplay'
import { usePresenceSync } from '@/composables/app/usePresenceSync'
import { useWsEventHandler } from '@/composables/app/useWsEventHandler'
import { useBootstrap } from '@/composables/useBootstrap'
import { useConnectionStatus } from '@/composables/useConnectionStatus'
import { MittEnum, ThemeEnum } from '@/enums'
import { useGlobalShortcut } from '@/hooks/useGlobalShortcut.ts'
import { useMitt } from '@/hooks/useMitt.ts'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useWindow } from '@/hooks/useWindow.ts'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isDesktop, isIOS, isMobile, isWindows10 } from '@/utils/PlatformConstants'

const logger = createLogger('App')

const LockScreen = defineAsyncComponent(() => import('@/views/LockScreen.vue'))
const MemoryMonitor = defineAsyncComponent(() => import('@/components/common/MemoryMonitor.vue'))
const SplashScreen = defineAsyncComponent(() => import('@/components/common/SplashScreen.vue'))

const mobileRtcCallFloatCell = isMobile()
  ? defineAsyncComponent(() => import('@/mobile/components/RtcCallFloatCell.vue'))
  : null

const isDev = import.meta.env.DEV
const tauriRuntimeAvailable = hasTauriRuntime()
const showMemoryMonitor = ref(true)
const appWindow = tauriRuntimeAvailable ? WebviewWindow.getCurrent() : null
const isHomeDesktopWindow = computed(() => isDesktop() && appWindow?.label === 'home')

// ========== Bootstrap ==========
const {
  state: bootstrapState,
  loadingMessage: bootstrapMessage,
  loadingProgress: bootstrapProgress,
  error: bootstrapError,
  bootstrap
} = useBootstrap()

// ========== Connection ==========
const { state: connectionState, retryCount: connectionRetryCount, retry: handleConnectionRetry } = useConnectionStatus()
const showSplash = computed(() => bootstrapState.value === 'initializing' || bootstrapState.value === 'idle')

const handleBootstrapRetry = async () => {
  await bootstrap()
}

// ========== Stores ==========
const settingStore = useSettingStore()
const globalStore = useGlobalStore()
const sessionStore = useSessionStore()
const userStore = useUserStore()
const { lockScreen } = storeToRefs(settingStore)
const router = useRouter()

// ========== Lock screen ==========
const LockExclusion = new Set(['/login', '/tray', '/qrCode', '/about', '/onlineStatus', '/capture'])
const isLock = computed(() => {
  return !LockExclusion.has(router.currentRoute.value.path) && lockScreen.value.enable
})

// ========== Window & global shortcuts (desktop only) ==========
const { ensureCheckUpdateWindow, createWebviewWindow } = isDesktop()
  ? useWindow()
  : { ensureCheckUpdateWindow: () => {}, createWebviewWindow: () => {} }
const { initializeGlobalShortcut, cleanupGlobalShortcut } = useGlobalShortcut()

// ========== Security: prevent drag & context menu in production ==========
const preventImageInputDrag = (e: MouseEvent) => {
  const el = e.target as HTMLElement
  if (el.nodeName.toLowerCase() === 'img' || el.nodeName.toLowerCase() === 'input') {
    e.preventDefault()
  }
}
const preventGlobalContextMenu = (event: MouseEvent) => event.preventDefault()
const handleGlobalKeydown = (e: KeyboardEvent) => {
  if (e.ctrlKey && (e.key === 'f' || e.key === 'r' || e.key === 'g' || e.key === 'j')) {
    e.preventDefault()
  }
}

// ========== Lazy service loaders (used by composables) ==========
function createLazyLoader<T, K extends keyof T>(importFn: () => Promise<T>, key: K): () => Promise<T[K]> {
  let cached: T[K] | undefined
  let loaded = false
  return async () => {
    if (!loaded) {
      const mod = await importFn()
      cached = mod[key]
      loaded = true
    }
    return cached as T[K]
  }
}

const getMatrixClientService = createLazyLoader(
  () => import('@/services/matrix/MatrixClientService'),
  'matrixClientService'
)
const getMatrixPresenceService = createLazyLoader(
  () => import('@/services/matrix/user/MatrixPresenceService'),
  'matrixPresenceService'
)
const getMatrixMessageService = createLazyLoader(
  () => import('@/services/matrix/messaging/MatrixMessageService'),
  'matrixMessageService'
)
const getMatrixReceiptService = createLazyLoader(
  () => import('@/services/matrix/messaging/MatrixReceiptService'),
  'matrixReceiptService'
)
const getMatrixReactionService = createLazyLoader(
  () => import('@/services/matrix/messaging/MatrixReactionService'),
  'matrixReactionService'
)
const getMatrixRoomStateService = createLazyLoader(
  () => import('@/services/matrix/room/StateService'),
  'matrixRoomStateService'
)
const getMatrixRoomService = createLazyLoader(
  () => import('@/services/matrix/room/MatrixRoomService'),
  'matrixRoomService'
)
const getMatrixRoomCreationService = createLazyLoader(
  () => import('@/services/matrix/room/CreationService'),
  'matrixRoomCreationService'
)
const getMatrixRoomDirectMessageService = createLazyLoader(
  () => import('@/services/matrix/room/DirectMessageService'),
  'matrixRoomDirectMessageService'
)
const getMatrixRoomTagsService = createLazyLoader(
  () => import('@/services/matrix/room/TagsService'),
  'matrixRoomTagsService'
)
const getMatrixRoomPinsService = createLazyLoader(
  () => import('@/services/matrix/room/PinsService'),
  'matrixRoomPinsService'
)

// ========== Offline queue (delegates to composable) ==========
const { initOfflineQueue } = useOfflineQueueReplay({
  getMatrixClientService,
  getMatrixMessageService,
  getMatrixReceiptService,
  getMatrixReactionService,
  getMatrixRoomStateService,
  getMatrixRoomService,
  getMatrixRoomCreationService,
  getMatrixRoomDirectMessageService,
  getMatrixRoomTagsService,
  getMatrixRoomPinsService
})

// ========== Presence sync (delegates to composable) ==========
const presenceSync = usePresenceSync({
  getMatrixClientService,
  getMatrixPresenceService,
  globalStore,
  sessionStore: sessionStore as any
})

// ========== WS event handler ==========
const wsEventHandler = useWsEventHandler()

// ========== Network status (desktop) ==========
if (isDesktop()) {
  useNetworkStatus()
}

// ========== Window event handlers (desktop) ==========
async function setupWindowHandlers() {
  if (!isDesktop() || !tauriRuntimeAvailable || !appWindow) return

  useMitt.on(MittEnum.CHECK_UPDATE, async () => {
    const checkUpdateWindow = await ensureCheckUpdateWindow()
    await checkUpdateWindow?.show()
  })
  useMitt.on<{ close: string }>(MittEnum.DO_UPDATE, async (event) => {
    await createWebviewWindow('update', 'update', 490, 335, '', false, 490, 335, false, true)
    const closeWindow = await WebviewWindow.getByLabel(event.close)
    closeWindow?.close()
  })
  // Listen for exit event
  const { useTauriListener } = await import('@/hooks/useTauriListener')
  const { addListener } = useTauriListener()
  const { EventEnum } = await import('@/enums')
  addListener(
    appWindow.listen(EventEnum.EXIT, async () => {
      await exit(0)
    }),
    'app-exit'
  )
}

// ========== Theme & style initialization ==========
function initPlatformStyles() {
  if (isWindows10() && appWindow) {
    void appWindow.setShadow(false).catch((error) => {
      logger.warn('disable window shadow failed:', error)
    })
  }

  if (isDesktop()) {
    import('@/styles/scss/global/desktop.scss').catch((e) => logger.warn('load desktop styles failed:', e))
    import('@/styles/scss/theme/simple.scss').then(() => {
      document.querySelector('#app')?.classList.add('simple')
    })
  }

  if (isMobile()) {
    import('@/styles/scss/global/mobile.scss').catch((e) => logger.warn('load mobile styles failed:', e))
  }

  settingStore.ensureThemeReady(ThemeEnum.OS)
}

// ========== Security: install event listeners ==========
function installSecurityListeners() {
  window.addEventListener('dragstart', preventImageInputDrag)

  if (import.meta.env.PROD) {
    window.addEventListener('keydown', handleGlobalKeydown)
    window.addEventListener('contextmenu', preventGlobalContextMenu, false)
  }

  // Init global shortcuts on desktop main window
  if (isDesktop() && appWindow?.label === 'home') {
    initializeGlobalShortcut()
  }
}

function uninstallSecurityListeners() {
  window.removeEventListener('dragstart', preventImageInputDrag)
  if (import.meta.env.PROD) {
    window.removeEventListener('keydown', handleGlobalKeydown)
    window.removeEventListener('contextmenu', preventGlobalContextMenu, false)
  }
}

// ========== iOS network permission ==========
const requestIOSNetworkPermission = async () => {
  if (!isIOS()) return
  try {
    await fetch('https://www.apple.com/favicon.ico', {
      method: 'HEAD',
      cache: 'no-cache'
    })
  } catch {
    // Expected to fail on first launch, triggers the permission dialog
  }
}

// ========== Mobile re-login listener ==========
const setupMobileReLoginListener = async () => {
  if (!isMobile()) return
  const { useLoginFlow } = await import('@/hooks/useLoginFlow')
  const { useTauriListener } = await import('@/hooks/useTauriListener')
  const { listen } = await import('@tauri-apps/api/event')
  const { addListener } = useTauriListener()
  const { logout } = useLoginFlow()
  addListener(
    listen('relogin', async () => {
      logger.info('received re-login event')
      await logout()
    }),
    'mobile-relogin'
  )
}

// ========== Theme reactivity watchers ==========
function setupThemeWatchers() {
  watch(
    () => settingStore.pageShadowEnabled,
    (val) => {
      if (isMobile()) {
        document.documentElement.style.setProperty('--shadow-enabled', '1')
      } else {
        document.documentElement.style.setProperty('--shadow-enabled', val ? '0' : '1')
      }
    },
    { immediate: true }
  )

  watch(
    () => settingStore.pageBlurEnabled,
    (val) => {
      document.documentElement.setAttribute('data-blur', val ? '1' : '0')
    },
    { immediate: true }
  )

  watch(
    () => settingStore.pageFontFamily,
    (val) => {
      document.documentElement.style.setProperty('--font-family', val)
    },
    { immediate: true }
  )

  watch(
    () => settingStore.languagePreference,
    (lang) => {
      void import('@/services/i18n').then(({ loadLanguage }) => loadLanguage(lang))
    }
  )
}

// ========== Session change watcher ==========
async function setupSessionWatch() {
  const { MittEnum, RoomTypeEnum } = await import('@/enums')
  useMitt.on(MittEnum.MSG_INIT, async () => {
    const { useAnnouncementStore } = await import('@/stores/domains/chat/announcement')
    const { useGroupStore } = await import('@/stores/domains/chat/group')
    const announcementStore = useAnnouncementStore()
    const groupStore = useGroupStore()

    watch(
      () => [globalStore.currentSessionRoomId, globalStore.currentSession?.type] as const,
      async ([sessionRoomId, sessionType]) => {
        if (!sessionRoomId || sessionType !== RoomTypeEnum.GROUP) return
        try {
          const result = await groupStore.switchSession({ roomId: sessionRoomId })
          if (result?.success) {
            await announcementStore.loadGroupAnnouncements()
          }
        } catch (error) {
          logger.error('session switch failed:', error)
        }
      },
      { immediate: true }
    )
  })
}

// ========== Lifecycle ==========
onMounted(async () => {
  await bootstrap()
  await initOfflineQueue()
  await requestIOSNetworkPermission()
  initPlatformStyles()
  installSecurityListeners()
  await setupWindowHandlers()
  await setupMobileReLoginListener()
  setupThemeWatchers()
  wsEventHandler.registerHandlers()
  presenceSync.startPresenceWatch()
})

onUnmounted(async () => {
  wsEventHandler.cleanup()
  presenceSync.cleanup()
  uninstallSecurityListeners()
  if (isDesktop() && appWindow?.label === 'home') {
    await cleanupGlobalShortcut()
  }
})
</script>

<style lang="scss">
.n-base-selection,
.n-base-select-menu,
.n-base-select-menu .n-base-select-option .n-base-select-option__content,
.n-base-select-menu .n-base-select-option::before {
  border-radius: 8px;
  font-size: 12px;
}

img {
  user-select: none;
  -webkit-user-select: none;
}

input,
button,
a {
  user-select: auto;
  cursor: auto;
}
</style>
