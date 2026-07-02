<template>
  <div class="push-notification-list">
    <div v-if="notifications.length === 0" class="empty-state">
      <span>{{ t('push.no_notifications') }}</span>
    </div>
    <div v-else>
      <div class="list-header">
        <span>{{ t('push.notification_count', { count: notifications.length }) }}</span>
        <button type="button" data-test="clear-all-btn" class="clear-btn" @click="emit('clear')">
          {{ t('push.clear_all') }}
        </button>
      </div>
      <div v-for="item in notifications" :key="item.id" data-test="notification-item" class="notification-item">
        <div class="item-content">
          <span class="item-title">{{ item.title }}</span>
          <span class="item-body">{{ item.body }}</span>
          <span class="item-time">{{ formatTime(item.timestamp) }}</span>
        </div>
        <button
          type="button"
          :data-test="`dismiss-btn-${item.id}`"
          class="dismiss-btn"
          @click="emit('dismiss', item.id)">
          &times;
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { NotificationItem } from '@/composables/mobile/usePushReceiver'

const ONE_MINUTE_MS = 60_000
const ONE_HOUR_MS = 3_600_000
const ONE_DAY_MS = 86_400_000

const { t } = useI18n()

defineProps<{
  notifications: NotificationItem[]
}>()

const emit = defineEmits<{
  clear: []
  dismiss: [id: string]
}>()

function formatTime(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  if (diff < ONE_MINUTE_MS) return t('push.just_now')
  if (diff < ONE_HOUR_MS) return t('push.minutes_ago', { count: Math.floor(diff / ONE_MINUTE_MS) })
  if (diff < ONE_DAY_MS) return t('push.hours_ago', { count: Math.floor(diff / ONE_HOUR_MS) })
  return date.toLocaleDateString()
}
</script>
