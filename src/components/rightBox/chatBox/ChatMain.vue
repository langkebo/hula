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
      @toggle-private-mode="togglePrivateMode"
      @view-announcement="handleViewAnnouncement"
      @set-sticky="handleSetSticky"
      @view-sticky-event="handleViewStickyEvent" />

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
          <!-- 没有更多消息提示 -->
          <div
            v-show="isMainViewReady && chatStore.shouldShowNoMoreMessage"
            class="flex-center gap-6px h-32px flex-shrink-0 cursor-default select-none">
            <p class="text-[var(--text-sm)] text-[--tjg-text-tertiary]">{{ t('home.chat_main.no_more') }}</p>
          </div>

          <!-- 空状态 -->
          <EmptyState
            v-if="isMainViewReady && chatStore.chatMessageList.length === 0"
            illustration="no-conversations"
            :title="t('home.chat_main.empty_title')"
            :description="t('home.chat_main.empty_desc')"
            class="flex-1 py-60px" />
          <DynamicScroller
            v-if="isMainViewReady"
            class="scroller flex-1"
            :items="chatStore.chatMessageList"
            :min-item-size="40"
            :buffer="10"
            key-field="clientKey"
            v-slot="{ item, index, active }">
            <DynamicScrollerItem
              :item="item"
              :active="active"
              :size-dependencies="[
                item.message.body,
                item.message.msgtype,
                item.message.content?.info?.h?._,
                item.message.content?.file?._,
                item.replyEvent
              ]"
              :data-index="index">
              <n-flex
                vertical
                class="flex-y-center mb-12px"
                :data-message-id="item.message.id"
                :data-message-index="index">
                <!-- 信息间隔时间 -->
                <span
                  class="text-[var(--text-sm)] text-[--tjg-text-tertiary] select-none p-4px"
                  v-if="item.timeBlock"
                  @click.stop>
                  {{ formatChatTime(item.message.sendTime) }}
                </span>
                <!-- 消息内容容器 -->
                <div
                  @mouseenter="hoverId = item.message.id"
                  :class="[
                    'w-full box-border message-row',
                    item.message.type === MsgEnum.RECALL ? 'min-h-22px' : 'min-h-62px',
                    isGroup ? 'p-[14px_10px_14px_20px]' : 'chat-single p-[4px_10px_10px_20px]',
                    { 'active-reply': activeReply === item.message.id },
                    { 'message-row--multi-select': computeMsgHover(item) },
                    { 'message-row--hoverable': !chatStore.isMsgMultiChoose }
                  ]"
                  @click="
                    () => {
                      if (chatStore.isMsgMultiChoose && isMessageMultiSelectEnabled(item.message.type)) {
                        item.isCheck = !item.isCheck
                      }
                    }
                  ">
                  <RenderMessage
                    :message="item"
                    :is-group="isGroup"
                    :from-user="{ uid: getMessageSenderUid(item) }"
                    :upload-progress="item.uploadProgress"
                    @jump2-reply="jumpToReplyMsg" />
                </div>
              </n-flex>
            </DynamicScrollerItem>
          </DynamicScroller>
          <div v-else class="message-list-placeholder">
            <div class="message-skeleton message-skeleton--left"></div>
            <div class="message-skeleton message-skeleton--right"></div>
            <div class="message-skeleton message-skeleton--left message-skeleton--short"></div>
          </div>
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
          <n-icon :color="currentNewMsgCount?.count > 99 ? 'var(--color-danger)' : 'var(--tjg-color-primary-500)'">
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
        @update:enabled="burnEnabled = $event"
        @select-duration="burnDuration = $event" />
      <span class="text-[var(--text-sm)] text-[--tjg-text-tertiary]">
        {{ burnEnabled ? `阅后即焚已开启` : '点击图标开启阅后即焚' }}
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
</template>

<script setup lang="ts">
import type { UnlistenFn } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useEventListener, useTimeoutFn } from '@vueuse/core'
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
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import BurnAfterReadToggle from '@/components/burn/BurnAfterReadToggle.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { type AnnouncementData, useAnnouncementBanner } from '@/composables/chat/useAnnouncementBanner'
import { useChatDialogs } from '@/composables/chat/useChatDialogs'
import { chatMainInjectionKey, useChatMain } from '@/composables/chat/useChatMain'
import { useChatScrollManager } from '@/composables/chat/useChatScrollManager'
import { usePrivateMode } from '@/composables/chat/usePrivateMode'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { useNetworkStatus } from '@/composables/common/useNetworkStatus'
import { usePopover } from '@/composables/common/usePopover'
import { useWindow } from '@/composables/common/useWindow'
import { MittEnum, MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { audioManager } from '@/utils/AudioManager'
import { formatChatTime } from '@/utils/ComputedTime'
import { createLogger } from '@/utils/Logger'
import { isMessageMultiSelectEnabled } from '@/utils/MessageSelect'
import { isMobile } from '@/utils/PlatformConstants'
import { useTimerManager } from '@/utils/TimerManager'
import ChatBanners from './ChatBanners.vue'
import ChatModals from './ChatModals.vue'

const FileUploadProgress = defineAsyncComponent(() => import('@/components/rightBox/FileUploadProgress.vue'))

const logger = createLogger('ChatMain')
const timerManager = useTimerManager()
const selfEmit = defineEmits(['scroll'])
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
const groupStore = useGroupStore()
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
const { enableScroll } = usePopover(selectKey, 'image-chat-main')

const getMessageSenderUid = (message: MessageType): string => {
  return message.fromUser?.uid ?? ''
}

// Batch preload avatar URLs when message list changes to avoid lazy-load waterfall
watch(
  () => chatStore.chatMessageList,
  (msgs) => {
    if (!msgs?.length) return
    const avatarUrls = new Set<string>()
    for (const item of msgs) {
      const uid = item?.message?.fromUser?.uid ?? ''
      if (!uid) continue
      const storeUser = groupStore.getUserInfo(uid)
      const avatar = storeUser?.avatar || item?.message?.fromUser?.avatar
      if (avatar) avatarUrls.add(avatar)
    }
    if (avatarUrls.size > 0) {
      AvatarUtils.batchResolve([...avatarUrls], 68)
    }
  },
  { immediate: true }
)

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

// ===== 粘性事件 =====
interface StickyEventItem {
  eventId: string
  sender: string
  body: string
  timestamp: number
}

const stickyEvents = ref<StickyEventItem[]>([])
const canSetSticky = computed(() => {
  // TODO: 根据 power_levels 判断是否有权限设置粘性事件
  return false
})

function handleSetSticky() {
  // TODO: 打开消息选择器或使用最近选中消息
  logger.info('Set sticky event requested')
}

function handleViewStickyEvent(eventId: string) {
  // 滚动到对应消息
  logger.info('View sticky event:', eventId)
  jumpToReplyMsg(eventId)
}

defineExpose({ threadPanelVisible, threadOriginalMessage, activeThreadId, stickyEvents, canSetSticky })

const isMobileRef = ref(isMobile())

provide('popoverControls', { enableScroll })

const isGroup = computed<boolean>(() => chatStore.isGroup)
const userUid = computed(() => userStore.userInfo?.uid ?? '')
const currentUserId = computed(() => userStore.userInfo?.uid ?? '')
const currentUserName = computed(() => userStore.userInfo?.name ?? '')
const currentNewMsgCount = computed(() => chatStore.currentNewMsgCount || null)
const newMsgCountLabel = computed(() => {
  if (!currentNewMsgCount.value?.count || currentNewMsgCount.value.count <= 0) return '0'
  return currentNewMsgCount.value.count > 99 ? '99+' : String(currentNewMsgCount.value.count)
})
const currentRoomId = computed(() => globalStore.currentSessionRoomId ?? null)
const isMainViewReady = computed(() => {
  if (!currentRoomId.value) {
    return false
  }

  const currentSessionInfo = chatStore.currentSessionInfo
  const hasSessionBound = currentSessionInfo?.roomId === currentRoomId.value
  const hasLoadedCurrentRoom = chatStore.currentMessageOptions?.hasLoadedOnce === true

  return hasSessionBound && hasLoadedCurrentRoom
})
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
const computeMsgHover = computed(() => (item: MessageType) => {
  if (!chatStore.isMsgMultiChoose || !isMessageMultiSelectEnabled(item.message.type)) {
    return false
  }

  if (chatStore.msgMultiChooseMode === 'forward') {
    return false
  }

  return hoverId.value === item.message.id || item.isCheck
})

const scrollContainerRef = useTemplateRef<HTMLDivElement>('scrollContainer')
const messageListRef = useTemplateRef<HTMLDivElement>('messageListRef')

const storeNewMsgCount = computed(() => chatStore.currentNewMsgCount?.count ?? 0)
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
  newMessageCountSource: storeNewMsgCount
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

const activeReply = ref<string>('')
const showScrollbar = ref<boolean>(true)
const hoverId = ref('')

// 滚轮滚动限制状态
const MAX_WHEEL_DELTA = 130
const DOM_DELTA_LINE = 1
const DOM_DELTA_PAGE = 2

const clampWheelDelta = (delta: number): number => {
  if (Math.abs(delta) <= MAX_WHEEL_DELTA) {
    return delta
  }
  return Math.sign(delta) * MAX_WHEEL_DELTA
}

const normalizeWheelDelta = (event: WheelEvent, target: HTMLElement): number => {
  switch (event.deltaMode) {
    case DOM_DELTA_LINE:
      return event.deltaY * 16
    case DOM_DELTA_PAGE:
      return event.deltaY * target.clientHeight
    default:
      return event.deltaY
  }
}

const handleWheel = (event: WheelEvent) => {
  const container = scrollContainerRef.value
  if (!container) return

  // 跳过触控板缩放或横向滚动
  if (event.ctrlKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) {
    return
  }

  const normalizedDelta = normalizeWheelDelta(event, container)
  if (Math.abs(normalizedDelta) < 0.5) {
    return
  }

  event.preventDefault()
  const limitedDelta = clampWheelDelta(normalizedDelta)
  if (Math.abs(limitedDelta) < 0.5) {
    return
  }
  container.scrollTop += limitedDelta
}

const stopWheelListener = useEventListener(scrollContainerRef, 'wheel', handleWheel, { passive: false })

const {
  topAnnouncement,
  isLoading: isAnnouncementLoading,
  initListeners: initAnnouncementListeners,
  cleanupListeners: cleanupAnnouncementListeners
} = useAnnouncementBanner(currentRoomId, isGroup, scrollContainerRef, scrollToBottom)

const jumpToReplyMsg = async (key: string): Promise<void> => {
  // 先在当前列表中尝试查找
  let messageIndex = chatStore.getMsgIndex(String(key))

  // 如果找到了，直接滚动到该消息
  if (messageIndex !== -1) {
    scrollToIndex(messageIndex, 'instant')
    activeReply.value = String(key)
    return
  }

  // 设置加载标记
  isLoadingMore.value = true

  // 显示加载状态
  showFeedback('正在查找消息...', 'info')

  // 尝试加载历史消息直到找到目标消息或无法再加载
  let foundMessage = false
  let attemptCount = 0
  const MAX_ATTEMPTS = 5 // 设置最大尝试次数，避免无限循环

  while (!foundMessage && attemptCount < MAX_ATTEMPTS) {
    attemptCount++

    // 加载更多历史消息
    await chatStore.loadMore()

    // 在新加载的消息中查找
    messageIndex = chatStore.getMsgIndex(key)

    if (messageIndex !== -1) {
      foundMessage = true
      break
    }

    // 简单延时，避免快速请求
    await new Promise<void>((resolve) => {
      timerManager.setTimeout(() => resolve(), 300)
    })
  }

  // 重置加载标记
  isLoadingMore.value = false

  // 如果找到了消息，滚动到该位置
  if (foundMessage) {
    nextTick(() => {
      scrollToIndex(messageIndex, 'instant')
      activeReply.value = key
    })
  } else {
    // 如果尝试多次后仍未找到消息
    showFeedback('无法找到原始消息，可能已被删除或太久远', 'warning')
  }
}

const handleFloatButtonClick = async () => {
  try {
    // 只有消息数量超过60条才进行重置和刷新
    if (chatStore.chatMessageList.length > 60) {
      await chatStore.resetAndRefreshCurrentRoomMessages()
    }
    scrollToBottom()
  } catch (error) {
    logger.error('重置消息列表失败:', error)
    scrollToBottom()
  }
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

// 监听消息列表变化
watch(
  () => chatStore.chatMessageList,
  async (value, oldValue) => {
    if (value.length > oldValue.length) {
      const latestMessage = value[value.length - 1]

      if (isLoadingMore.value) {
        return
      }

      const container = scrollContainerRef.value
      if (container) {
        const isOtherUserMessage =
          latestMessage?.fromUser?.uid && String(latestMessage.fromUser.uid) !== String(userUid.value)
        if (shouldShowFloatButton.value && isOtherUserMessage) {
          const roomId = globalStore.currentSessionRoomId
          const current = chatStore.newMsgCount[roomId]
          if (!current) {
            chatStore.newMsgCount[roomId] = {
              count: 1,
              isStart: true
            }
          } else {
            current.count++
          }
        } else {
          await nextTick()
          scrollToBottom()
        }
      }
    }
  },
  { deep: false }
)

// 处理聊天区域点击事件，用于清除回复样式和气泡激活状态
const handleChatAreaClick = (event: Event): void => {
  const target = event.target as Element

  // 检查点击目标是否为回复相关元素
  const isReplyElement =
    target.closest('.reply-bubble') || target.matches('.active-reply') || target.closest('.active-reply')

  // 如果点击的不是回复相关元素，清除activeReply样式
  if (!isReplyElement && activeReply.value) {
    nextTick(() => {
      const activeReplyElement = document.querySelector('.active-reply') as HTMLElement
      if (activeReplyElement) {
        activeReplyElement.classList.add('reply-exit')
        useTimeoutFn(() => {
          activeReplyElement.classList.remove('reply-exit')
          activeReply.value = ''
        }, 300)
      }
    })
  }
}

const handleViewAnnouncement = (): void => {
  nextTick(() => {
    if (!currentRoomId.value) return
    useMitt.emit(MittEnum.OPEN_ANNOUNCEMENT_PANEL, { roomId: currentRoomId.value })
  })
}

// 监听滚动到底部的事件
let scrollBottomScheduled = false
useMitt.on(MittEnum.CHAT_SCROLL_BOTTOM, () => {
  if (scrollBottomScheduled) return
  scrollBottomScheduled = true
  requestAnimationFrame(() => {
    scrollBottomScheduled = false
    // 只有消息数量超过60条才进行重置和刷新
    if (chatStore.chatMessageList.length > 60) {
      chatStore.clearRedundantMessages(globalStore.currentSessionRoomId)
    }
    scrollToBottom()
  })
})

onMounted(() => {
  useMitt.on(MittEnum.SESSION_CHANGED, handleSessionChanged)
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
  // 滚动性能优化
  -webkit-overflow-scrolling: touch;
  will-change: scroll-position;
  transform: translateZ(0);

  /* 滚动条样式 */
  &::-webkit-scrollbar {
    width: 6px;
    transition-property: opacity;
    transition-duration: 0.3s;
    transition-timing-function: ease;
  }

  &::-webkit-scrollbar-thumb {
    background-color: color-mix(in srgb, var(--tjg-text-tertiary) 30%, transparent);
    border-radius: 3px;
    transition-property: opacity, background-color;
    transition-duration: 0.3s;
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

// Discord 式消息行 hover 高亮（需求文档 6.5 节）
.message-row {
  transition: background-color 0.1s ease;
  border-radius: 4px;
}

.message-row--hoverable:hover:not(.active-reply):not(.message-row--multi-select) {
  background: color-mix(in srgb, var(--tjg-text-primary) 4%, transparent);
}

.message-row--multi-select {
  background: color-mix(in srgb, var(--tjg-text-tertiary) 20%, transparent);
}

.message-list-placeholder {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 20px 28px;
}

.message-skeleton {
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--tjg-surface-panel) 88%, var(--tjg-text-tertiary) 12%) 0%,
    color-mix(in srgb, var(--tjg-surface-panel) 78%, var(--tjg-text-tertiary) 22%) 50%,
    color-mix(in srgb, var(--tjg-surface-panel) 88%, var(--tjg-text-tertiary) 12%) 100%
  );
  background-size: 200% 100%;
  animation: chat-skeleton-shimmer 1.2s ease-in-out infinite;
}

.message-skeleton--left {
  width: min(320px, 78%);
}

.message-skeleton--right {
  width: min(260px, 64%);
  margin-left: auto;
}

.message-skeleton--short {
  width: min(200px, 52%);
}

@keyframes chat-skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }

  100% {
    background-position: -200% 0;
  }
}

// 拖拽时禁用鼠标事件，避免不必要的监听损耗
:global(body.dragging-resize) .scrollbar-container {
  pointer-events: none;
}

// 私密模式样式
.private-mode-active {
  .message-row {
    border-left: 2px solid var(--tjg-color-danger-500);
  }
}
</style>
