<template>
  <li
    role="option"
    :aria-selected="active"
    :class="['chat-room-search__item', { 'chat-room-search__item--active': active }]"
    @click="emit('select', index)"
    @mouseenter="emit('set-active', index)">
    <div class="chat-room-search__item-meta">
      <span class="chat-room-search__sender">{{ senderName }}</span>
      <span class="chat-room-search__time">{{ timeLabel }}</span>
    </div>
    <p class="chat-room-search__snippet">
      <template v-for="(seg, i) in segments" :key="i">
        <mark v-if="seg.hit" class="chat-room-search__mark">{{ seg.text }}</mark>
        <span v-else>{{ seg.text }}</span>
      </template>
    </p>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SearchResult } from '@/services/matrix/MatrixSearchService'
import { formatChatTime } from '@/utils/ComputedTime'

const props = defineProps<{
  item: SearchResult
  index: number
  active: boolean
  query: string
  highlights?: string[] | undefined
}>()

const emit = defineEmits<{
  (e: 'select', index: number): void
  (e: 'set-active', index: number): void
}>()

const senderName = computed(() => {
  const sender = props.item.sender
  if (!sender) return ''
  // Matrix userId 形如 @name:server.org，取本地部分作为可读名
  const match = /^@?([^:]+):/.exec(sender)
  return match ? match[1] : sender
})

const timeLabel = computed(() => formatChatTime(props.item.timestamp))

const snippetText = computed(() => {
  const body = props.item.content?.body
  if (typeof body === 'string') return body
  const formatted = props.item.content?.formatted_body
  if (typeof formatted === 'string') return formatted.replace(/<[^>]*>/g, '')
  return ''
})

const highlightTerms = computed<string[]>(() => {
  const terms = (props.highlights || []).filter((h) => h.trim().length > 0)
  return terms.length > 0 ? terms : props.query.trim() ? [props.query.trim()] : []
})

const segments = computed<Array<{ text: string; hit: boolean }>>(() => {
  const text = snippetText.value
  if (!text) return [{ text: '', hit: false }]
  const terms = highlightTerms.value
  if (terms.length === 0) return [{ text, hit: false }]

  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  return text
    .split(re)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      hit: re.test(part) && terms.some((term) => term.toLowerCase() === part.toLowerCase())
    }))
})
</script>

<style scoped lang="scss">
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
</style>
