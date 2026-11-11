<template>
  <n-spin :show="loading">
    <div v-if="notifications.length > 0" class="notification-list">
      <div v-for="(notif, idx) in notifications" :key="notificationKey(notif, idx)" class="notification-item">
        <div class="notification-info">
          <div class="notification-content">
            {{ getNotificationContent(notif, t('setting.push.history.no_content')) }}
          </div>
          <div class="notification-meta">
            <span v-if="notif.room_id" class="notification-room">{{ notif.room_id }}</span>
            <span v-if="notif.ts" class="notification-time">{{ formatTimestamp(notif.ts) }}</span>
          </div>
        </div>
        <div class="notification-actions">
          <span v-if="isNotificationRead(notif)" class="notification-read">
            {{ t('setting.push.history.read') }}
          </span>
          <n-button v-else size="tiny" secondary :loading="isAcking(notif)" @click="handleAckNotification(notif)">
            {{ t('setting.push.history.mark_read') }}
          </n-button>
        </div>
      </div>
    </div>
    <n-empty v-else :description="t('setting.push.history.empty')" />
  </n-spin>
</template>

<script setup lang="ts">
import { NButton, NEmpty, NSpin } from 'naive-ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixNotificationService } from '@/services/matrix/notifications/MatrixNotificationService'
import {
  getNotificationContent,
  getNotificationId,
  isNotificationRead,
  notificationKey
} from '@/services/matrix/notifications/notificationHistoryPresentation'
import { createLogger } from '@/utils/Logger'

defineOptions({
  name: 'PushNotificationHistory'
})

const props = defineProps<{
  /** 会话就绪后才发起拉取，避免客户端未初始化时抢跑拿到空列表且不再重试 */
  ready: boolean
}>()

const logger = createLogger('PushNotificationHistory')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loading = ref(false)
const notifications = ref<Array<Record<string, unknown>>>([])
/** 正在确认中的通知 ID，用于逐条禁用按钮，避免重复提交 */
const ackingIds = ref<string[]>([])

watch(
  () => props.ready,
  (ready) => {
    if (ready) {
      void fetchNotifications()
    }
  },
  { immediate: true }
)

async function fetchNotifications() {
  loading.value = true
  try {
    const result = await matrixNotificationService.getNotifications(undefined, 20)
    notifications.value = (result as { notifications?: Array<Record<string, unknown>> })?.notifications ?? []
  } catch (error) {
    logger.warn('Failed to fetch notifications', error)
  } finally {
    loading.value = false
  }
}

function isAcking(notif: Record<string, unknown>): boolean {
  const id = getNotificationId(notif)
  return id !== null && ackingIds.value.includes(id)
}

async function handleAckNotification(notif: Record<string, unknown>) {
  const notificationId = getNotificationId(notif)
  const roomId = typeof notif.room_id === 'string' ? notif.room_id : ''
  const eventId = typeof notif.event_id === 'string' ? notif.event_id : ''
  // ack 端点只认 notification_id；回执兜底还需要 room_id + event_id
  if (notificationId === null || !roomId || !eventId) {
    showFeedback(t('setting.push.history.ack_unavailable'), 'warning')
    return
  }
  if (ackingIds.value.includes(notificationId)) return

  ackingIds.value = [...ackingIds.value, notificationId]
  try {
    const result = await matrixNotificationService.ackNotificationWithFallback(notificationId, roomId, eventId)
    if (!result.success) {
      showFeedback(t('setting.push.history.ack_failed'), 'error')
      return
    }
    notif.read = true
    showFeedback(
      result.method === 'receipt' ? t('setting.push.history.ack_receipt') : t('setting.push.history.ack_success'),
      'success'
    )
  } catch (error) {
    logger.warn('Failed to ack notification', error)
    showFeedback(t('setting.push.history.ack_failed'), 'error')
  } finally {
    ackingIds.value = ackingIds.value.filter((id) => id !== notificationId)
  }
}

function formatTimestamp(ts: unknown): string {
  // 桌面端保留 `toLocaleString()` 的完整本地时间，移动端使用紧凑格式，故不复用共享格式化函数
  if (typeof ts !== 'number' && typeof ts !== 'string') return ''
  try {
    return new Date(Number(ts)).toLocaleString()
  } catch {
    return String(ts)
  }
}
</script>

<style scoped>
.notification-list {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.notification-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-3) var(--tjg-space-4);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.notification-actions {
  flex-shrink: 0;
}

.notification-read {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.notification-info {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: var(--tjg-space-1);
}

.notification-content {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
  word-break: break-word;
}

.notification-meta {
  display: flex;
  gap: var(--tjg-space-3);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.notification-room {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-time {
  white-space: nowrap;
}
</style>
