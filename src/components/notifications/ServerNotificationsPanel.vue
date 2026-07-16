<template>
  <div class="server-notifications-panel">
    <n-card size="small" :bordered="false" class="panel-card">
      <template #header>
        <div class="panel-header">
          <div class="panel-title-wrap">
            <span class="panel-title">{{ t('server_notifications.title') }}</span>
            <n-tag v-if="hasUnread" size="tiny" type="error" round>
              {{ t('server_notifications.unread_count', { count: unreadNotifications.length }) }}
            </n-tag>
          </div>
          <div class="panel-actions">
            <n-button size="tiny" quaternary :loading="loading" :disabled="loading" @click="refresh">
              {{ t('server_notifications.refresh') }}
            </n-button>
            <n-button
              size="tiny"
              type="primary"
              ghost
              :disabled="!hasUnread || updating"
              :loading="updating"
              @click="handleMarkAllAsRead">
              {{ t('server_notifications.mark_all_read') }}
            </n-button>
          </div>
        </div>
      </template>

      <n-spin :show="loading">
        <!-- 错误提示 -->
        <div v-if="errorMessage && !loading" class="panel-error">
          <n-tag type="error" size="small">{{ errorMessage }}</n-tag>
        </div>

        <!-- 空状态 -->
        <n-empty v-else-if="activeNotifications.length === 0" :description="t('server_notifications.empty')" />

        <!-- 通知列表 -->
        <n-list v-else bordered class="notification-list" :show-divider="true">
          <n-list-item v-for="item in activeNotifications" :key="item.id" class="notification-item">
            <div class="notification-card">
              <div class="notification-head">
                <div class="notification-title-row">
                  <n-tag :type="severityTagType(item.level)" size="tiny" round>
                    {{ t(`server_notifications.severity_${severityKey(item.level)}`) }}
                  </n-tag>
                  <span class="notification-title" :class="{ 'is-unread': !item.read }">{{ item.title }}</span>
                </div>
                <span v-if="item.expires_at" class="notification-time">{{ formatExpiry(item.expires_at) }}</span>
              </div>
              <p class="notification-content">{{ item.content }}</p>
              <div class="notification-ops">
                <n-button
                  v-if="!item.read"
                  size="tiny"
                  quaternary
                  :disabled="updating"
                  @click="handleMarkAsRead(item.id)">
                  {{ t('server_notifications.mark_read') }}
                </n-button>
                <n-button size="tiny" quaternary :disabled="updating" @click="handleDismiss(item.id)">
                  {{ t('server_notifications.dismiss') }}
                </n-button>
                <n-button size="tiny" quaternary type="error" :disabled="updating" @click="handleDelete(item.id)">
                  {{ t('server_notifications.delete') }}
                </n-button>
              </div>
            </div>
          </n-list-item>
        </n-list>
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { NButton, NCard, NEmpty, NList, NListItem, NSpin, NTag } from 'naive-ui'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useServerNotifications } from '@/composables/notifications/useServerNotifications'

defineOptions({
  name: 'ServerNotificationsPanel'
})

const { t } = useI18n()
const {
  activeNotifications,
  unreadNotifications,
  hasUnread,
  loading,
  updating,
  errorMessage,
  load,
  refresh,
  markAsRead,
  markAllAsRead,
  dismiss,
  deleteNotification
} = useServerNotifications()

onMounted(() => {
  load()
})

/** 将服务端 level 字段归一化为 info / warning / critical */
function severityKey(level?: string): 'info' | 'warning' | 'critical' {
  if (level === 'warning') return 'warning'
  if (level === 'critical' || level === 'error') return 'critical'
  return 'info'
}

/** Naive UI NTag type 映射 */
function severityTagType(level?: string): 'info' | 'warning' | 'error' {
  const key = severityKey(level)
  if (key === 'warning') return 'warning'
  if (key === 'critical') return 'error'
  return 'info'
}

/** 格式化过期时间,兼容秒与毫秒 */
function formatExpiry(expiresAt: number): string {
  const ms = expiresAt < 1e12 ? expiresAt * 1000 : expiresAt
  try {
    return t('server_notifications.expires_at', { time: new Date(ms).toLocaleString() })
  } catch {
    return ''
  }
}

async function handleMarkAsRead(id: number): Promise<void> {
  await markAsRead(id)
}

async function handleMarkAllAsRead(): Promise<void> {
  await markAllAsRead()
}

async function handleDismiss(id: number): Promise<void> {
  await dismiss(id)
}

async function handleDelete(id: number): Promise<void> {
  await deleteNotification(id)
}
</script>

<style scoped>
.server-notifications-panel {
  padding: 0 var(--hula-space-2);
}

.panel-card {
  background: var(--hula-surface-panel);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hula-space-2);
}

.panel-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--hula-space-2);
}

.panel-title {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-medium);
  color: var(--hula-text-primary);
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: var(--hula-space-2);
}

.panel-error {
  padding: var(--hula-space-2) 0;
}

.notification-list {
  background: var(--hula-surface-panel);
}

.notification-card {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.notification-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--hula-space-2);
}

.notification-title-row {
  display: flex;
  align-items: center;
  gap: var(--hula-space-2);
  min-width: 0;
  flex: 1;
}

.notification-title {
  font-size: var(--hula-font-size-base);
  font-weight: var(--hula-font-weight-medium);
  color: var(--hula-text-primary);
  word-break: break-all;
}

.notification-title.is-unread {
  font-weight: 600;
}

.notification-time {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  flex-shrink: 0;
}

.notification-content {
  margin: var(--hula-space-1) 0 var(--hula-space-2);
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.notification-ops {
  display: flex;
  gap: var(--hula-space-1);
  flex-wrap: wrap;
}
</style>
