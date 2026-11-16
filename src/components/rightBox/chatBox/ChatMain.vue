<template>
  <div class="flex flex-col overflow-hidden h-full relative">
    <ChatBanners
      :network-banner-text="networkBanner?.text ?? null"
      :is-announcement-loading="isAnnouncementLoading"
      :is-group="isGroup"
      :top-announcement="topAnnouncement"
      :current-room-id="globalStore.currentSessionRoomId ?? null"
      :private-mode-active="privateModeActive"
      :burn-enabled="burnEnabled"
      :current-user-id="currentUserId"
      :current-user-name="currentUserName"
      :sticky-events="stickyEvents"
      :can-set-sticky="canSetSticky"
      @view-announcement="handleViewAnnouncement"
      @set-sticky="handleSetSticky"
      @cancel-sticky="handleCancelSticky"
      @view-sticky-event="handleViewStickyEvent" />

    <!-- 房间内消息搜索面板（F2） -->
    <ChatRoomSearch
      :is-open="searchIsOpen"
      :query="searchQuery"
      :results="searchResults"
      :loading="searchLoading"
      :error="searchError"
      :active-index="searchActiveIndex"
      @update:query="handleSearchQueryUpdate"
      @query-input="handleSearchQueryInput"
      @select-result="handleSearchSelectResult"
      @navigate="handleSearchNavigate"
      @set-active="handleSearchSetActive"
      @retry="searchRetry"
      @close="closeRoomSearch" />

    <!-- 聊天内容 -->
    <div class="flex flex-col flex-1 min-h-0">
      <div
        id="image-chat-main"
        ref="scrollContainer"
        class="scrollbar-container"
        :class="{ 'hide-scrollbar': !showScrollbar }"
        @scroll="handleScroll"
        @click="handleChatAreaClick"
        @mouseenter="showScrollbar = true"
        @mouseleave="showScrollbar = false">
        <!-- 消息列表 -->
        <div
          ref="messageListRef"
          role="log"
          aria-live="polite"
          class="message-list min-h-full flex flex-col"
          :class="{ 'private-mode-active': privateModeActive }">
          <ChatLoadMoreIndicator :loading="isLoadingMore" :error="loadMoreError" @retry="retryLoadMore" />
          <ChatMessageList
            :is-group="isGroup"
            :private-mode-active="privateModeActive"
            :active-reply="activeReply"
            @jump-to-reply="jumpToReplyMsg" />
        </div>
      </div>
    </div>

    <!--  悬浮按钮提示(底部悬浮) -->
    <ChatFloatButton
      v-if="shouldShowFloatButton && currentNewMsgCount"
      :count="currentNewMsgCount.count"
      :label="newMsgCountLabel"
      :float-style="floatButtonStyle"
      @click="handleFloatButtonClick" />

    <!-- 文件上传进度条 -->
    <FileUploadProgress />

    <!-- 阅后即焚切换（私密模式激活且服务端支持该能力时） -->
    <BurnAfterReadBar
      v-if="privateModeActive"
      :enabled="burnEnabled"
      @update:enabled="handleBurnToggle"
      @select-duration="handleBurnDurationChange" />
  </div>

  <ChatModals
    v-model:modal-show="modalShow"
    v-model:group-nickname-modal-visible="groupNicknameModalVisible"
    v-model:group-nickname-value="groupNicknameValue"
    v-model:thread-panel-visible="threadPanelVisible"
    v-model:event-report-visible="eventReportVisible"
    v-model:show-private-confirm="showPrivateConfirm"
    :tips="tips"
    :group-nickname-error="groupNicknameError"
    :group-nickname-submitting="groupNicknameSubmitting"
    :thread-original-message="threadOriginalMessage"
    :active-thread-id="activeThreadId"
    :active-thread-room-id="activeThreadRoomId"
    :event-report-data="eventReportData"
    :private-mode-features="privateModeFeatures"
    @confirm="handleConfirm"
    @group-nickname-confirm="handleGroupNicknameConfirm"
    @cancel-private-mode="cancelPrivateMode"
    @confirm-private-mode="confirmPrivateMode" />

  <PinMessageSelector v-model:show="pinSelectorVisible" @select="handlePinSelect" />

  <!--
    设备验证对话框的单例挂载点。
    消息列表内部（MessageLockBadge 点击）通过 useDeviceVerifyLauncher 唤起，
    对话框只在此处挂载一次 —— 若挂在 renderMessage 上会按消息条数各实例化一份。
  -->
  <DeviceVerifyDialog
    :show="deviceVerifyVisible"
    :user-id="deviceVerifyTarget.userId"
    :device-id="deviceVerifyTarget.deviceId"
    :device-name="deviceVerifyTarget.deviceName"
    @update:show="handleDeviceVerifyShowChange"
    @success="handleDeviceVerifySuccess" />
</template>

<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useEventListener } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, provide, type Ref, ref, useTemplateRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAnnouncementBanner } from '@/composables/chat/useAnnouncementBanner'
import { useAvatarPreloader } from '@/composables/chat/useAvatarPreloader'
import { useChatDialogs } from '@/composables/chat/useChatDialogs'
import { chatMainInjectionKey, useChatMain } from '@/composables/chat/useChatMain'
import { useChatScrollManager } from '@/composables/chat/useChatScrollManager'
import { useMessageJump } from '@/composables/chat/useMessageJump'
import { useNewMessageBadge } from '@/composables/chat/useNewMessageBadge'
import { usePrivateMode } from '@/composables/chat/usePrivateMode'
import { useRoomSearch } from '@/composables/chat/useRoomSearch'
import { useWheelScrollLimiter } from '@/composables/chat/useWheelScrollLimiter'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { useNetworkStatus } from '@/composables/common/useNetworkStatus'
import { useWindow } from '@/composables/common/useWindow'
import { useDeviceVerifyLauncher } from '@/composables/encryption/useDeviceVerifyLauncher'
import { useStickyEvents } from '@/composables/room/useStickyEvents'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
import { MittEnum } from '@/enums'
import { useServerCapability } from '@/services/matrix/MatrixCapabilityService'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { audioManager } from '@/utils/AudioManager'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'
import BurnAfterReadBar from './BurnAfterReadBar.vue'
import ChatBanners from './ChatBanners.vue'
import ChatFloatButton from './ChatFloatButton.vue'
import ChatLoadMoreIndicator from './ChatLoadMoreIndicator.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatModals from './ChatModals.vue'
import ChatRoomSearch from './ChatRoomSearch.vue'
import PinMessageSelector from './PinMessageSelector.vue'

const FileUploadProgress = defineAsyncComponent(() => import('@/components/rightBox/FileUploadProgress.vue'))
/** 验证对话框只在被唤起时才可能渲染，按需加载以免拖大会话主 chunk */
const DeviceVerifyDialog = defineAsyncComponent(() => import('@/components/encryption/DeviceVerifyDialog.vue'))

const logger = createLogger('ChatMain')
const timerManager = useTimerManager()
const selfEmit = defineEmits(['scroll'])
const props = withDefaults(
  defineProps<{
    /** 移动端交互：不触发气泡高亮、点头像进资料页（由移动宿主声明） */
    mobileInteraction?: boolean
  }>(),
  { mobileInteraction: false }
)
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

type SessionChangedPayload = {
  roomId: string
  oldRoomId: string | null
}

// Store 实例
const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const globalStore = useGlobalStore()
const chatStore = useChatStore()
const userStore = useUserStore()
const networkStatus = useNetworkStatus()
// const { footerHeight } = useChatLayoutGlobal() // 已移除，不再需要
useWindow()
const chatMainContext = useChatMain(false, {
  enableGroupNicknameModal: true,
  activeBubbleEnabled: !props.mobileInteraction,
  avatarClickOpensProfile: props.mobileInteraction
})
provide(chatMainInjectionKey, chatMainContext)
const {
  handleConfirm,
  tips,
  modalShow,
  groupNicknameModalVisible,
  groupNicknameValue,
  groupNicknameError,
  groupNicknameSubmitting,
  handleGroupNicknameConfirm
} = chatMainContext

// Batch preload avatar URLs when message list changes
useAvatarPreloader()

const getMessageSenderUid = (message: MessageType): string => {
  return message.fromUser?.uid ?? ''
}

// ===== 私密模式 =====
const {
  privateModeActive,
  showPrivateConfirm,
  burnEnabled,
  burnDuration,
  privateModeFeatures,
  setRoomId,
  togglePrivateMode,
  confirmPrivateMode,
  cancelPrivateMode
} = usePrivateMode()

// 跟随当前会话切换：私密模式属于单个房间，切房间必须退出，避免状态泄漏到其他会话
watch(
  () => globalStore.currentSessionRoomId,
  (roomId) => void setRoomId(roomId || ''),
  { immediate: true }
)

const burnAfterRead = useBurnAfterRead()
const capability = useServerCapability()

const handleBurnToggle = async (val: boolean) => {
  const roomId = globalStore.currentSessionRoomId
  if (!roomId) return
  const ok = val
    ? await burnAfterRead.enableBurn(roomId, burnDuration.value * 1000)
    : await burnAfterRead.disableBurn(roomId)
  // 服务失败时不更新本地状态，避免开关与实际配置不一致
  if (!ok) {
    showFeedback(t('room.burn.update_failed'), 'error')
    return
  }
  burnEnabled.value = val
}

const handleBurnDurationChange = async (seconds: number) => {
  const roomId = globalStore.currentSessionRoomId
  if (!roomId || !burnEnabled.value) {
    burnDuration.value = seconds
    return
  }
  const previousSeconds = burnDuration.value
  const ok = await burnAfterRead.enableBurn(roomId, seconds * 1000)
  if (!ok) {
    burnDuration.value = previousSeconds
    showFeedback(t('room.burn.update_failed'), 'error')
    return
  }
  burnDuration.value = seconds
}

const onPrivateModeToggleRequest = (payload?: { confirmed: boolean }) => {
  // 服务端不支持阅后即焚时忽略切换请求，避免进入无法工作的私密模式
  if (!capability.canUseBurnAfterRead.value) return
  if (payload?.confirmed) {
    // 移动端已确认，直接进入私密模式（不弹 PC 对话框）
    confirmPrivateMode()
  } else {
    // 退出私密模式或 PC 端切换
    togglePrivateMode()
  }
}

onMounted(() => {
  useMitt.on(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST, onPrivateModeToggleRequest)
})
onUnmounted(() => {
  useMitt.off(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST, onPrivateModeToggleRequest)
})

// ===== 线程面板 + 事件举报 =====
const {
  threadPanelVisible,
  activeThreadId,
  activeThreadRoomId,
  threadOriginalMessage,
  eventReportVisible,
  eventReportData
} = useChatDialogs(getMessageSenderUid)

// ===== 粘性事件（MSC4354 横幅）=====
const stickyFlow = useStickyEvents({ roomId: () => globalStore.currentSessionRoomId ?? null })
const stickyEvents = stickyFlow.events
const canSetSticky = stickyFlow.canSetSticky

/** 消息选择器可见性（横幅「设为粘性事件」按钮触发） */
const pinSelectorVisible = ref(false)

function handleSetSticky() {
  pinSelectorVisible.value = true
}

async function handlePinSelect(eventId: string) {
  const ok = await stickyFlow.setStickyEvent(eventId)
  showFeedback(ok ? t('pinned_message.pin_success') : t('pinned_message.pin_failed'), ok ? 'success' : 'error')
  pinSelectorVisible.value = false
}

async function handleCancelSticky(eventId: string) {
  // 服务端按 (user, event_type) 存储，取消需回查该条记录的 event_type
  const eventType = stickyEvents.value.find((item) => item.eventId === eventId)?.eventType
  if (!eventType) return
  const ok = await stickyFlow.clearStickyEvent(eventType)
  showFeedback(ok ? t('pinned_message.unpin_success') : t('pinned_message.unpin_failed'), ok ? 'success' : 'error')
}

function handleViewStickyEvent(eventId: string) {
  logger.info('View sticky event:', eventId)
  jumpToReplyMsg(eventId)
}

// ===== 设备验证对话框（消息锁徽章 → 验证发送方设备）=====
const { visible: deviceVerifyVisible, target: deviceVerifyTarget, close: closeDeviceVerify } = useDeviceVerifyLauncher()

/** 对话框自行关闭时同步单例状态，避免下次打开残留上一条消息的 userId */
function handleDeviceVerifyShowChange(value: boolean) {
  if (!value) closeDeviceVerify()
}

function handleDeviceVerifySuccess() {
  closeDeviceVerify()
}

defineExpose({
  threadPanelVisible,
  threadOriginalMessage,
  activeThreadId,
  activeThreadRoomId,
  stickyEvents,
  canSetSticky
})

const isGroup = computed<boolean>(() => chatStore.isGroup)
const userUid = computed(() => userStore.userInfo?.uid ?? '')
const currentUserId = computed(() => userStore.userInfo?.uid ?? '')
const currentUserName = computed(() => userStore.userInfo?.name ?? '')
const currentRoomId = computed(() => globalStore.currentSessionRoomId ?? null)

// 房间切换时重新加载粘性事件
watch(
  currentRoomId,
  (newId) => {
    if (newId) {
      stickyFlow.load().catch((e) => logger.error('Failed to load sticky events:', e))
    }
  },
  { immediate: true }
)

// 监听粘性事件变更事件（设置/清除后刷新横幅）
const onStickyEventsChanged = (payload: { roomId?: string } | undefined) => {
  if (payload?.roomId && payload.roomId === currentRoomId.value) {
    stickyFlow.load().catch((e) => logger.error('Failed to refresh sticky events:', e))
  }
}
useMitt.on(MittEnum.STICKY_EVENTS_CHANGED, onStickyEventsChanged)

const networkBanner = computed(() => {
  if (!networkStatus.browserOnline.value && networkStatus.wsOnline.value !== true) {
    return { text: t('home.chat_main.network_offline') }
  }

  if (networkStatus.isWsConnecting.value) {
    return { text: t('home.chat_main.network_connecting') }
  }

  if (networkStatus.wsOnline.value === false) {
    return { text: t('home.chat_main.network_ws_offline') }
  }

  return null
})

const scrollContainerRef = useTemplateRef<HTMLDivElement>('scrollContainer')
const messageListRef = useTemplateRef<HTMLDivElement>('messageListRef')

const isLastPage = computed(() => chatStore.currentMessageOptions?.isLast ?? false)
const isLoading = computed(() => chatStore.currentMessageOptions?.isLoading ?? false)

const scrollManager = useChatScrollManager({
  scrollContainer: scrollContainerRef as Ref<HTMLElement | null>,
  messageListRef: messageListRef as Ref<HTMLElement | null>,
  onLoadMore: () => chatStore.loadMore(),
  isLastPage,
  isLoading,
  currentRoomId,
  clearNewMsgCount: () => chatStore.clearNewMsgCount(),
  newMessageCountSource: computed(() => chatStore.currentNewMsgCount?.count ?? 0)
})

const {
  isLoadingMore,
  loadMoreError,
  retryLoadMore,
  scrollToBottom,
  scrollToIndex,
  scrollToMessage,
  handleScroll: scrollManagerHandleScroll,
  shouldShowFloatButton
} = scrollManager

const handleScroll = (event: Event) => {
  selfEmit('scroll', event)
  scrollManagerHandleScroll(event)
}

const showScrollbar = ref<boolean>(true)

const { stop: stopWheelListener } = useWheelScrollLimiter(scrollContainerRef)

const {
  topAnnouncement,
  isLoading: isAnnouncementLoading,
  initListeners: initAnnouncementListeners,
  cleanupListeners: cleanupAnnouncementListeners
} = useAnnouncementBanner(currentRoomId, isGroup, scrollContainerRef, scrollToBottom)

// Message jump (find, scroll, highlight)
const { activeReply, jumpToReplyMsg, onNavigateToMessage, clearActiveReply } = useMessageJump({
  isLoadingMore,
  scrollToIndex,
  scrollToMessage,
  currentRoomId
})

// New message count badge + float button
const { currentNewMsgCount, newMsgCountLabel, handleFloatButtonClick, floatButtonStyle } = useNewMessageBadge({
  scrollContainerRef,
  isLoadingMore,
  shouldShowFloatButton,
  scrollToBottom,
  userUid
})

// ===== 房间内消息搜索（F2）=====
const searchRoomId = computed(() => globalStore.currentSessionRoomId ?? '')
const {
  isOpen: searchIsOpen,
  query: searchQuery,
  results: searchResults,
  loading: searchLoading,
  error: searchError,
  activeIndex: searchActiveIndex,
  onQueryInput: handleSearchQueryInput,
  openSearch: openRoomSearch,
  closeSearch: closeRoomSearch,
  retry: searchRetry,
  navigateNext: searchNavigateNext,
  navigatePrev: searchNavigatePrev,
  selectResult: searchSelectResult
} = useRoomSearch(searchRoomId)

function handleSearchQueryUpdate(value: string) {
  searchQuery.value = value
}

function handleSearchNavigate(direction: 'next' | 'prev') {
  if (direction === 'next') {
    searchNavigateNext()
  } else {
    searchNavigatePrev()
  }
}

function handleSearchSetActive(index: number) {
  searchActiveIndex.value = index
}

function handleSearchSelectResult(index: number) {
  const result = searchSelectResult(index)
  if (result) {
    closeRoomSearch()
    jumpToReplyMsg(result.eventId)
  }
}

// F2 快捷键打开搜索面板
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'F2' && !searchIsOpen.value) {
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return
    }
    event.preventDefault()
    openRoomSearch()
  }
})

const onOpenRoomSearch = () => {
  openRoomSearch()
}

const handleSessionChanged = async ({ roomId, oldRoomId }: SessionChangedPayload) => {
  if (!roomId || roomId === oldRoomId) {
    return
  }
  audioManager.stopAll()
  if (!isGroup.value) {
    topAnnouncement.value = null
  }
}

// 处理聊天区域点击事件，用于清除回复样式和气泡激活状态
const handleChatAreaClick = (event: Event): void => {
  const target = event.target as Element

  // 检查点击目标是否为回复相关元素
  const isReplyElement =
    target.closest('.reply-bubble') || target.matches('.active-reply') || target.closest('.active-reply')

  // 如果点击的不是回复相关元素，清除activeReply样式
  if (!isReplyElement) {
    clearActiveReply()
  }
}

const handleViewAnnouncement = (): void => {
  nextTick(() => {
    if (!currentRoomId.value) return
    useMitt.emit(MittEnum.OPEN_ANNOUNCEMENT_PANEL, { roomId: currentRoomId.value })
  })
}

onMounted(() => {
  useMitt.on(MittEnum.SESSION_CHANGED, handleSessionChanged)
  useMitt.on(MittEnum.OPEN_ROOM_SEARCH, onOpenRoomSearch)
  useMitt.on(MittEnum.NAVIGATE_TO_MESSAGE, onNavigateToMessage)

  // 初始化公告监听器
  if (appWindow) {
    initAnnouncementListeners(appWindow).catch((e) => logger.error('initAnnouncementListeners failed:', e))
  }

  scrollToBottom()
})

onUnmounted(() => {
  cleanupAnnouncementListeners()
  stopWheelListener()
  timerManager.clearAll()
  useMitt.off(MittEnum.STICKY_EVENTS_CHANGED, onStickyEventsChanged)
  useMitt.off(MittEnum.OPEN_ROOM_SEARCH, onOpenRoomSearch)
  useMitt.off(MittEnum.NAVIGATE_TO_MESSAGE, onNavigateToMessage)
})
</script>

<style scoped lang="scss">
// 原生滚动容器样式
.scrollbar-container {
  flex: 1;
  overflow-y: auto;
  // P3-4 实验性修复：阻止滚动到边界时链式传播到 body（原生滚动条/页面跳动的来源）
  overscroll-behavior: contain;
  // 滚动性能优化
  -webkit-overflow-scrolling: touch;
  will-change: scroll-position;
  transform: translateZ(0);

  /* 滚动条样式 */
  &::-webkit-scrollbar {
    width: 6px;
    transition-property: opacity;
    transition-duration: var(--tjg-motion-duration-overlay);
    transition-timing-function: ease;
  }

  &::-webkit-scrollbar-thumb {
    background-color: color-mix(in srgb, var(--tjg-text-tertiary) 30%, transparent);
    border-radius: 3px;
    transition-property: opacity, background-color;
    transition-duration: var(--tjg-motion-duration-overlay);
    transition-timing-function: ease;
    // min-height: 42px;
    z-index: 999;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: color-mix(in srgb, var(--tjg-text-tertiary) 50%, transparent);
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &.hide-scrollbar {
    &::-webkit-scrollbar {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: transparent;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    // 这里添加一个小的padding，防止mac上会不显示
    padding-right: 0.01px;
  }
}

// 性能优化相关样式
.message-item {
  contain: layout style;
  will-change: auto;
}

// 拖拽时禁用鼠标事件，避免不必要的监听损耗
:global(body.dragging-resize) .scrollbar-container {
  pointer-events: none;
}
</style>
