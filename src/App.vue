<template>
  <div class="h-100vh w-100vw">
    <NaiveProvider :message-max="3" :notific-max="3" class="h-full">
      <ConnectionStatusBanner
        :state="connectionState"
        :retry-count="connectionRetryCount"
        @retry="handleConnectionRetry" />
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
import { showDialog } from 'vant'
import type { WatchStopHandle } from 'vue'
import { useI18n } from 'vue-i18n'
import { useInvitePolicyEnforcement } from '@/composables/app/useInvitePolicyEnforcement'
import { useOfflineQueueReplay } from '@/composables/app/useOfflineQueueReplay'
import { usePresenceSync } from '@/composables/app/usePresenceSync'
import { useWsEventHandler } from '@/composables/app/useWsEventHandler'
import { useGlobalShortcut } from '@/composables/common/useGlobalShortcut'
import { useMitt } from '@/composables/common/useMitt'
import { useNetworkStatus } from '@/composables/common/useNetworkStatus'
import { useWindow } from '@/composables/common/useWindow'
import { useBootstrap } from '@/composables/useBootstrap'
import { useConnectionStatus } from '@/composables/useConnectionStatus'
import { useVoIPIncomingCall } from '@/composables/useVoIPIncomingCall'
import { MittEnum, ThemeEnum } from '@/enums'
import { createContactStateResolver } from '@/services/matrix/user/contactStateResolver'
import { loadInvitePolicy } from '@/services/matrix/user/invitePolicy'
import { createInvitePolicyEnforcer } from '@/services/matrix/user/invitePolicyEnforcer'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { applyBubbleStyle, loadBubbleStyle } from '@/utils/bubbleStyle'
import { applyFontScale, loadFontScale } from '@/utils/fontScale'
import { createLogger } from '@/utils/Logger'
import { isDesktop, isIOS, isMobile, isWindows10 } from '@/utils/PlatformConstants'
import { isNonMatrixWindow } from '@/utils/windowLabels'

const logger = createLogger('App')

const { t } = useI18n()
const matrixStore = useMatrixStore()

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
const windowApi = isDesktop() ? useWindow() : null
const ensureCheckUpdateWindow = windowApi?.ensureCheckUpdateWindow ?? (async () => null)
const createWebviewWindow = windowApi?.createWebviewWindow ?? (async () => null)
const { initializeGlobalShortcut, cleanupGlobalShortcut } = useGlobalShortcut()

// VoIP 来电监听：收到 Call.incoming 时创建来电通知窗口
useVoIPIncomingCall({ createRtcCallWindow: windowApi?.createRtcCallWindow })

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
const getMatrixRoomService = createLazyLoader(
  () => import('@/services/matrix/room/ActionFacade'),
  'matrixRoomActionFacade'
)
const getMatrixRoomCreationService = createLazyLoader(
  () => import('@/services/matrix/room/CreationService'),
  'matrixRoomCreationService'
)
const getRoomOperations = createLazyLoader(() => import('@/services/matrix/room/RoomOperations'), 'roomOperations')
const getMatrixFriendService = createLazyLoader(
  () => import('@/services/matrix/friends/MatrixFriendService'),
  'matrixFriendService'
)
const getMatrixBurnAfterReadService = createLazyLoader(
  () => import('@/services/matrix/messaging/MatrixBurnAfterReadService'),
  'matrixBurnAfterReadService'
)
const getMatrixWidgetService = createLazyLoader(
  () => import('@/services/matrix/widget/MatrixWidgetService'),
  'matrixWidgetService'
)

// ========== Offline queue (delegates to composable) ==========
const { initOfflineQueue } = useOfflineQueueReplay({
  getMatrixClientService,
  getMatrixMessageService,
  getMatrixReceiptService,
  getMatrixReactionService,
  getMatrixRoomService,
  getMatrixRoomCreationService,
  getRoomOperations,
  getMatrixFriendService,
  getMatrixBurnAfterReadService,
  getMatrixWidgetService
})

// 联系人三态解析器：查询失败返回 unknown，绝不把失败当"陌生人"
// （MatrixFriendService.isFriend 失败时返回 false，不可区分）
const contactStateResolver = createContactStateResolver({
  isFriend: async (userId) => {
    const friendService = await getMatrixFriendService()
    return friendService.isFriend(userId)
  }
})

// ========== Invite policy enforcement ==========
// 账号级邀请策略只能在客户端强制（后端无账号级策略强制点，见 invitePolicy.ts 说明）。
// 自动拒邀后给一次可撤回的提示：静默拒邀一旦判错，用户无从察觉。
const invitePolicyEnforcement = useInvitePolicyEnforcement({
  // 强制点必须同步建好：start() 依赖 on/off 立刻注册，异步工厂会漏掉首批事件
  createEnforcer: (options) =>
    createInvitePolicyEnforcer({
      ...options,
      // 联系人查询失败返回 unknown → 判定 fail-open，不会误拒好友
      resolveContactState: (userId) => contactStateResolver.resolve(userId)
    }),
  getCurrentUserId: () => matrixStore.userId ?? undefined,
  getPolicy: () => loadInvitePolicy(),
  /**
   * 写路径的严格重读：`syncContacts()` 只拥有 `contacts`，其余字段必须来自服务端。
   * 抛错（读取失败）会被 composable 捕获并跳过写入，绝不回落默认值整对象覆盖。
   */
  getPolicyStrict: async () => {
    const account = await import('@/services/matrix/user/MatrixAccountService')
    return account.matrixAccountService.getInvitePolicyStrict()
  },
  savePolicy: async (policy) => {
    // `setInvitePolicy` 成功后才写本地缓存，避免 PUT 失败时缓存先被污染
    const account = await import('@/services/matrix/user/MatrixAccountService')
    return account.matrixAccountService.setInvitePolicy(policy)
  },
  getContacts: async () => {
    const friends = await (await getMatrixFriendService()).getFriends()
    return friends.map((friend) => friend.user_id).filter(Boolean)
  },
  onDeclined: (info) => {
    // 不用 Toast 的 action 按钮：Vant 4.10 的 ToastOptions 类型没有 action 字段
    // （运行时支持，类型不支持），用 Dialog 走完全类型化的路径，同时更显眼。
    showDialog({
      title: t('invite_policy.declined_title'),
      message: t('invite_policy.declined_message'),
      showCancelButton: true,
      confirmButtonText: t('invite_policy.undo'),
      cancelButtonText: t('invite_policy.dismiss'),
      closeOnClickOverlay: true
    })
      .then(() => {
        void invitePolicyEnforcement.undo(info.roomId).then((ok) => {
          if (!ok) {
            logger.warn(`撤回自动拒邀失败: ${info.roomId}`)
          }
        })
      })
      .catch(() => {
        // 用户选择不撤回，符合预期
      })
  }
})

// ========== Presence sync (delegates to composable) ==========
const presenceSync = usePresenceSync({
  getMatrixClientService,
  getMatrixPresenceService,
  globalStore,
  sessionStore
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
  const { useTauriListener } = await import('@/composables/common/useTauriListener')
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
    import('@/styles/scss/theme/simple.scss')
      .then(() => {
        document.querySelector('#app')?.classList.add('simple')
      })
      .catch((e) => logger.warn('load simple styles failed:', e))
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
    // Browser favicon reachability check — intentionally uses native fetch with no-cors
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
  try {
    const { useLoginFlow } = await import('@/shared/composables/useLoginFlow')
    const { useTauriListener } = await import('@/composables/common/useTauriListener')
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
  } catch (e) {
    logger.warn('setupMobileReLoginListener failed:', e)
  }
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
  try {
    const { MittEnum, RoomTypeEnum } = await import('@/enums')
    let sessionWatchStop: WatchStopHandle | null = null
    useMitt.on(MittEnum.MSG_INIT, async () => {
      const { useAnnouncementStore } = await import('@/stores/domains/chat/announcement')
      const { useGroupStore } = await import('@/stores/domains/chat/group')
      const announcementStore = useAnnouncementStore()
      const groupStore = useGroupStore()

      sessionWatchStop?.()
      sessionWatchStop = watch(
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
  } catch (e) {
    logger.warn('setupSessionWatch failed:', e)
  }
}

/**
 * 预热联系人状态缓存。
 *
 * 后台任务：好友列表加载失败不影响启动（缓存为空只会退化为逐个查询 + fail-open）。
 */
async function seedContactStateCache(): Promise<void> {
  try {
    const friendService = await getMatrixFriendService()
    const friends = await friendService.getFriends()
    contactStateResolver.seed(friends.map((friend) => friend.user_id).filter(Boolean))
  } catch (err) {
    logger.warn('预热联系人状态缓存失败（忽略）:', err)
  }
}

// ========== Lifecycle ==========
onMounted(async () => {
  // bootstrap 内部失败会 re-throw，必须 catch 避免未处理 rejection 中断后续初始化。
  // bootstrap 内部已将错误存入 state.error，SplashScreen 会展示重试入口。
  try {
    await bootstrap()
  } catch (err) {
    logger.error('Bootstrap 失败，跳过依赖初始化的步骤:', err)
    return
  }
  // 非 Matrix 窗口（截图/托盘/通知/更新）跳过 Matrix 运行时初始化：
  // 离线消息队列、WebSocket 事件处理、在线状态轮询均无意义且会重复注册监听。
  const skipMatrixInit = isNonMatrixWindow()
  if (!skipMatrixInit) {
    await initOfflineQueue()
  }
  await requestIOSNetworkPermission()
  initPlatformStyles()
  installSecurityListeners()
  await setupWindowHandlers()
  await setupMobileReLoginListener()
  setupThemeWatchers()
  // 字体缩放不是响应式 store：启动时读一次 localStorage 并写到 :root，供字号 token 消费
  applyFontScale(loadFontScale())
  // 气泡样式同理：读一次存储写到根元素 data 属性，由 render-message.scss 消费
  applyBubbleStyle(loadBubbleStyle())
  if (!skipMatrixInit) {
    wsEventHandler.registerHandlers()
    presenceSync.startPresenceWatch()
    invitePolicyEnforcement.start()
    await invitePolicyEnforcement.syncContacts()
    // 用同一份好友列表预热联系人状态缓存，省掉逐个查询
    await seedContactStateCache()
  }
})

onUnmounted(async () => {
  wsEventHandler.cleanup()
  invitePolicyEnforcement.stop()
  contactStateResolver.clear()
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
