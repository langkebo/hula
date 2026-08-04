<template>
  <div ref="containerRef" class="virtual-message-list" @scroll="handleScroll">
    <div class="scroll-content" :style="{ height: `${totalHeight}px`, paddingTop: `${offsetY}px` }">
      <div
        v-for="message in visibleMessages"
        :key="message.id"
        :ref="(el) => setMessageRef(message.id, el)"
        class="message-wrapper"
        :style="{ minHeight: `${getItemHeight(message)}px` }">
        <slot name="message" :message="message" :index="message._index" />
      </div>
    </div>

    <div v-if="loadingMore" class="loading-indicator">
      <n-spin size="small" />
      <span>{{ t('common.loading') }}</span>
    </div>

    <Transition name="fade">
      <div v-if="showNewMessageBadge" class="new-message-badge" @click="scrollToBottom()">
        <n-icon>
          <svg><use href="#arrow-down" /></svg>
        </n-icon>
        <span>{{ t('message.new_messages', { count: newMessageCount }) }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn, useThrottleFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Message {
  id: string
  type: string
  content: Record<string, unknown>
  timestamp: number
  _index?: number
}

const props = withDefaults(
  defineProps<{
    messages: Message[]
    itemHeight?: number
    bufferSize?: number
    loadingMore?: boolean
  }>(),
  {
    itemHeight: 80,
    bufferSize: 5
  }
)

const emit = defineEmits<{
  (e: 'loadMore'): void
  (e: 'scrollTo', position: number): void
  (e: 'visibleChange', start: number, end: number): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const messageRefs = new Map<string, HTMLElement>()

const scrollTop = ref(0)
const containerHeight = ref(0)
const newMessageCount = ref(0)
const showNewMessageBadge = ref(false)
const isAtBottom = ref(true)
const lastScrollTop = ref(0)

const totalHeight = computed(() => {
  return props.messages.reduce((sum, msg) => sum + getItemHeight(msg), 0)
})

const visibleRange = computed(() => {
  const start = Math.floor(scrollTop.value / props.itemHeight) - props.bufferSize
  const visibleCount = Math.ceil(containerHeight.value / props.itemHeight) + props.bufferSize * 2

  return {
    start: Math.max(0, start),
    end: Math.min(props.messages.length, start + visibleCount)
  }
})

const offsetY = computed(() => {
  let offset = 0
  for (let i = 0; i < visibleRange.value.start; i++) {
    offset += getItemHeight(props.messages[i])
  }
  return offset
})

const visibleMessages = computed(() => {
  return props.messages.slice(visibleRange.value.start, visibleRange.value.end).map((msg, idx) => ({
    ...msg,
    _index: visibleRange.value.start + idx
  }))
})

const getItemHeight = (message: Message): number => {
  switch (message.type) {
    case 'image':
      return 200
    case 'video':
      return 240
    case 'file':
      return 60
    case 'voice':
      return 50
    case 'poll':
      return 200
    default:
      return props.itemHeight
  }
}

const setMessageRef = (id: string, el: Element | ComponentPublicInstance | null) => {
  if (el && el instanceof HTMLElement) {
    messageRefs.set(id, el)
  } else {
    messageRefs.delete(id)
  }
}

const handleScroll = useThrottleFn(() => {
  if (!containerRef.value) return

  scrollTop.value = containerRef.value.scrollTop
  const scrollHeight = containerRef.value.scrollHeight
  const clientHeight = containerRef.value.clientHeight

  isAtBottom.value = scrollHeight - scrollTop.value - clientHeight < 100

  if (scrollTop.value < 50 && !props.loadingMore) {
    emit('loadMore')
  }

  if (scrollTop.value > lastScrollTop.value && !isAtBottom.value) {
    showNewMessageBadge.value = false
  }

  lastScrollTop.value = scrollTop.value

  emit('visibleChange', visibleRange.value.start, visibleRange.value.end)
}, 16)

const scrollToBottom = (smooth = true) => {
  if (!containerRef.value) return

  containerRef.value.scrollTo({
    top: containerRef.value.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto'
  })

  showNewMessageBadge.value = false
  newMessageCount.value = 0
}

const scrollToMessage = (messageId: string) => {
  const index = props.messages.findIndex((m) => m.id === messageId)
  if (index === -1) return

  let targetTop = 0
  for (let i = 0; i < index; i++) {
    targetTop += getItemHeight(props.messages[i])
  }

  containerRef.value?.scrollTo({
    top: targetTop,
    behavior: 'smooth'
  })
}

const handleNewMessage = (count: number) => {
  if (!isAtBottom.value) {
    newMessageCount.value += count
    showNewMessageBadge.value = true
  } else {
    nextTick(() => scrollToBottom(false))
  }
}

const updateContainerHeight = useDebounceFn(() => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight
  }
}, 100)

onMounted(() => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight
    new ResizeObserver(updateContainerHeight).observe(containerRef.value)
  }
})

watch(
  () => props.messages.length,
  (newLen, oldLen) => {
    const diff = newLen - (oldLen || 0)
    if (diff > 0) {
      handleNewMessage(diff)
    }
  }
)

defineExpose({
  scrollToBottom,
  scrollToMessage
})
</script>

<style scoped lang="scss">
.virtual-message-list {
  height: 100%;
  overflow-y: auto;
  position: relative;
}

.scroll-content {
  position: relative;
}

.message-wrapper {
  position: relative;
}

.loading-indicator {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--tjg-surface-app);
  border-radius: 16px;
  box-shadow: var(--tjg-shadow-card);
  font-size: 13px;
  color: var(--tjg-text-secondary);
}

.new-message-badge {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--tjg-color-primary-500);
  color: var(--tjg-text-inverse);
  border-radius: 16px;
  font-size: 13px;
  cursor: pointer;
  box-shadow: var(--tjg-shadow-card-hover);
  transition: transform 0.2s;

  &:hover {
    transform: translateX(-50%) scale(1.05);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s,
    transform 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
