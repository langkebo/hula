<template>
  <Transition name="room-search">
    <div
      v-if="isOpen"
      class="chat-room-search"
      role="dialog"
      aria-modal="false"
      :aria-label="t('chat.header.search.title')">
      <div class="chat-room-search__bar">
        <svg
          class="chat-room-search__icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" stroke-linecap="round" />
        </svg>
        <input
          ref="inputRef"
          class="chat-room-search__input"
          type="text"
          :value="query"
          :placeholder="t('chat.header.search.placeholder')"
          :aria-label="t('chat.header.search.placeholder')"
          @input="onInput"
          @keydown="onKeydown" />
        <button
          v-if="loading"
          class="chat-room-search__spinner"
          type="button"
          :aria-label="t('chat.header.search.loading')"
          tabindex="-1">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round" />
          </svg>
        </button>
        <button
          v-else
          class="chat-room-search__close"
          type="button"
          :aria-label="t('chat.header.search.close')"
          @click="emit('close')">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div class="chat-room-search__body">
        <p v-if="showIdleHint" class="chat-room-search__hint">{{ t('chat.header.search.empty_hint') }}</p>
        <div v-else-if="error" class="chat-room-search__error" role="alert">
          <p class="chat-room-search__hint">{{ t('chat.header.search.load_failed') }}</p>
          <button type="button" class="chat-room-search__retry" :disabled="loading" @click="emit('retry')">
            {{ t('common.retry') }}
          </button>
        </div>
        <p v-else-if="showFirstLoading" class="chat-room-search__hint">
          {{ t('chat.header.search.loading') }}
        </p>
        <EmptyState
          v-else-if="showNoResults"
          compact
          variant="subtle"
          illustration="no-results"
          :description="t('chat.header.search.no_results')" />

        <ul v-if="hasResults" class="chat-room-search__list" role="listbox">
          <ChatRoomSearchItem
            v-for="(item, index) in results"
            :key="item.eventId"
            :item="item"
            :index="index"
            :active="index === activeIndex"
            :query="query"
            :highlights="highlights"
            @select="emit('select-result', $event)"
            @set-active="emit('set-active', $event)" />
        </ul>

        <div v-if="results.length > 0" class="chat-room-search__footer">
          <span class="chat-room-search__count">
            {{ t('chat.header.search.results_count', { count: results.length }) }}
          </span>
          <span class="chat-room-search__jump-hint">{{ t('chat.header.search.jump_hint') }}</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SearchResult } from '@/services/matrix/MatrixSearchService'
import ChatRoomSearchItem from './ChatRoomSearchItem.vue'

const props = defineProps<{
  isOpen: boolean
  query: string
  results: SearchResult[]
  loading: boolean
  /** 搜索请求失败，展示错误提示与重试入口 */
  error?: boolean
  activeIndex: number
  highlights?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:query', value: string): void
  (e: 'query-input'): void
  (e: 'select-result', index: number): void
  (e: 'navigate', direction: 'next' | 'prev'): void
  (e: 'set-active', index: number): void
  (e: 'retry'): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const inputRef = ref<HTMLInputElement | null>(null)

const hasResults = computed(() => props.results.length > 0)
/** 未输入关键词且未在搜索：展示输入引导 */
const showIdleHint = computed(() => !props.query.trim() && !props.loading)
/** 首次搜索中（尚无任何结果）：展示加载提示 */
const showFirstLoading = computed(() => props.loading && props.results.length === 0)
/** 已搜过但无结果：展示统一空态 */
const showNoResults = computed(() => props.query.trim().length > 0 && !props.loading && props.results.length === 0)

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      nextTick(() => inputRef.value?.focus())
    }
  },
  { immediate: true }
)

function onInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  emit('update:query', value)
  emit('query-input')
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      emit('navigate', 'next')
      break
    case 'ArrowUp':
      event.preventDefault()
      emit('navigate', 'prev')
      break
    case 'Enter': {
      event.preventDefault()
      if (props.activeIndex >= 0 && props.activeIndex < props.results.length) {
        emit('select-result', props.activeIndex)
      }
      break
    }
    case 'Escape':
      event.preventDefault()
      emit('close')
      break
  }
}
</script>

<style scoped lang="scss">
.chat-room-search {
  position: absolute;
  top: 8px;
  left: 16px;
  right: 16px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  max-height: 60%;
  background-color: var(--tjg-surface-panel);
  border: 1px solid var(--tjg-border-default);
  border-radius: 10px;
  box-shadow: var(--tjg-shadow-overlay, 0 8px 24px rgba(0, 0, 0, 0.18));
  overflow: hidden;
}

.chat-room-search__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--tjg-border-layout-divider);
  color: var(--tjg-text-tertiary);
}

.chat-room-search__icon {
  flex-shrink: 0;
}

.chat-room-search__input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 14px;
  color: var(--tjg-text-primary);

  &::placeholder {
    color: var(--tjg-text-tertiary);
  }
}

.chat-room-search__spinner,
.chat-room-search__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 4px;
  border: none;
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  border-radius: 4px;
  transition:
    color var(--tjg-motion-duration-fast) ease,
    background-color var(--tjg-motion-duration-fast) ease;

  &:hover {
    color: var(--tjg-text-secondary);
    background-color: color-mix(in srgb, var(--tjg-text-primary) 6%, transparent);
  }
}

.chat-room-search__spinner svg {
  animation: chat-room-search-spin 0.9s linear infinite;
}

@keyframes chat-room-search-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .chat-room-search__spinner svg {
    animation: none;
  }

  .room-search-enter-active,
  .room-search-leave-active {
    transition: none;
  }
}

.chat-room-search__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px;
}

.chat-room-search__hint {
  margin: 0;
  padding: 16px 12px;
  font-size: 13px;
  color: var(--tjg-text-tertiary);
  text-align: center;
}

.chat-room-search__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-bottom: 16px;

  .chat-room-search__hint {
    padding-bottom: 0;
    color: var(--tjg-color-danger-500);
  }
}

.chat-room-search__retry {
  padding: 4px 12px;
  border: 1px solid var(--tjg-border-default);
  border-radius: 6px;
  background: transparent;
  font-size: 12px;
  color: var(--tjg-color-primary-500);
  cursor: pointer;
  transition:
    background-color var(--tjg-motion-duration-fast) ease,
    opacity var(--tjg-motion-duration-fast) ease;

  &:hover:not(:disabled) {
    background-color: color-mix(in srgb, var(--tjg-color-primary-500) 10%, transparent);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.chat-room-search__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.chat-room-search__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 12px;
  border-top: 1px solid var(--tjg-border-layout-divider);
  font-size: 11px;
  color: var(--tjg-text-tertiary);
}

.chat-room-search__jump-hint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-search-enter-active,
.room-search-leave-active {
  transition:
    opacity var(--tjg-motion-duration-fast) ease,
    transform var(--tjg-motion-duration-fast) ease;
}

.room-search-enter-from,
.room-search-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
