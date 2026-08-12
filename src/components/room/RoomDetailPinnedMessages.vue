<template>
  <section class="room-detail-pinned" data-testid="room-detail-pinned">
    <header class="flex items-center justify-between">
      <h4 class="text-[length:var(--tjg-font-size-sm)] font-[--tjg-font-weight-semibold] color-[--tjg-text-secondary]">
        {{ t('room.detail.pinned_title') }}
      </h4>
      <span
        v-if="!loading && messages.length > 0"
        class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-text-tertiary]"
        data-testid="room-detail-pinned-count">
        {{ messages.length }}
      </span>
    </header>

    <div
      v-if="loading"
      class="room-detail-pinned__loading flex-center py-[--tjg-space-4]"
      data-testid="room-detail-pinned-loading">
      <svg
        class="size-24px color-[--tjg-text-tertiary] animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>

    <div
      v-else-if="messages.length === 0"
      class="room-detail-pinned__empty flex-center py-[--tjg-space-4] text-[length:var(--tjg-font-size-xs)] color-[--tjg-text-tertiary]"
      data-testid="room-detail-pinned-empty">
      {{ t('room.detail.no_pinned') }}
    </div>

    <ul v-else class="room-detail-pinned__list flex flex-col gap-[--tjg-space-2] mt-[--tjg-space-2]">
      <li
        v-for="msg in displayMessages"
        :key="msg.eventId"
        class="room-detail-pinned__item flex items-start gap-[--tjg-space-2] py-[--tjg-space-1] px-[--tjg-space-2] rounded-[--tjg-radius-sm] hover:bg-[--tjg-surface-list-hover] transition-colors"
        data-testid="room-detail-pinned-item">
        <svg
          class="shrink-0 mt-1 size-14px color-[--tjg-color-primary-500]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <path d="M9 2h6v6l5 8a2 2 0 0 1-1.7 3H5.7A2 2 0 0 1 4 16l5-8V2z" />
        </svg>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-[--tjg-space-1]">
            <span
              class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-color-primary-500] font-[--tjg-font-weight-medium] truncate"
              data-testid="room-detail-pinned-sender">
              {{ msg.sender }}
            </span>
            <span
              v-if="formatTime(msg.timestamp)"
              class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-text-tertiary] shrink-0"
              data-testid="room-detail-pinned-time">
              {{ formatTime(msg.timestamp) }}
            </span>
          </div>
          <p
            class="text-[length:var(--tjg-font-size-sm)] color-[--tjg-text-secondary] mt-1 leading-[1.5] break-words"
            data-testid="room-detail-pinned-text">
            {{ truncateBody(msg.body) }}
          </p>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PinnedMessageInfo } from '@/composables/room/usePinnedMessage'

const props = defineProps<{
  messages: PinnedMessageInfo[]
  loading?: boolean
}>()

const MAX_DISPLAY = 5
const MAX_BODY_LENGTH = 100

const { t } = useI18n()

const displayMessages = computed<PinnedMessageInfo[]>(() =>
  [...props.messages].sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_DISPLAY)
)

const truncateBody = (body: string): string => {
  if (!body) return ''
  if (body.length <= MAX_BODY_LENGTH) return body
  return `${body.slice(0, MAX_BODY_LENGTH)}...`
}

const formatTime = (timestamp: number): string => {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp)
    return date.toLocaleString(undefined, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
}
</script>
