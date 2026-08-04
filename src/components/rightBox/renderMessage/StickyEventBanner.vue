<template>
  <div v-if="events.length > 0" class="sticky-banner" role="status">
    <div class="sticky-banner__header">
      <svg
        class="sticky-banner__icon"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round">
        <path d="M12 2v8M12 2L8 6M12 2l4 4" />
        <rect x="4" y="10" width="16" height="12" rx="2" />
      </svg>
      <span class="sticky-banner__title">粘性事件</span>
      <button
        v-if="events.length > 1"
        type="button"
        class="sticky-banner__toggle"
        data-testid="sticky-toggle-btn"
        :aria-expanded="expanded"
        @click="toggleExpand">
        {{ toggleLabel }}
      </button>
      <button
        v-if="canSetSticky"
        type="button"
        class="sticky-banner__set"
        data-testid="sticky-set-btn"
        @click="$emit('set-sticky')">
        设为粘性事件
      </button>
    </div>
    <div class="sticky-banner__list">
      <div
        v-for="event in visibleEvents"
        :key="event.eventId"
        class="sticky-banner__item"
        role="button"
        tabindex="0"
        @click="$emit('view', event.eventId)"
        @keyup.enter="$emit('view', event.eventId)">
        <span class="sticky-banner__sender">{{ event.sender }}</span>
        <span class="sticky-banner__body">{{ event.body }}</span>
        <span class="sticky-banner__time">{{ formatTime(event.timestamp) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { StickyEventInfo } from '@/composables/room/useStickyEvents'

defineOptions({ name: 'StickyEventBanner' })

const props = withDefaults(
  defineProps<{
    events: StickyEventInfo[]
    canSetSticky?: boolean
  }>(),
  {
    canSetSticky: false
  }
)

defineEmits<{
  (e: 'view', eventId: string): void
  (e: 'set-sticky'): void
}>()

const MAX_VISIBLE_EXPANDED = 3

const expanded = ref(false)

const visibleEvents = computed<StickyEventInfo[]>(() => {
  if (props.events.length === 0) return []
  if (expanded.value) {
    return props.events.slice(0, MAX_VISIBLE_EXPANDED)
  }
  return props.events.slice(0, 1)
})

const remainingCount = computed<number>(() => Math.max(0, props.events.length - 1))

const toggleLabel = computed<string>(() => (expanded.value ? '收起' : `展开 ${remainingCount.value} 条`))

const toggleExpand = (): void => {
  expanded.value = !expanded.value
}

const formatTime = (timestamp: number): string => {
  try {
    return new Date(timestamp).toLocaleString()
  } catch {
    return ''
  }
}
</script>

<style scoped lang="scss">
.sticky-banner {
  margin: 6px 12px 0;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--tjg-color-primary-100);
  background: var(--tjg-color-primary-100);
  color: var(--tjg-text-primary);
  flex-shrink: 0;
  max-height: 240px;
  overflow: hidden;
  transition: max-height var(--tjg-motion-duration-normal, 200ms) var(--tjg-motion-ease-standard, ease);
}

.sticky-banner__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.sticky-banner__icon {
  flex-shrink: 0;
  color: var(--tjg-color-primary-500);
}

.sticky-banner__title {
  font-size: 12px;
  font-weight: 600;
  color: var(--tjg-color-primary-700);
  flex: 1;
}

.sticky-banner__toggle,
.sticky-banner__set {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--tjg-color-primary-500);
  padding: 2px 6px;
  border-radius: 6px;
  flex-shrink: 0;
}

.sticky-banner__toggle:hover,
.sticky-banner__set:hover {
  background: color-mix(in srgb, var(--tjg-color-primary-500) 12%, transparent);
}

.sticky-banner__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sticky-banner__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--tjg-surface-panel);
  cursor: pointer;
  min-height: 36px;
  transition: background var(--tjg-motion-duration-fast, 150ms) ease;
}

.sticky-banner__item:hover {
  background: color-mix(in srgb, var(--tjg-color-primary-500) 8%, var(--tjg-surface-panel));
}

.sticky-banner__sender {
  font-size: 12px;
  font-weight: 500;
  color: var(--tjg-color-primary-700);
  flex-shrink: 0;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sticky-banner__body {
  font-size: 12px;
  color: var(--tjg-text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sticky-banner__time {
  font-size: 11px;
  color: var(--tjg-text-tertiary);
  flex-shrink: 0;
}
</style>
