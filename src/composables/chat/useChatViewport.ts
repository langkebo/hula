import { computed, type Ref, ref, useTemplateRef } from 'vue'
import { useAnnouncementBanner } from '@/composables/chat/useAnnouncementBanner'
import { useChatScrollManager } from '@/composables/chat/useChatScrollManager'
import { useMessageJump } from '@/composables/chat/useMessageJump'
import { useNewMessageBadge } from '@/composables/chat/useNewMessageBadge'
import { useWheelScrollLimiter } from '@/composables/chat/useWheelScrollLimiter'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'

interface UseChatViewportOptions {
  /** 滚动事件透传给宿主（宿主再 emit 给父级） */
  onScroll: (event: Event) => void
}

/**
 * 会话主视口的滚动管线。
 *
 * 组合滚动管理、未读徽标与悬浮按钮、消息跳转、实时帧失败的重试入口、
 * 公告横幅以及滚轮限速；宿主只负责状态展示与少量会话级事件。
 */
export function useChatViewport(options: UseChatViewportOptions) {
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()
  const userStore = useUserStore()

  const isGroup = computed<boolean>(() => chatStore.isGroup)
  const currentRoomId = computed(() => globalStore.currentSessionRoomId ?? null)
  const userUid = computed(() => userStore.userInfo?.uid ?? '')

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
    options.onScroll(event)
    scrollManagerHandleScroll(event)
  }

  const showScrollbar = ref<boolean>(true)

  // 首屏失败已由 ChatMessageList 渲染整块错误态，此时再叠一条「实时帧失败」横幅是重复打扰
  const initialLoadFailed = computed(() => chatStore.currentMessageOptions?.loadFailed?.scope === 'initial')
  const liveFailure = computed(() =>
    initialLoadFailed.value ? null : (chatStore.currentMessageOptions?.liveFailed ?? null)
  )
  // 跳转定位等非滚动路径也会写 loadFailed(scope='history')，这里把它并入翻页失败入口，
  // 使「失败」不只表现为一次 toast，而是持久的可重试提示。
  const loadMoreIndicatorError = computed(
    () => loadMoreError.value || chatStore.currentMessageOptions?.loadFailed?.scope === 'history'
  )

  const handleRetryLiveFailure = () => {
    void chatStore.fetchCurrentRoomRemoteOnce()
  }

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

  return {
    isGroup,
    currentRoomId,
    scrollContainerRef,
    messageListRef,
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
  }
}
