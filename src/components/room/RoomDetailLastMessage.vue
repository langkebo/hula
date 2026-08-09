<template>
  <section class="room-detail-last-message" data-testid="room-detail-last-message">
    <header class="flex items-center justify-between mb-[--tjg-space-1]">
      <h4 class="text-[length:var(--tjg-font-size-sm)] font-[--tjg-font-weight-semibold] color-[--tjg-text-secondary]">
        {{ t('space.detail_last_message') }}
      </h4>
      <span
        v-if="timestamp"
        class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-text-tertiary]"
        data-testid="room-detail-last-message-time">
        {{ formattedTime }}
      </span>
    </header>

    <div
      v-if="!lastMessage"
      class="text-[length:var(--tjg-font-size-xs)] color-[--tjg-text-tertiary] py-[--tjg-space-2]"
      data-testid="room-detail-last-message-empty">
      {{ t('room.detail.no_topic') }}
    </div>

    <div
      v-else
      class="room-detail-last-message__body flex items-start gap-[--tjg-space-2] py-[--tjg-space-1]"
      data-testid="room-detail-last-message-body">
      <span
        class="shrink-0 text-[length:var(--tjg-font-size-xs)] color-[--tjg-color-primary-500] font-[--tjg-font-weight-medium]">
        {{ resolvedSenderName }}
      </span>
      <span class="flex-1 min-w-0 text-[length:var(--tjg-font-size-sm)] color-[--tjg-text-secondary] truncate">
        {{ truncatedMessage }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  lastMessage: string | null
  senderName: string | null
  timestamp: number | null
}>()

const { t } = useI18n()

const MAX_MESSAGE_LENGTH = 80

const resolvedSenderName = computed(() => props.senderName || t('common.unknownUser'))

const truncatedMessage = computed(() => {
  const msg = props.lastMessage ?? ''
  if (msg.length <= MAX_MESSAGE_LENGTH) return msg
  return `${msg.slice(0, MAX_MESSAGE_LENGTH)}...`
})

const formattedTime = computed(() => {
  if (!props.timestamp) return ''
  try {
    const date = new Date(props.timestamp)
    return date.toLocaleString(undefined, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return ''
  }
})
</script>
