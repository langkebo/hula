import type { UseResizeObserverReturn } from '@vueuse/core'
import { useDebounceFn, useResizeObserver } from '@vueuse/core'
import { computed, nextTick, onUnmounted, ref, watch, watchPostEffect } from 'vue'
import { ScrollIntentEnum } from '@/enums'
import { useAutoScrollGuard } from '@/hooks/useAutoScrollGuard'

export interface UseChatScrollManagerOptions {
  scrollContainer: Ref<HTMLElement | null>
  messageListRef?: Ref<HTMLElement | null>
  bottomThreshold?: number
  topLoadThreshold?: number
  onLoadMore: () => Promise<void>
  isLastPage: ComputedRef<boolean>
  isLoading: ComputedRef<boolean>
  currentRoomId: ComputedRef<string | null>
  clearNewMsgCount: () => void
  onScrollToBottom?: () => void
  newMessageCountSource?: ComputedRef<number>
}

export interface UseChatScrollManagerReturn {
  isAtBottom: Ref<boolean>
  isLoadingMore: Ref<boolean>
  scrollIntent: Ref<string>
  scrollTop: Ref<number>
  scrollToBottom: () => void
  scrollToMessage: (messageId: string, behavior?: ScrollBehavior) => void
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void
  handleScroll: (event: Event) => void
  handleRoomChange: (newRoomId: string, oldRoomId?: string | null) => void
  handleNewMessage: (isOtherUser: boolean) => void
  loadMore: () => Promise<void>
  shouldShowFloatButton: ComputedRef<boolean>
  newMessageCount: Ref<number>
  showNewMessageTip: Ref<boolean>
  isAutoScrolling: Ref<boolean>
  enableAutoScroll: (duration?: number) => void
  cleanup: () => void
}

export function useChatScrollManager(options: UseChatScrollManagerOptions): UseChatScrollManagerReturn {
  const {
    scrollContainer,
    messageListRef,
    bottomThreshold = 150,
    topLoadThreshold = 60,
    onLoadMore,
    isLastPage,
    isLoading,
    currentRoomId,
    clearNewMsgCount,
    onScrollToBottom,
    newMessageCountSource
  } = options

  const isAtBottom = ref(true)
  const isLoadingMore = ref(false)
  const scrollIntent = ref<ScrollIntentEnum>(ScrollIntentEnum.NONE)
  const scrollTop = ref(0)
  const newMessageCount = ref(0)
  const showNewMessageTip = ref(false)
  const suppressTopLoadMore = ref(false)

  const { isAutoScrolling, enableAutoScroll, stopAutoScrollGuard } = useAutoScrollGuard()

  const effectiveNewMessageCount = newMessageCountSource ?? computed(() => newMessageCount.value)

  let resizeObserverStop: UseResizeObserverReturn | null = null
  let roomWatchStop: (() => void) | null = null
  let intentWatchStop: (() => void) | null = null

  const temporarilySuppressTopLoadMore = () => {
    suppressTopLoadMore.value = true
    setTimeout(() => {
      suppressTopLoadMore.value = false
    }, 32)
  }

  const shouldShowFloatButton = computed(() => {
    const container = scrollContainer.value
    if (!container) return false
    if (isLoadingMore.value) return false

    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight
    const distanceFromBottom = scrollHeight - scrollTop.value - clientHeight

    if (distanceFromBottom <= 20) return false

    if (effectiveNewMessageCount.value > 0) return true

    if (distanceFromBottom > clientHeight * 0.5) return true

    return false
  })

  const scrollToBottom = (): void => {
    temporarilySuppressTopLoadMore()
    const container = scrollContainer.value
    if (!container) return

    clearNewMsgCount()
    isAtBottom.value = true
    enableAutoScroll(500)

    requestAnimationFrame(() => {
      if (!container) return
      container.scrollTop = container.scrollHeight
      onScrollToBottom?.()
    })
  }

  const scrollToMessage = (messageId: string, behavior: ScrollBehavior = 'smooth'): void => {
    const container = scrollContainer.value
    if (!container) return

    const element = container.querySelector(`[data-message-id="${messageId}"]`)
    if (element) {
      element.scrollIntoView({ behavior, block: 'center' })
    }
  }

  const scrollToIndex = (index: number, behavior: ScrollBehavior = 'auto'): void => {
    const container = scrollContainer.value
    if (!container || index < 0) return

    const targetElement = container.querySelector(`[data-message-index="${index}"]`) as HTMLElement | null
    if (targetElement) {
      targetElement.scrollIntoView({ behavior, block: 'center', inline: 'nearest' })
    }
  }

  const handleScrollByIntent = (intent: ScrollIntentEnum): void => {
    const container = scrollContainer.value
    if (!container) return

    switch (intent) {
      case ScrollIntentEnum.INITIAL:
        scrollToBottom()
        break
      case ScrollIntentEnum.NEW_MESSAGE:
        scrollToBottom()
        break
      case ScrollIntentEnum.LOAD_MORE:
        break
    }
  }

  const debouncedScrollOperations = useDebounceFn(async (container: HTMLElement) => {
    const scrollHeight = container.scrollHeight
    const clientHeight = container.clientHeight
    const distanceFromBottom = scrollHeight - scrollTop.value - clientHeight

    if (scrollTop.value < topLoadThreshold) {
      if (suppressTopLoadMore.value || isLoading.value || isLastPage.value) return
      await loadMore()
    }

    if (distanceFromBottom <= 20) {
      clearNewMsgCount()
      if (showNewMessageTip.value) {
        showNewMessageTip.value = false
        newMessageCount.value = 0
      }
    }
  }, 16)

  const handleScroll = (event: Event): void => {
    const container = event.target as HTMLElement
    if (!container) return

    const currentScrollTop = container.scrollTop
    scrollTop.value = currentScrollTop

    if (isAutoScrolling.value) {
      isAtBottom.value = true
    } else {
      const { scrollHeight, clientHeight } = container
      isAtBottom.value = scrollHeight - currentScrollTop - clientHeight <= bottomThreshold
    }

    debouncedScrollOperations(container)
  }

  const loadMore = async (): Promise<void> => {
    if (isLoading.value || isLoadingMore.value || isLastPage.value) return

    const container = scrollContainer.value
    if (!container) return

    scrollIntent.value = ScrollIntentEnum.LOAD_MORE
    isLoadingMore.value = true

    const oldScrollHeight = container.scrollHeight
    const oldScrollTop = container.scrollTop

    try {
      await onLoadMore()

      const newScrollHeight = container.scrollHeight
      const heightDifference = newScrollHeight - oldScrollHeight
      container.scrollTop = oldScrollTop + heightDifference
    } finally {
      isLoadingMore.value = false
      scrollIntent.value = ScrollIntentEnum.NONE
    }
  }

  const handleRoomChange = (newRoomId: string, oldRoomId?: string | null): void => {
    if (!newRoomId || newRoomId === oldRoomId) return

    suppressTopLoadMore.value = true
    isAtBottom.value = true
    enableAutoScroll(1200)
    scrollIntent.value = ScrollIntentEnum.INITIAL

    newMessageCount.value = 0
    showNewMessageTip.value = false
  }

  const handleNewMessage = (isOtherUser: boolean): void => {
    if (isLoadingMore.value) return

    if (isAtBottom.value) {
      nextTick(() => {
        scrollToBottom()
      })
    } else if (isOtherUser) {
      newMessageCount.value++
      showNewMessageTip.value = true
    }
  }

  roomWatchStop = watch(
    () => currentRoomId.value,
    (newRoomId, oldRoomId) => {
      if (newRoomId && newRoomId !== oldRoomId) {
        handleRoomChange(newRoomId, oldRoomId)
      }
    },
    { flush: 'post' }
  )

  intentWatchStop = watchPostEffect(() => {
    if (scrollIntent.value === ScrollIntentEnum.NONE) return
    handleScrollByIntent(scrollIntent.value)
    scrollIntent.value = ScrollIntentEnum.NONE
  })

  if (messageListRef) {
    const stop = useResizeObserver(messageListRef, () => {
      const container = scrollContainer.value
      if (!container) return

      const { scrollHeight, scrollTop, clientHeight } = container
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight

      if (distanceFromBottom <= 150 || isAtBottom.value) {
        nextTick(() => {
          scrollToBottom()
        })
      }
    })
    resizeObserverStop = stop
  }

  const cleanup = () => {
    stopAutoScrollGuard()
    roomWatchStop?.()
    intentWatchStop?.()
    resizeObserverStop?.stop()
  }

  onUnmounted(cleanup)

  return {
    isAtBottom,
    isLoadingMore,
    scrollIntent,
    scrollTop,
    scrollToBottom,
    scrollToMessage,
    scrollToIndex,
    handleScroll,
    handleRoomChange,
    handleNewMessage,
    loadMore,
    shouldShowFloatButton,
    newMessageCount,
    showNewMessageTip,
    isAutoScrolling,
    enableAutoScroll,
    cleanup
  }
}
