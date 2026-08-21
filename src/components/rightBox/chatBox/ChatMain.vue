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
      :active-index="searchActiveIndex"
      @update:query="handleSearchQueryUpdate"
      @query-input="handleSearchQueryInput"
      @select-result="handleSearchSelectResult"
      @navigate="handleSearchNavigate"
      @set-active="handleSearchSetActive"
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
          <ChatMessageList
            :is-group="isGroup"
            :private-mode-active="privateModeActive"
            :active-reply="activeReply"
            @jump-to-reply="jumpToReplyMsg" />
        </div>
      </div>
    </div>

    <!--  悬浮按钮提示(底部悬浮) -->
    <footer
      class="float-footer-button"
      v-if="shouldShowFloatButton && currentNewMsgCount && !isMobileRef"
      :style="{ bottom: '24px', right: '50px' }">
      <div class="float-box" :class="{ max: currentNewMsgCount?.count > 99 }" @click="handleFloatButtonClick">
        <n-flex justify="space-between" align="center">
          <n-icon
            :color="currentNewMsgCount?.count > 99 ? 'var(--tjg-color-danger-500)' : 'var(--tjg-color-primary-500)'">
            <svg>
              <use href="#double-down"></use>
            </svg>
          </n-icon>
          <span
            v-if="currentNewMsgCount?.count && currentNewMsgCount.count > 0"
            class="text-[var(--text-sm)]"
            :class="{ 'color-[--tjg-color-danger-500]': currentNewMsgCount?.count > 99 }">
            {{ t('home.chat_main.new_messages', { count: newMsgCountLabel }) }}
          </span>
        </n-flex>
      </div>
    </footer>

    <!-- 文件上传进度条 -->
    <FileUploadProgress />

    <!-- 阅后即焚切换（私密模式激活时） -->
    <div
      v-if="privateModeActive"
      class="flex-shrink-0 px-12px py-4px flex items-center gap-8px border-t border-[--tjg-border-default]">
      <BurnAfterReadToggle
        :enabled="burnEnabled"
        @update:enabled="handleBurnToggle"
        @select-duration="handleBurnDurationChange" />
      <span class="text-[var(--text-sm)] text-[--tjg-text-tertiary]">
        {{ burnEnabled ? t('editor.burn_after_read_enabled') : t('editor.burn_after_read_disabled') }}
      </span>
    </div>
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
    :event-report-data="eventReportData"
    :private-mode-features="privateModeFeatures"
    @confirm="handleConfirm"
    @group-nickname-confirm="handleGroupNicknameConfirm"
    @cancel-private-mode="cancelPrivateMode"
    @confirm-private-mode="confirmPrivateMode" />

  <PinMessageSelector v-model:show="pinSelectorVisible" @select="handlePinSelect" />
</template>

<script setup lang="ts">
import type { UnlistenFn } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useEventListener } from '@vueuse/core'
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  type Ref,
  reactive,
  ref,
  useTemplateRef,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'
import BurnAfterReadToggle from '@/components/burn/BurnAfterReadToggle.vue'
import { type AnnouncementData, useAnnouncementBanner } from '@/composables/chat/useAnnouncementBanner'
import { useAvatarPreloader } from '@/composables/chat/useAvatarPreloader'
import { useChatDialogs } from '@/composables/chat/useChatDialogs'
import { chatMainInjectionKey, useChatMain } from '@/composables/chat/useChatMain'
import { useChatScrollManager } from '@/composables/chat/useChatScrollManager'
import { useMessageJump } from '@/composables/chat/useMessageJump'
import { useNewMessageBadge } from '@/composables/chat/useNewMessageBadge'
import { usePrivateMode } from '@/composables/chat/usePrivateMode'
import { useRoomSearch } from '@/composables/chat/useRoomSearch'
import { useWheelScrollLimiter } from '@/composables/chat/useWheelScrollLimiter'
import { useMitt } from '@/composables/common/useMitt'
import { useNetworkStatus } from '@/composables/common/useNetworkStatus'
import { useWindow } from '@/composables/common/useWindow'
import { usePinnedMessage } from '@/composables/room/usePinnedMessage'
import { useBurnAfterRead } from '@/composables/useBurnAfterRead'
import { MittEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { audioManager } from '@/utils/AudioManager'
import { createLogger } from '@/utils/Logger'
import { isMobile } from '@/utils/PlatformConstants'
import { useTimerManager } from '@/utils/TimerManager'
import ChatBanners from './ChatBanners.vue'
import ChatMessageList from './ChatMessageList.vue'
import ChatModals from './ChatModals.vue'
import ChatRoomSearch from './ChatRoomSearch.vue'
import PinMessageSelector from './PinMessageSelector.vue'

const FileUploadProgress = defineAsyncComponent(() => import('@/components/rightBox/FileUploadProgress.vue'))

const logger = createLogger('ChatMain')
const timerManager = useTimerManager()
const selfEmit = defineEmits(['scroll'])
const { t } = useI18n()

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
const { createWebviewWindow } = useWindow()
const chatMainContext = useChatMain(false, { enableGroupNicknameModal: true })
provide(chatMainInjectionKey, chatMainContext)
const {
  handleConfirm,
  tips,
  modalShow,
  selectKey,
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
  togglePrivateMode,
  confirmPrivateMode,
  cancelPrivateMode
} = usePrivateMode()

const burnAfterRead = useBurnAfterRead()

const handleBurnToggle = async (val: boolean) => {
  const roomId = globalStore.currentSessionRoomId
  if (!roomId) return
  try {
    if (val) {
      await burnAfterRead.enableBurn(roomId, burnDuration.value * 1000)
      burnEnabled.value = true
    } else {
      await burnAfterRead.disableBurn(roomId)
      burnEnabled.value = false
    }
  } catch {
    // 服务失败时不更新本地状态
  }
}

const handleBurnDurationChange = async (seconds: number) => {
  burnDuration.value = seconds
  const roomId = globalStore.currentSessionRoomId
  if (!roomId || !burnEnabled.value) return
  try {
    await burnAfterRead.enableBurn(roomId, seconds * 1000)
  } catch {
    // ignore
  }
}

const onPrivateModeToggleRequest = (payload?: { confirmed: boolean }) => {
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
const { threadPanelVisible, activeThreadId, threadOriginalMessage, eventReportVisible, eventReportData } =
  useChatDialogs(getMessageSenderUid)

// ===== 粘性事件（置顶消息横幅）=====
const pinnedMessageFlow = usePinnedMessage({ roomId: () => globalStore.currentSessionRoomId ?? null })
const stickyEvents = pinnedMessageFlow.pinnedMessages
const canSetSticky = pinnedMessageFlow.canSetSticky

/** 置顶消息选择器可见性（横幅「设为粘性事件」按钮触发） */
const pinSelectorVisible = ref(false)

function handleSetSticky() {
  pinSelectorVisible.value = true
}

async function handlePinSelect(eventId: string) {
  await pinnedMessageFlow.pin(eventId)
  pinSelectorVisible.value = false
}

async function handleCancelSticky(eventId: string) {
  await pinnedMessageFlow.unpin(eventId)
}

function handleViewStickyEvent(eventId: string) {
  logger.info('View sticky event:', eventId)
  jumpToReplyMsg(eventId)
}

defineExpose({ threadPanelVisible, threadOriginalMessage, activeThreadId, stickyEvents, canSetSticky })

const isMobileRef = ref(isMobile())

const isGroup = computed<boolean>(() => chatStore.isGroup)
const userUid = computed(() => userStore.userInfo?.uid ?? '')
const currentUserId = computed(() => userStore.userInfo?.uid ?? '')
const currentUserName = computed(() => userStore.userInfo?.name ?? '')
const currentRoomId = computed(() => globalStore.currentSessionRoomId ?? null)

// 房间切换时重新加载置顶消息
watch(
  currentRoomId,
  (newId) => {
    if (newId) {
      pinnedMessageFlow.load().catch((e) => logger.error('加载置顶消息失败:', e))
    }
  },
  { immediate: true }
)

// 监听置顶消息变更事件（来自消息右键菜单的 pin/unpin）
const onPinnedEventsChanged = (payload: { roomId?: string } | undefined) => {
  if (payload?.roomId && payload.roomId === currentRoomId.value) {
    pinnedMessageFlow.load().catch((e) => logger.error('刷新置顶消息失败:', e))
  }
}
useMitt.on(MittEnum.PINNED_EVENTS_CHANGED, onPinnedEventsChanged)
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
  scrollContainer: scrollContainerRef as unknown as Ref<HTMLElement | null>,
  messageListRef: messageListRef as unknown as Ref<HTMLElement | null>,
  onLoadMore: () => chatStore.loadMore(),
  isLastPage,
  isLoading,
  currentRoomId,
  clearNewMsgCount: () => chatStore.clearNewMsgCount(),
  newMessageCountSource: computed(() => chatStore.currentNewMsgCount?.count ?? 0)
})

const {
  isAtBottom,
  isLoadingMore,
  scrollTop,
  scrollToBottom,
  scrollToIndex,
  handleScroll: scrollManagerHandleScroll,
  loadMore,
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
  currentRoomId
})

// New message count badge + float button
const { currentNewMsgCount, newMsgCountLabel, handleFloatButtonClick } = useNewMessageBadge({
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
  activeIndex: searchActiveIndex,
  onQueryInput: handleSearchQueryInput,
  openSearch: openRoomSearch,
  closeSearch: closeRoomSearch,
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
  useMitt.off(MittEnum.PINNED_EVENTS_CHANGED, onPinnedEventsChanged)
  useMitt.off(MittEnum.OPEN_ROOM_SEARCH, onOpenRoomSearch)
  useMitt.off(MittEnum.NAVIGATE_TO_MESSAGE, onNavigateToMessage)
})
</script>

<style scoped lang="scss">
// 悬浮按钮样式
.float-footer-button {
  position: absolute;
  z-index: 10;
  width: fit-content;
  user-select: none;
  color: var(--tjg-color-primary-500);
  cursor: pointer;
}

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
