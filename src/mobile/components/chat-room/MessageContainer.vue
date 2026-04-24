<template>
  <div class="message-container flex flex-col h-full overflow-hidden">
    <div
      ref="scrollContainerRef"
      class="message-scroll-container flex-1 overflow-y-auto overflow-x-hidden"
      @scroll="handleScroll">
      <div class="message-list-wrapper">
        <slot name="header"></slot>

        <div v-if="showNoMore && !loading" class="no-more-tip">
          <span>{{ noMoreText || t('message_container.no_more') }}</span>
        </div>

        <div v-if="loading && !hasData" class="loading-container">
          <van-loading size="24px">{{ t('message_container.loading') }}</van-loading>
        </div>

        <div v-else ref="contentRef" class="message-content">
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
import { useThrottleFn } from '@vueuse/core'
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface MessageItem {
  id?: string
  message?: { id?: string }
  [key: string]: any
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
  }>(),
  {
    messages: () => [],
    loading: false,
    hasMore: true,
    showNoMore: false,
    noMoreText: '',
    estimatedItemHeight: 80,
    scrollBehavior: 'smooth'
  }
)

const emit = defineEmits<{
  loadMore: []
  scroll: [event: Event]
  scrollToEnd: []
  visibleChange: [visible: boolean]
}>()

const scrollContainerRef = ref<HTMLElement | null>(null)
let visibilityObserver: IntersectionObserver | null = null

const newMessageCount = ref(0)
const showNewMessageTip = ref(false)
const isNearBottom = ref(true)

const hasData = computed(() => props.messages.length > 0)

const SCROLL_THRESHOLD = 100
const LOAD_MORE_THRESHOLD = 50

function getMessageKey(item: MessageItem, index: number): string {
  return item.id || item.message?.id || `msg-${index}`
}

function getMessageId(item: MessageItem): string | undefined {
  return item.id || item.message?.id
}

const handleScroll = useThrottleFn((event: Event) => {
  emit('scroll', event)

  if (!scrollContainerRef.value) return

  const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.value
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight

  isNearBottom.value = distanceFromBottom < SCROLL_THRESHOLD

  if (scrollTop < LOAD_MORE_THRESHOLD && !props.loading && props.hasMore) {
    emit('loadMore')
  }

  if (isNearBottom.value && showNewMessageTip.value) {
    showNewMessageTip.value = false
    newMessageCount.value = 0
  }
}, 16)

function scrollToBottom(behavior: ScrollBehavior = props.scrollBehavior) {
  if (!scrollContainerRef.value) return

  nextTick(() => {
    if (scrollContainerRef.value) {
      scrollContainerRef.value.scrollTo({
        top: scrollContainerRef.value.scrollHeight,
        behavior
      })
    }
  })
}

function scrollToMessage(messageId: string, behavior: ScrollBehavior = 'smooth') {
  if (!scrollContainerRef.value) return

  const element = scrollContainerRef.value.querySelector(`[data-message-id="${messageId}"]`)
  if (element) {
    element.scrollIntoView({ behavior, block: 'center' })
  }
}

function getScrollContainer(): HTMLElement | null {
  return scrollContainerRef.value
}

watch(
  () => props.messages.length,
  (newLength, oldLength) => {
    if (newLength > (oldLength || 0)) {
      if (isNearBottom.value) {
        scrollToBottom('auto')
      } else {
        newMessageCount.value += newLength - (oldLength || 0)
        showNewMessageTip.value = true
      }
    }
  }
)

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
  background-color: var(--color-bg-primary, #fff);
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
  color: var(--color-text-tertiary, #909090);
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
  background: var(--color-primary, #13987f);
  color: #fff;
  border-radius: 20px;
  font-size: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
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
