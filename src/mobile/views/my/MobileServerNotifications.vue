<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <van-nav-bar
        :title="t('server_notifications.title')"
        left-arrow
        :right-text="t('server_notifications.mark_all_read')"
        @click-left="handleBack"
        @click-right="handleMarkAllAsRead">
        <template #right>
          <span :class="['mark-all-btn', { 'is-disabled': !hasUnread || updating }]">
            {{ t('server_notifications.mark_all_read') }}
          </span>
        </template>
      </van-nav-bar>
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div v-if="hasUnread" class="px-16px pt-12px">
          <van-tag type="danger" round size="medium">
            {{ t('server_notifications.unread_count', { count: unreadNotifications.length }) }}
          </van-tag>
        </div>

        <!-- 加载/错误/空状态 -->
        <div v-if="loading && activeNotifications.length === 0" class="flex items-center justify-center py-40px">
          <van-loading size="24px">{{ t('server_notifications.loading') }}</van-loading>
        </div>

        <div v-else-if="errorMessage" class="flex items-center justify-center py-40px text-14px text-[--hula-color-danger-500]">
          {{ errorMessage }}
        </div>

        <div v-else-if="activeNotifications.length === 0" class="flex flex-col items-center justify-center py-60px text-[--hula-text-quaternary]">
          <Icon icon="mdi:bell-off-outline" :width="48" class="mb-12px opacity-50" />
          <span class="text-14px">{{ t('server_notifications.empty') }}</span>
        </div>

        <!-- 通知列表 -->
        <div v-else class="flex flex-col p-12px gap-12px">
          <div
            v-for="item in activeNotifications"
            :key="item.id"
            class="notification-card rounded-12px p-12px bg-[--hula-surface-panel]">
            <div class="flex items-center justify-between gap-8px mb-8px">
              <div class="flex items-center gap-8px min-w-0 flex-1">
                <van-tag :type="severityTagType(item.level)" size="medium" round>
                  {{ t(`server_notifications.severity_${severityKey(item.level)}`) }}
                </van-tag>
                <span
                  class="text-15px truncate"
                  :class="item.read ? 'text-[--hula-text-secondary]' : 'text-[--hula-text-primary] font-bold'">
                  {{ item.title }}
                </span>
              </div>
              <span v-if="item.expires_at" class="text-12px text-[--hula-text-quaternary] flex-shrink-0">
                {{ formatExpiry(item.expires_at) }}
              </span>
            </div>

            <p class="text-14px text-[--hula-text-secondary] whitespace-pre-wrap break-words mb-12px">
              {{ item.content }}
            </p>

            <div class="flex gap-8px flex-wrap">
              <van-button
                v-if="!item.read"
                size="small"
                plain
                type="primary"
                :disabled="updating"
                @click="handleMarkAsRead(item.id)">
                {{ t('server_notifications.mark_read') }}
              </van-button>
              <van-button size="small" plain :disabled="updating" @click="handleDismiss(item.id)">
                {{ t('server_notifications.dismiss') }}
              </van-button>
              <van-button size="small" plain type="danger" :disabled="updating" @click="handleDelete(item.id)">
                {{ t('server_notifications.delete') }}
              </van-button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useServerNotifications } from '@/composables/notifications/useServerNotifications'

defineOptions({
  name: 'MobileServerNotifications'
})

const { t } = useI18n()
const router = useRouter()
const {
  activeNotifications,
  unreadNotifications,
  hasUnread,
  loading,
  updating,
  errorMessage,
  load,
  markAsRead,
  markAllAsRead,
  dismiss,
  deleteNotification
} = useServerNotifications()

onMounted(() => {
  load()
})

function handleBack(): void {
  router.back()
}

/** 将服务端 level 字段归一化为 info / warning / critical */
function severityKey(level?: string): 'info' | 'warning' | 'critical' {
  if (level === 'warning') return 'warning'
  if (level === 'critical' || level === 'error') return 'critical'
  return 'info'
}

/** Vant van-tag type 映射:info(蓝)/warning(黄)/danger(红) */
function severityTagType(level?: string): 'primary' | 'warning' | 'danger' {
  const key = severityKey(level)
  if (key === 'warning') return 'warning'
  if (key === 'critical') return 'danger'
  return 'primary'
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
  if (!hasUnread.value || updating.value) return
  await markAllAsRead()
}

async function handleDismiss(id: number): Promise<void> {
  await dismiss(id)
}

async function handleDelete(id: number): Promise<void> {
  await deleteNotification(id)
}
</script>

<style scoped lang="scss">
:deep(.van-nav-bar) {
  background: var(--hula-surface-panel);
}

:deep(.van-nav-bar__title) {
  color: var(--hula-text-primary);
}

:deep(.van-nav-bar .van-icon) {
  color: var(--hula-text-primary);
}

.mark-all-btn {
  color: var(--hula-color-primary-500);
  font-size: 14px;
}

.mark-all-btn.is-disabled {
  color: var(--hula-text-quaternary);
}

.notification-card {
  border: 1px solid var(--hula-border-layout-divider);
}
</style>
