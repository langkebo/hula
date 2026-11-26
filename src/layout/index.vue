<template>
  <div
    id="layout"
    class="relative flex min-w-310px bg-[--tjg-surface-subtle] h-full"
    :class="{ 'is-dragging-files': isDraggingFiles }">
    <SkipLink v-if="!isFullWindowRoute" target="#center" :label="t('common.skip_to_sessions')" />
    <SkipLink v-if="!isFullWindowRoute" target="#chat-main" :label="t('common.skip_to_chat')" />
    <div v-show="!isFullWindowRoute" class="flex flex-1 min-h-0">
      <AsyncLeft />
      <AsyncCenter />
      <AsyncRight v-if="showRightPane" />
    </div>
    <div v-if="isFullWindowRoute" class="flex flex-1 min-w-0 min-h-0"><router-view /></div>
    <div
      v-if="overlayVisible && !isFullWindowRoute"
      class="absolute inset-0 z-10 flex items-center justify-center bg-[--tjg-surface-subtle]">
      <LoadingSpinner :percentage="loadingPercentage" :loading-text="loadingText" />
    </div>

    <transition name="drag-upload">
      <div
        v-if="isDraggingFiles && !isFullWindowRoute"
        class="pointer-events-none absolute inset-0 z-999 flex flex-col items-center justify-center bg-[--tjg-overlay-mask-default] text-center text-[--tjg-text-inverse]">
        <div
          class="rounded-16px border border-[--tjg-border-strong] bg-[--tjg-overlay] px-40px py-20px backdrop-blur-md">
          <p class="text-[length:var(--tjg-font-size-xl)] font-semibold tracking-wide">
            {{ t('home.file_drop.title') }}
          </p>
          <p class="mt-6px text-[length:var(--tjg-font-size-md)] text-[--tjg-text-inverse] opacity-80">
            {{ t('home.file_drop.desc') }}
          </p>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { emitTo, listen } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { UserAttentionType } from '@tauri-apps/api/window'

import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import LoadingSpinner from '@/components/atomic/LoadingSpinner.vue'
import SkipLink from '@/components/common/SkipLink.vue'
import { useMessageSound } from '@/composables/common/useMessageSound'
import { useMitt } from '@/composables/common/useMitt'
import { useNativeFileDrop } from '@/composables/common/useNativeFileDrop'
import { useOverlayController } from '@/composables/common/useOverlayController'
import { useWindow } from '@/composables/common/useWindow'
import { useSearchShortcut } from '@/composables/search/useSearchShortcut'
import { useSettingsFullWindowEntry } from '@/composables/settings/useSettingsFullWindowEntry'
import { MittEnum, NotificationTypeEnum, RoomTypeEnum, TauriCommand, WsResponseMessageType } from '@/enums'
import { matrixNotificationService } from '@/services/matrix/notifications/MatrixNotificationService'
import { useLoginFlow } from '@/shared/composables/useLoginFlow'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useInitialSyncStore } from '@/stores/domains/chat/initialSync'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime, shouldBypassAuthForE2E } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isWindows, supportsTrayTipBubble } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'

const logger = createLogger('Layout')

const { t } = useI18n()
const route = useRoute()
// 全窗口视图（设置页）的布局桥接与原生菜单入口
const { isFullWindowRoute, setupMenuListener, cleanupMenuListener } = useSettingsFullWindowEntry()
const isRoomListRoute = computed(() => route.name === 'room')
const userStore = useUserStore()
const chatStore = useChatStore()
const groupStore = useGroupStore()
// 负责记录哪些账号已经完成过首次同步的全局 store，避免多账号串数据
const initialSyncStore = useInitialSyncStore()
const userUid = computed(() => userStore.userInfo?.uid ?? '')
// 是否需要阻塞首屏并做初始化同步
const requiresInitialSync = ref(true)
// hasCachedSessions 必须结合 requiresInitialSync 判断：
// 多账号切换时 sessionList 可能残留上一个账号的数据，若仅看 length>0 会误判为有缓存，
// 导致 shouldBlockInitialRender 为 false，新账号首屏无数据。
const hasCachedSessions = computed(() => !requiresInitialSync.value && chatStore.sessionList.length > 0)
const shouldBlockInitialRender = computed(() => requiresInitialSync.value && !hasCachedSessions.value)
const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const loadingPercentage = ref(10)
const loadingText = ref(t('home.loading.app'))
const { logout, init } = useLoginFlow()
const { ensureNotifyWindow } = useWindow()
// 阶段 3：注册全局搜索快捷键（Ctrl+F 聚焦中间栏搜索框，Ctrl+Shift+F 全局搜索）
useSearchShortcut()
const { overlayVisible, markAsyncLoaded } = useOverlayController({
  isInitialSync: shouldBlockInitialRender,
  progress: loadingPercentage,
  asyncTotal: 3,
  minDisplayMs: 600
})

let initPromise: Promise<void> | null = null

// 只有首次登录需要延迟异步组件的加载，后续重新登录直接渲染
const maybeDelayForInitialRender = async () => {
  if (!shouldBlockInitialRender.value) {
    return
  }
  await new Promise((resolve) => setTimeout(resolve, 600))
}

// 根据当前 uid 判断是否需要阻塞首屏并重新同步（依赖持久化的初始化完成名单）
const syncInitialSyncState = () => {
  if (!userUid.value || typeof window === 'undefined') {
    requiresInitialSync.value = true
    return
  }
  requiresInitialSync.value = !initialSyncStore.isSynced(userUid.value)
}

watch(
  () => userUid.value,
  () => {
    syncInitialSyncState()
  },
  { immediate: true }
)

// 初始化同步成功后标记当前 uid，后续启动直接走增量
const markInitialSyncCompleted = () => {
  if (!userUid.value || typeof window === 'undefined') {
    requiresInitialSync.value = false
    return
  }
  initialSyncStore.markSynced(userUid.value)
  requiresInitialSync.value = false
}

const runInitWithMode = () => {
  const p = init().then(() => {
    markInitialSyncCompleted()
  })

  // 关键修复：init 失败时不 rethrow，避免所有异步组件共享 rejected promise 导致白屏。
  // 错误已由 init() 内部的 bootstrapPostLoginState 处理（超时兜底 resolve），
  // 路由守卫会在后续导航中处理未登录状态。
  // 此处仅记录错误，让异步组件能正常加载（可能显示空数据，但不白屏）。
  return p.catch((error) => {
    logger.error('Initialization failed (async components not blocked):', error)
  })
}

// 确保初始化流程只触发一次
const ensureInitStarted = () => {
  if (!initPromise) {
    if (shouldBypassAuthForE2E()) {
      logger.info('E2E mock-auth mode detected, skipping Matrix bootstrap')
      initPromise = Promise.resolve()
      return initPromise
    }
    initPromise = runInitWithMode()
  }
  return initPromise
}

// 修改异步组件的加载配置
const AsyncLeft = defineAsyncComponent({
  loader: async () => {
    const blockInit = shouldBlockInitialRender.value
    const initTask = ensureInitStarted()
    await maybeDelayForInitialRender()
    loadingText.value = t('home.loading.left_panel')
    const comp = await import('./left/index.vue')
    loadingPercentage.value = 33
    if (blockInit) {
      await initTask
    }
    markAsyncLoaded()
    return comp
  }
})

const AsyncCenter = defineAsyncComponent({
  loader: async () => {
    const blockInit = shouldBlockInitialRender.value
    const initTask = ensureInitStarted()
    await import('./left/index.vue')
    loadingText.value = t('home.loading.data')
    const comp = await import('./center/index.vue')
    loadingPercentage.value = 66
    if (blockInit) {
      await initTask
    }
    markAsyncLoaded()
    return comp
  }
})

const AsyncRight = defineAsyncComponent({
  loader: async () => {
    const blockInit = shouldBlockInitialRender.value
    const initTask = ensureInitStarted()
    await maybeDelayForInitialRender()
    await import('./center/index.vue')
    loadingText.value = t('home.loading.right_panel')
    const comp = await import('./right/index.vue')
    loadingPercentage.value = 100
    if (blockInit) {
      await initTask
    }
    markAsyncLoaded()

    // 在组件加载完成后，使用nextTick等待DOM更新
    nextTick(() => {
      // 发送事件通知聊天框组件滚动到底部
      useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
    })

    return comp
  }
})

const globalStore = useGlobalStore()
const contactStore = useContactStore()
const shrinkStatus = ref(false)
// 右侧详情栏是否渲染：房间列表路由与收缩态下不渲染
const showRightPane = computed(() => !shrinkStatus.value && !isRoomListRoute.value)
// AsyncRight 不渲染时其 loader 不会调用 markAsyncLoaded，首次登录遮罩会因
// asyncTotal(3) 永远差 1 而无法隐藏（直接打开 /room 时整页被遮罩挡住）。
let rightPaneMarked = false
watch(
  showRightPane,
  (visible) => {
    if (visible || rightPaneMarked) return
    rightPaneMarked = true
    markAsyncLoaded()
  },
  { immediate: true }
)
const { isDraggingFiles, setupNativeFileDropListeners, cleanupNativeFileDropListeners } = useNativeFileDrop(appWindow)

// 监听shrinkStatus的变化
watch(shrinkStatus, (newValue) => {
  if (!newValue) {
    // 当shrinkStatus为false时，等待组件渲染完成后滚动到底部
    nextTick(() => {
      useMitt.emit(MittEnum.CHAT_SCROLL_BOTTOM)
    })
  }
})

/**
 * event默认如果没有传递值就为true，所以shrinkStatus的值为false就会发生值的变化
 * 因为shrinkStatus的值为false，所以v-if="!shrinkStatus" 否则right组件刚开始渲染的时候不会显示
 * */
useMitt.on(MittEnum.SHRINK_WINDOW, (event: boolean) => {
  shrinkStatus.value = event
})

// 播放消息音效
const { playMessageSound } = useMessageSound()

useMitt.on(WsResponseMessageType.RECEIVE_MESSAGE, async (data: MessageType) => {
  if (chatStore.checkMsgExist(data.message.roomId, data.message.id)) {
    return
  }

  chatStore.pushMsg(data, {
    // 只有当用户在消息页面且正在查看这个会话时才算 isActiveChatView
    isActiveChatView: route.path.startsWith('/message') && globalStore.currentSessionRoomId === data.message.roomId,
    activeRoomId: globalStore.currentSessionRoomId || ''
  })

  data.message.sendTime = new Date(data.message.sendTime).getTime()
  await invokeSilently(TauriCommand.SAVE_MSG, {
    data
  })

  const currentUid = userUid.value
  // 不是自己发的消息才通知
  if (!currentUid || data.fromUser?.uid !== currentUid) {
    // 获取该消息的会话信息
    const session = chatStore.sessionList.find((s) => s.roomId === data.message.roomId)

    // 房间级免打扰 + 全局通知决策门（勿扰时段 / 事件开关 / 关键词）统一裁决，
    // 避免「设置里开了勿扰，托盘气泡与提示音照旧响」。R1：复用既有服务层决策门，不另写判断。
    const shouldNotifyRoom =
      !!session &&
      session.muteNotification !== NotificationTypeEnum.NOT_DISTURB &&
      matrixNotificationService.shouldNotifyMessage({
        isMention: data.message.body.atUidList?.includes(currentUid) ?? false,
        isThread: Boolean(data.message.body.threadId),
        body: data.message.body.content || data.message.body.body || ''
      })

    if (shouldNotifyRoom) {
      // 检查 home 窗口状态
      let shouldPlaySound = false

      if (hasTauriRuntime()) {
        const home = await WebviewWindow.getByLabel('home')
        if (home) {
          try {
            const isVisible = await home.isVisible()
            const isMinimized = await home.isMinimized()
            const isFocused = await home.isFocused()

            // 如果窗口不可见、被最小化或未聚焦，则播放音效
            shouldPlaySound = !isVisible || isMinimized || !isFocused

            // 在Windows系统下，如果窗口最小化或未聚焦时请求用户注意
            if (isWindows() && (isMinimized || !isFocused)) {
              await home.requestUserAttention(UserAttentionType.Critical)
            }
          } catch (error) {
            logger.warn('Failed to check window state:', error)
            shouldPlaySound = true
          }
        } else {
          // 如果找不到 home 窗口，播放音效
          shouldPlaySound = true
        }
      } else {
        // 浏览器环境总是播放音效
        shouldPlaySound = true
      }

      // 播放消息音效
      if (shouldPlaySound) {
        await playMessageSound()
      }
      // session.unreadCount++
      // 托盘提示气泡仅 Windows 可用（Rust 侧只在 Windows 派发 notify_enter）；
      // macOS/Linux 由系统通知承担提醒，不再向不存在的 notify 窗口空派发。
      if (supportsTrayTipBubble()) {
        globalStore.setTipVisible(true)
      }

      if (supportsTrayTipBubble() && hasTauriRuntime() && WebviewWindow.getCurrent().label === 'home') {
        await ensureNotifyWindow()
        await emitTo('notify', 'notify_content', data)
      }
    }
  }

  globalStore.updateGlobalUnreadCount()
})

if (hasTauriRuntime()) {
  listen('relogin', async () => {
    logger.info('Received relogin event')
    await logout()
  })
}

onBeforeMount(async () => {
  // 获取最新的未读数
  await contactStore.getApplyUnReadCount()
  // 刷新好友申请列表
  await contactStore.getApplyPage('friend', true)
  // 刷新好友列表
  await contactStore.getContactList(true)

  // 页面刷新时，如果用户已登录且有当前会话，刷新群成员列表以获取最新的在线状态
  if (userStore.userInfo?.uid && globalStore.currentSessionRoomId) {
    const currentSession = globalStore.currentSession
    if (currentSession?.type === RoomTypeEnum.GROUP) {
      try {
        await groupStore.getGroupUserList(globalStore.currentSessionRoomId, true)
      } catch (error) {
        logger.error('Page init: failed to refresh group member list', error)
      }
    }
  }
})

onMounted(async () => {
  if (hasTauriRuntime()) {
    // 监听home窗口被聚焦的事件，当窗口被聚焦时自动关闭状态栏通知
    const homeWindow = await WebviewWindow.getByLabel('home')
    if (homeWindow) {
      // 监听窗口聚焦事件，聚焦时停止tray闪烁
      if (isWindows()) {
        homeWindow.listen('tauri://focus', async () => {
          globalStore.setTipVisible(false)
          try {
            await emitTo('tray', 'home_focus', {})
            await emitTo('notify', 'home_focus', {})
          } catch (error) {
            logger.warn('Failed to broadcast focus event to other windows:', error)
          }
        })

        homeWindow.listen('tauri://blur', async () => {
          try {
            await emitTo('tray', 'home_blur', {})
            await emitTo('notify', 'home_blur', {})
          } catch (error) {
            logger.warn('Failed to broadcast blur event to other windows:', error)
          }
        })
      }
      // 居中
      await homeWindow.center()
      await homeWindow.show()
    }

    await setupMenuListener()
  }

  await setupNativeFileDropListeners()
})

onUnmounted(() => {
  cleanupMenuListener()
  cleanupNativeFileDropListeners()
})
</script>

<style scoped>
.drag-upload-enter-active,
.drag-upload-leave-active {
  transition: opacity var(--tjg-motion-duration-overlay) ease;
}

.drag-upload-enter-from,
.drag-upload-leave-to {
  opacity: 0;
  transform: none;
}
</style>
