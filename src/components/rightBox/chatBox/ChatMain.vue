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

    <!-- 实时帧处理失败：只表达「单帧失败」，连接级问题仍由上面的网络横幅承担 -->
    <div v-if="liveFailure" data-testid="message-live-failure" class="px-3 pt-2">
      <PartialStateBanner
        compact
        :message="liveFailureMessage"
        :detail="liveFailure.reason"
        :retry-text="t('common.retry')"
        @retry="handleRetryLiveFailure" />
    </div>

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
          <ChatLoadMoreIndicator :loading="isLoadingMore" :error="loadMoreIndicatorError" @retry="retryLoadMore" />
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
import { computed, nextTick, onMounted, onUnmounted, provide } from 'vue'
import { useI18n } from 'vue-i18n'
import PartialStateBanner from '@/components/common/PartialStateBanner.vue'
import { useAvatarPreloader } from '@/composables/chat/useAvatarPreloader'
import { useChatDialogs } from '@/composables/chat/useChatDialogs'
import { chatMainInjectionKey, useChatMain } from '@/composables/chat/useChatMain'
import { useChatPrivateModeControls } from '@/composables/chat/useChatPrivateModeControls'
import { useChatRoomSearchPanel } from '@/composables/chat/useChatRoomSearchPanel'
import { useChatStickyBanner } from '@/composables/chat/useChatStickyBanner'
import { useChatViewport } from '@/composables/chat/useChatViewport'
import { useMitt } from '@/composables/common/useMitt'
import { useNetworkStatus } from '@/composables/common/useNetworkStatus'
import { useWindow } from '@/composables/common/useWindow'
import { useDeviceVerifyLauncher } from '@/composables/encryption/useDeviceVerifyLauncher'
import { MittEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
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

type SessionChangedPayload = {
  roomId: string
  oldRoomId: string | null
}

// Store 实例
const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const globalStore = useGlobalStore()
const userStore = useUserStore()
const networkStatus = useNetworkStatus()
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

// ===== 滚动/视口管线（滚动、悬浮按钮、消息跳转、公告横幅）=====
const {
  isGroup,
  currentRoomId,
  isLoadingMore,
  retryLoadMore,
  scrollToBottom,
  shouldShowFloatButton,
  showScrollbar,
  handleScroll,
  liveFailure,
  loadMoreIndicatorError,
  handleRetryLiveFailure,
  stopWheelListener,
  topAnnouncement,
  isAnnouncementLoading,
  initAnnouncementListeners,
  cleanupAnnouncementListeners,
  activeReply,
  jumpToReplyMsg,
  onNavigateToMessage,
  clearActiveReply,
  currentNewMsgCount,
  newMsgCountLabel,
  handleFloatButtonClick,
  floatButtonStyle
} = useChatViewport({ onScroll: (event) => selfEmit('scroll', event) })

/** 实时帧失败按归类给出可行动文案；无法归类时回落通用描述，不猜原因 */
const liveFailureMessage = computed(() => {
  switch (liveFailure.value?.category) {
    case 'network':
      return t('home.chat_main.live_update_failed_network')
    case 'permission':
      return t('home.chat_main.live_update_failed_permission')
    case 'server':
      return t('home.chat_main.live_update_failed_server')
    default:
      return t('home.chat_main.live_update_failed')
  }
})

// ===== 私密模式 / 阅后即焚 =====
const {
  privateModeActive,
  showPrivateConfirm,
  burnEnabled,
  privateModeFeatures,
  togglePrivateMode,
  confirmPrivateMode,
  cancelPrivateMode,
  handleBurnToggle,
  handleBurnDurationChange
} = useChatPrivateModeControls()

// ===== 粘性事件横幅 =====
const {
  stickyEvents,
  canSetSticky,
  pinSelectorVisible,
  handleSetSticky,
  handlePinSelect,
  handleCancelSticky,
  handleViewStickyEvent
} = useChatStickyBanner({ jumpToReplyMsg })

// ===== 线程面板 + 事件举报 =====
const {
  threadPanelVisible,
  activeThreadId,
  activeThreadRoomId,
  threadOriginalMessage,
  eventReportVisible,
  eventReportData
} = useChatDialogs(getMessageSenderUid)

// ===== 房间内消息搜索（F2）=====
const {
  searchIsOpen,
  searchQuery,
  searchResults,
  searchLoading,
  searchError,
  searchActiveIndex,
  handleSearchQueryInput,
  handleSearchQueryUpdate,
  handleSearchNavigate,
  handleSearchSetActive,
  handleSearchSelectResult,
  searchRetry,
  closeRoomSearch
} = useChatRoomSearchPanel({ jumpToReplyMsg })

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
  canSetSticky,
  togglePrivateMode
})

const currentUserId = computed(() => userStore.userInfo?.uid ?? '')
const currentUserName = computed(() => userStore.userInfo?.name ?? '')

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
  useMitt.off(MittEnum.NAVIGATE_TO_MESSAGE, onNavigateToMessage)
})
</script>

<style scoped lang="scss" src="./ChatMain.scss"></style>
