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
          stroke-width="1.5">
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round" />
          </svg>
        </button>
        <button
          v-else
          class="chat-room-search__close"
          type="button"
          :aria-label="t('chat.header.search.close')"
          @click="emit('close')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M6 6l12 12M18 6L6 18" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div class="chat-room-search__body">
        <p v-if="!query.trim() && !loading" class="chat-room-search__hint">{{ t('chat.header.search.empty_hint') }}</p>
        <p v-else-if="loading && results.length === 0" class="chat-room-search__hint">
          {{ t('chat.header.search.loading') }}
        </p>
        <p v-else-if="query.trim() && !loading && results.length === 0" class="chat-room-search__hint">
          {{ t('chat.header.search.no_results') }}
        </p>

        <ul v-if="results.length > 0" class="chat-room-search__list" role="listbox">
          <li
            v-for="(item, index) in results"
            :key="item.eventId"
            role="option"
            :aria-selected="index === activeIndex"
            :class="['chat-room-search__item', { 'chat-room-search__item--active': index === activeIndex }]"
            @click="emit('select-result', index)"
            @mouseenter="emit('set-active', index)">
            <div class="chat-room-search__item-meta">
              <span class="chat-room-search__sender">{{ formatSender(item.sender) }}</span>
              <span class="chat-room-search__time">{{ formatTime(item.timestamp) }}</span>
            </div>
            <p class="chat-room-search__snippet">
              <template v-for="(seg, i) in segments(item)" :key="i">
                <mark v-if="seg.hit" class="chat-room-search__mark">{{ seg.text }}</mark>
                <span v-else>{{ seg.text }}</span>
              </template>
            </p>
          </li>
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
import { formatChatTime } from '@/utils/ComputedTime'

const props = defineProps<{
  isOpen: boolean
  query: string
  results: SearchResult[]
  loading: boolean
  activeIndex: number
  highlights?: string[]
}>()

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void
  (e: 'update:query', value: string): void
  (e: 'query-input'): void
  (e: 'select-result', index: number): void
  (e: 'navigate', direction: 'next' | 'prev'): void
  (e: 'set-active', index: number): void
  (e: 'close'): void
}>()

const { t } = useI18n()
const inputRef = ref<HTMLInputElement | null>(null)

const highlightTerms = computed<string[]>(() => {
  const terms = (props.highlights || []).filter((h) => h.trim().length > 0)
  return terms.length > 0 ? terms : props.query.trim() ? [props.query.trim()] : []
})

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

function formatSender(sender: string): string {
  if (!sender) return ''
  // Matrix userId 形如 @name:server.org，取本地部分作为可读名
  const match = /^@?([^:]+):/.exec(sender)
  return match ? match[1] : sender
}

function formatTime(ts: number): string {
  return formatChatTime(ts)
}

function snippetText(item: SearchResult): string {
  const body = item.content?.body
  if (typeof body === 'string') return body
  if (typeof item.content?.formatted_body === 'string') return stripHtml(item.content.formatted_body)
  return ''
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

function segments(item: SearchResult): Array<{ text: string; hit: boolean }> {
  const text = snippetText(item)
  if (!text) return [{ text: '', hit: false }]
  const terms = highlightTerms.value
  if (terms.length === 0) return [{ text, hit: false }]

  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(re)
  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      hit: re.test(part) && terms.some((term) => term.toLowerCase() === part.toLowerCase())
    }))
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
  outline: none;
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

.chat-room-search__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.chat-room-search__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast) ease;
}

.chat-room-search__item--active,
.chat-room-search__item:hover {
  background-color: color-mix(in srgb, var(--tjg-color-primary-500) 10%, transparent);
}

.chat-room-search__item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chat-room-search__sender {
  font-size: 12px;
  font-weight: 600;
  color: var(--tjg-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-room-search__time {
  font-size: 11px;
  color: var(--tjg-text-tertiary);
  flex-shrink: 0;
}

.chat-room-search__snippet {
  margin: 0;
  font-size: 13px;
  color: var(--tjg-text-primary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.chat-room-search__mark {
  background-color: color-mix(in srgb, var(--tjg-color-warning-500) 35%, transparent);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
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
