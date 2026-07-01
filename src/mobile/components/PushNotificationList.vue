<template>
  <div class="push-notification-list">
    <div v-if="notifications.length === 0" class="empty-state">
      <span>暂无推送消息</span>
    </div>
    <div v-else>
      <div class="list-header">
        <span>{{ notifications.length }} 条通知</span>
        <button type="button" data-test="clear-all-btn" class="clear-btn" @click="emit('clear')">清空全部</button>
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
import type { NotificationItem } from '@/composables/mobile/usePushReceiver'

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
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return date.toLocaleDateString('zh-CN')
}
</script>
