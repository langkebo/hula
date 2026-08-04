<template>
  <div class="message-container flex flex-col h-full overflow-hidden">
    <div
      ref="scrollContainerRef"
      class="message-scroll-container flex-1 overflow-y-auto overflow-x-hidden"
      @scroll="handleScrollEvent">
      <div ref="contentRef" class="message-list-wrapper">
        <slot name="header"></slot>

        <div v-if="showNoMore && !loading" class="no-more-tip">
          <span>{{ noMoreText || t('message_container.no_more') }}</span>
        </div>

        <div v-if="loading && !hasData" class="loading-container">
          <van-loading size="24px">{{ t('message_container.loading') }}</van-loading>
        </div>

        <div v-else class="message-content">
          <div
            v-for="(item, index) in messages"
            :key="getMessageKey(item, index)"
            :data-index="index"
            :data-message-id="getMessageId(item)"
            class="message-item">
            <slot
              name="item"
              :item="item"
              :index="index"
              :is-first="index === 0"
              :is-last="index === messages.length - 1"></slot>
          </div>
        </div>

        <slot name="footer"></slot>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="showNewMessageTip" class="new-message-tip" @click="scrollToBottom()">
        <van-icon name="arrow-down" />
        <span>{{ newMessageCount > 99 ? '99+' : newMessageCount }}{{ t('message_container.new_messages') }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useChatScrollManager } from '@/composables/chat/useChatScrollManager'

const { t } = useI18n()

interface MessageItem {
  id?: string
  message?: { id?: string }
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    messages: MessageItem[]
    loading?: boolean
    hasMore?: boolean
    showNoMore?: boolean
    noMoreText?: string
    estimatedItemHeight?: number
    scrollBehavior?: ScrollBehavior
    currentRoomId?: string | null
  }>(),
  {
    messages: () => [],
    loading: false,
    hasMore: true,
    showNoMore: false,
    noMoreText: '',
    estimatedItemHeight: 80,
    scrollBehavior: 'smooth',
    currentRoomId: null
  }
)

const emit = defineEmits<{
  loadMore: []
  scroll: [event: Event]
  scrollToEnd: []
  visibleChange: [visible: boolean]
}>()

const scrollContainerRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
let visibilityObserver: IntersectionObserver | null = null

const hasData = computed(() => props.messages.length > 0)

function getMessageKey(item: MessageItem, index: number): string {
  return item.id || item.message?.id || `msg-${index}`
}

function getMessageId(item: MessageItem): string | undefined {
  return item.id || item.message?.id
}

const {
  isAtBottom,
  scrollToBottom,
  scrollToMessage,
  handleScroll,
  handleNewMessage,
  loadMore,
  newMessageCount,
  showNewMessageTip,
  handleRoomChange
} = useChatScrollManager({
  scrollContainer: scrollContainerRef,
  messageListRef: contentRef,
  bottomThreshold: 100,
  topLoadThreshold: 50,
  onLoadMore: async () => {
    emit('loadMore')
  },
  isLastPage: computed(() => !props.hasMore),
  isLoading: computed(() => props.loading),
  currentRoomId: computed(() => props.currentRoomId ?? null),
  clearNewMsgCount: () => {
    newMessageCount.value = 0
  },
  onScrollToBottom: () => {
    emit('scrollToEnd')
  }
})

const handleScrollEvent = (event: Event) => {
  handleScroll(event)
  emit('scroll', event)
}

watch(
  () => props.messages.length,
  (newLength, oldLength) => {
    if (newLength > (oldLength || 0)) {
      if (isAtBottom.value) {
        scrollToBottom()
      } else {
        newMessageCount.value += newLength - (oldLength || 0)
        showNewMessageTip.value = true
      }
    }
  }
)

watch(
  () => props.currentRoomId,
  (newRoomId, oldRoomId) => {
    if (newRoomId && newRoomId !== oldRoomId) {
      handleRoomChange(newRoomId, oldRoomId)
    }
  }
)

function getScrollContainer(): HTMLElement | null {
  return scrollContainerRef.value
}

onMounted(() => {
  if (scrollContainerRef.value) {
    visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          emit('visibleChange', entry.isIntersecting)
        })
      },
      { threshold: 0.1 }
    )

    visibilityObserver.observe(scrollContainerRef.value)
  }
})

onUnmounted(() => {
  if (visibilityObserver) {
    visibilityObserver.disconnect()
    visibilityObserver = null
  }
})

defineExpose({
  scrollToBottom,
  scrollToMessage,
  getScrollContainer
})
</script>

<style scoped>
.message-container {
  position: relative;
  background-color: var(--tjg-surface-panel, var(--tjg-surface-panel));
}

.message-scroll-container {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

.message-list-wrapper {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.message-content {
  flex: 1;
}

.message-item {
  width: 100%;
}

.no-more-tip {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
  color: var(--tjg-text-tertiary);
  font-size: 12px;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
}

.new-message-tip {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: var(--tjg-color-primary-500, var(--tjg-brand));
  color: var(--tjg-text-inverse);
  border-radius: 20px;
  font-size: 12px;
  box-shadow: var(--tjg-shadow-card-hover);
  cursor: pointer;
  z-index: 10;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
