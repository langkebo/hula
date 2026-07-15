<template>
  <div class="flex flex-col overflow-hidden h-full relative">
    <!-- 网络状态提示 -->
    <n-flex
      v-if="networkBanner"
      align="center"
      justify="center"
      class="z-999 w-full h-40px rounded-4px text-[var(--text-sm)] text-[--hula-color-danger-500] bg-[--hula-color-danger-100] flex-shrink-0">
      <svg class="size-16px">
        <use href="#cloudError"></use>
      </svg>
      {{ networkBanner.text }}
    </n-flex>

    <!-- 置顶公告提示 -->
    <Transition name="announcement" mode="out-in">
      <div v-if="announcementStore.isLoading" key="announcement-loading" class="p-[6px_12px_0_12px]">
        <div class="custom-announcement flex items-center justify-center h-40px">
          <n-spin :size="20" />
        </div>
      </div>
      <div v-else-if="isGroup && topAnnouncement" key="announcement" class="p-[6px_12px_0_12px]">
        <div
          class="custom-announcement"
          :class="{ 'announcement-hover': isAnnouncementHover }"
          @mouseenter="isAnnouncementHover = true"
          @mouseleave="isAnnouncementHover = false">
          <n-flex :wrap="false" class="w-full" align="center" justify="space-between">
            <n-flex :wrap="false" align="center" class="pl-12px select-none flex-1" :size="6">
              <svg class="size-16px flex-shrink-0">
                <use href="#Loudspeaker"></use>
              </svg>
              <div class="flex-1 min-w-0 line-clamp-1 text-[var(--text-sm)] text-[--hula-text-tertiary]">
                {{ topAnnouncement.content }}
              </div>
            </n-flex>
            <div class="flex-shrink-0 w-60px select-none" @click="handleViewAnnouncement">
              <p class="text-[var(--text-sm)] text-[--hula-color-primary-500] cursor-pointer">
                {{ t('home.chat_main.announcement.view_all') }}
              </p>
            </div>
          </n-flex>
        </div>
      </div>
    </Transition>

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
        <div ref="messageListRef" role="log" aria-live="polite" class="message-list min-h-full flex flex-col">
          <!-- 没有更多消息提示 -->
          <div
            v-show="isMainViewReady && chatStore.shouldShowNoMoreMessage"
            class="flex-center gap-6px h-32px flex-shrink-0 cursor-default select-none">
            <p class="text-[var(--text-sm)] text-[--hula-text-tertiary]">{{ t('home.chat_main.no_more') }}</p>
          </div>

          <!-- 空状态 -->
          <div
            v-if="isMainViewReady && chatStore.chatMessageList.length === 0"
            class="flex-center flex-col flex-1 gap-16px py-60px select-none">
            <n-icon size="64" color="var(--hula-text-tertiary)">
              <svg><use href="#chat" /></svg>
            </n-icon>
            <n-flex vertical align="center" :size="8">
              <span class="text-[var(--text-base)] text-[--hula-text-secondary]">
                {{ t('home.chat_main.empty_title') }}
              </span>
              <span class="text-[var(--text-sm)] text-[--hula-text-tertiary]">
                {{ t('home.chat_main.empty_desc') }}
              </span>
            </n-flex>
          </div>
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
                  class="text-[var(--text-sm)] text-[--hula-text-tertiary] select-none p-4px"
                  v-if="item.timeBlock"
                  @click.stop>
                  {{ timeToStr(item.message.sendTime) }}
                </span>
                <!-- 消息内容容器 -->
                <div
                  @mouseenter="hoverId = item.message.id"
                  :class="[
                    'w-full box-border',
                    item.message.type === MsgEnum.RECALL ? 'min-h-22px' : 'min-h-62px',
                    isGroup ? 'p-[14px_10px_14px_20px]' : 'chat-single p-[4px_10px_10px_20px]',
                    { 'active-reply': activeReply === item.message.id },
                    { 'bg-[--hula-text-tertiary]20': computeMsgHover(item) }
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
          <n-icon :color="currentNewMsgCount?.count > 99 ? 'var(--color-danger)' : 'var(--color-primary)'">
            <svg>
              <use href="#double-down"></use>
            </svg>
          </n-icon>
          <span
            v-if="currentNewMsgCount?.count && currentNewMsgCount.count > 0"
            class="text-[var(--text-sm)]"
            :class="{ 'color-[--hula-color-danger-500]': currentNewMsgCount?.count > 99 }">
            {{ t('home.chat_main.new_messages', { count: newMsgCountLabel }) }}
          </span>
        </n-flex>
      </div>
    </footer>

    <!-- 文件上传进度条 -->
    <FileUploadProgress />
  </div>

  <!-- 弹出框 -->
  <n-modal v-model:show="modalShow" class="w-350px border-rd-8px">
    <div class="bg-[--hula-surface-panel] w-360px h-full p-6px box-border flex flex-col">
      <div
        v-if="isMac()"
        @click="modalShow = false"
        class="mac-close z-999 size-13px shadow-inner bg-[--hula-color-danger-500] rounded-50% select-none absolute left-6px">
        <svg class="hidden size-7px color-[--hula-surface-media-preview] select-none absolute top-3px left-3px">
          <use href="#close"></use>
        </svg>
      </div>

      <svg v-if="isWindows()" @click="modalShow = false" class="w-12px h-12px ml-a cursor-pointer select-none">
        <use href="#close"></use>
      </svg>
      <div class="flex flex-col gap-30px p-[22px_10px_10px_22px] select-none">
        <span class="text-[var(--text-sm)]">{{ tips }}</span>

        <n-flex justify="end">
          <n-button @click="handleConfirm" class="w-78px" type="primary">
            {{ t('home.chat_main.confirm') }}
          </n-button>
          <n-button @click="modalShow = false" class="w-78px" secondary>{{ t('home.chat_main.cancel') }}</n-button>
        </n-flex>
      </div>
    </div>
  </n-modal>

  <n-modal v-model:show="groupNicknameModalVisible" class="w-360px border-rd-8px" :mask-closable="false">
    <div class="bg-[--hula-surface-panel] w-360px h-full p-6px box-border flex flex-col">
      <div
        v-if="isMac()"
        @click="groupNicknameModalVisible = false"
        class="mac-close z-999 size-13px shadow-inner bg-[--hula-color-danger-500] rounded-50% select-none absolute left-6px">
        <svg class="hidden size-7px color-[--hula-surface-media-preview] select-none absolute top-3px left-3px">
          <use href="#close"></use>
        </svg>
      </div>

      <svg
        v-if="isWindows()"
        @click="groupNicknameModalVisible = false"
        class="w-12px h-12px ml-a cursor-pointer select-none">
        <use href="#close"></use>
      </svg>
      <div class="flex flex-col gap-20px p-[22px_10px_10px_22px] select-none">
        <span class="text-[var(--text-base)] text-[--hula-text-primary] font-500">
          {{ t('home.chat_main.group_nickname.title') }}
        </span>
        <n-input
          v-model:value="groupNicknameValue"
          :placeholder="t('home.chat_main.group_nickname.placeholder')"
          :maxlength="12"
          class="border-(1px solid color-mix(in srgb, var(--hula-text-tertiary) 80%, transparent))"
          :disabled="groupNicknameSubmitting"
          clearable
          @keydown.enter.prevent="handleGroupNicknameConfirm" />
        <p v-if="groupNicknameError" class="text-[var(--text-sm)] text-[--hula-color-danger-500]">
          {{ groupNicknameError }}
        </p>
        <n-flex justify="end" :size="12">
          <n-button @click="groupNicknameModalVisible = false" :disabled="groupNicknameSubmitting" secondary>
            {{ t('home.chat_main.cancel') }}
          </n-button>
          <n-button type="primary" :loading="groupNicknameSubmitting" @click="handleGroupNicknameConfirm">
            {{ t('home.chat_main.confirm') }}
          </n-button>
        </n-flex>
      </div>
    </div>
  </n-modal>

  <!-- 线程面板 -->
  <ThreadPanel
    v-model:show="threadPanelVisible"
    :original-message="threadOriginalMessage ?? undefined"
    :thread-id="activeThreadId" />

  <!-- 事件举报对话框 -->
  <EventReportDialog
    v-model:show="eventReportVisible"
    :event-id="eventReportData.eventId"
    :room-id="eventReportData.roomId"
    :event-content="eventReportData.eventContent" />
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
import { chatMainInjectionKey, useChatMain } from '@/composables/chat/useChatMain'
import { useChatScrollManager } from '@/composables/chat/useChatScrollManager'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MittEnum, MsgEnum } from '@/enums'

// 异步加载非首屏或重型组件
const FileUploadProgress = defineAsyncComponent(() => import('@/components/rightBox/FileUploadProgress.vue'))
const ThreadPanel = defineAsyncComponent(() => import('@/components/thread/ThreadPanel.vue'))
const EventReportDialog = defineAsyncComponent(() => import('@/components/moderation/EventReportDialog.vue'))

import { useMitt } from '@/composables/common/useMitt'
import { useNetworkStatus } from '@/composables/common/useNetworkStatus'
import { usePopover } from '@/composables/common/usePopover'
import { useWindow } from '@/composables/common/useWindow'
import type { Announcement } from '@/stores/domains/chat/announcement'
import { useAnnouncementStore } from '@/stores/domains/chat/announcement'
import type { MessageType } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { audioManager } from '@/utils/AudioManager'
import { timeToStr } from '@/utils/ComputedTime'
import { createLogger } from '@/utils/Logger'
import { isMessageMultiSelectEnabled } from '@/utils/MessageSelect'
import { isMac, isMobile, isWindows } from '@/utils/PlatformConstants'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('ChatMain')
const timerManager = useTimerManager()
const selfEmit = defineEmits(['scroll'])
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

type AnnouncementData = {
  content: string
  top?: boolean
}

type SessionChangedPayload = {
  roomId: string
  oldRoomId: string | null
}

// Store 实例
const announcementStore = useAnnouncementStore()
const appWindow = WebviewWindow.getCurrent()
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
const { enableScroll } = usePopover(selectKey, 'image-chat-main')

const getMessageSenderUid = (message: MessageType): string => {
  return message.fromUser?.uid ?? ''
}

const threadPanelVisible = ref(false)
const activeThreadId = ref('')
const threadOriginalMessage = ref<{
  id: string
  senderId: string
  senderName: string
  senderAvatar: string
  content: string
  timestamp: number
} | null>(null)

defineExpose({ threadPanelVisible, threadOriginalMessage, activeThreadId })

const handleOpenThread = ({ eventId }: { eventId: string; roomId?: string }) => {
  activeThreadId.value = eventId
  const msg = chatStore.chatMessageList.find((m) => m.message.id === eventId)
  if (msg) {
    const bodyContent =
      typeof msg.message.body === 'object' && msg.message.body !== null
        ? (msg.message.body as { content?: string }).content
        : msg.message.body
    threadOriginalMessage.value = {
      id: msg.message.id,
      senderId: getMessageSenderUid(msg),
      senderName: msg.fromUser.username ?? '',
      senderAvatar: msg.fromUser.avatar ?? '',
      content: typeof bodyContent === 'string' ? bodyContent : '',
      timestamp: msg.message.sendTime
    }
  }
  threadPanelVisible.value = true
}

useMitt.on(MittEnum.OPEN_THREAD, handleOpenThread)

// ===== 事件举报对话框 =====
const eventReportVisible = ref(false)
const eventReportData = reactive({
  eventId: '',
  roomId: '',
  eventContent: ''
})

useMitt.on(MittEnum.OPEN_EVENT_REPORT, (payload: unknown) => {
  const data = payload as { roomId: string; eventId: string; eventContent?: string }
  if (data.roomId && data.eventId) {
    eventReportData.eventId = data.eventId
    eventReportData.roomId = data.roomId
    eventReportData.eventContent = data.eventContent || ''
    eventReportVisible.value = true
  }
})

const isMobileRef = ref(isMobile())

provide('popoverControls', { enableScroll })

const isGroup = computed<boolean>(() => chatStore.isGroup)
const userUid = computed(() => userStore.userInfo?.uid ?? '')
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
const isAnnouncementHover = ref<boolean>(false)
const topAnnouncement = ref<AnnouncementData | null>(null)
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

// 监听公告更新和清空事件的变量
let announcementUpdatedListener: UnlistenFn | null = null
let announcementClearListener: UnlistenFn | null = null
// 获取置顶公告
const loadTopAnnouncement = async (roomId?: string): Promise<void> => {
  if (announcementStore.isLoading) return
  const targetRoomId = roomId ?? currentRoomId.value

  if (!targetRoomId || !isGroup.value) {
    topAnnouncement.value = null
    return
  }

  try {
    const data = await announcementStore.getGroupAnnouncementList(targetRoomId, 1, 1)
    if (targetRoomId !== currentRoomId.value) {
      return
    }

    if (data && data.records.length > 0) {
      const topNotice = data.records.find((item: Announcement) => item.top)
      const oldAnnouncement = topAnnouncement.value
      topAnnouncement.value = (topNotice as unknown as AnnouncementData) || null

      if (oldAnnouncement !== topAnnouncement.value) {
        const container = scrollContainerRef.value
        if (container) {
          const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
          if (distanceFromBottom <= 20) {
            nextTick(() => {
              scrollToBottom()
            })
          }
        }
      }
    } else {
      topAnnouncement.value = null
    }
  } catch (error) {
    logger.error('获取置顶公告失败:', error)
    if (targetRoomId === currentRoomId.value) {
      topAnnouncement.value = null
    }
  }
}

watch(
  () => [currentRoomId.value, isGroup.value] as const,
  async ([roomId, isGroupChat], prevValue) => {
    const [prevRoomId, prevIsGroup] = prevValue ?? [undefined, undefined]
    if (!roomId || !isGroupChat) {
      topAnnouncement.value = null
      return
    }

    if (roomId === prevRoomId && prevIsGroup === isGroupChat) {
      return
    }

    await loadTopAnnouncement(roomId)
  },
  { immediate: true }
)

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
  // 初始化监听器
  const initListeners = async () => {
    try {
      // 监听公告更新
      announcementUpdatedListener = await appWindow.listen<{ roomId: string }>('announcementUpdated', async (event) => {
        if (event.payload.roomId === currentRoomId.value) {
          await loadTopAnnouncement()
        }
      })

      // 监听公告清空
      announcementClearListener = await appWindow.listen<{ roomId: string }>('announcementClear', async (event) => {
        if (event.payload.roomId === currentRoomId.value) {
          topAnnouncement.value = null
        }
      })
    } catch (error) {
      logger.error('Failed to initialize listeners:', error)
    }
  }

  // 异步初始化监听器（不等待结果）
  initListeners().catch((e) => logger.error('initListeners failed:', e))

  scrollToBottom()
})

onUnmounted(() => {
  if (announcementUpdatedListener) {
    announcementUpdatedListener()
  }
  if (announcementClearListener) {
    announcementClearListener()
  }
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
  color: var(--hula-color-primary-500);
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
    background-color: color-mix(in srgb, var(--hula-text-tertiary) 30%, transparent);
    border-radius: 3px;
    transition-property: opacity, background-color;
    transition-duration: 0.3s;
    transition-timing-function: ease;
    // min-height: 42px;
    z-index: 999;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: color-mix(in srgb, var(--hula-text-tertiary) 50%, transparent);
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
    color-mix(in srgb, var(--hula-surface-panel) 88%, var(--hula-text-tertiary) 12%) 0%,
    color-mix(in srgb, var(--hula-surface-panel) 78%, var(--hula-text-tertiary) 22%) 50%,
    color-mix(in srgb, var(--hula-surface-panel) 88%, var(--hula-text-tertiary) 12%) 100%
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
</style>
