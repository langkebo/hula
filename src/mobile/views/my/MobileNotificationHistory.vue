<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :is-official="false" :hidden-right="true" :room-name="t('setting.push.history.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full p-16px gap-12px">
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px">{{ t('mobile_push.loading') }}</van-loading>
        </div>

        <template v-else>
          <div class="text-12px text-[--tjg-text-tertiary]">{{ t('setting.push.history.desc') }}</div>

          <van-cell-group v-if="notifications.length > 0" inset>
            <van-cell
              v-for="(notif, index) in notifications"
              :key="notificationKey(notif, index)"
              data-testid="notification-row">
              <template #icon>
                <SettingCellIcon icon="mdi:bell-outline" color="var(--tjg-color-warning-500)" shell="warning" />
              </template>
              <template #title>
                <span class="text-14px">{{ getNotificationContent(notif, t('setting.push.history.no_content')) }}</span>
              </template>
              <template #label>
                <span v-if="notif.room_id" class="text-11px">{{ notif.room_id }}</span>
                <span v-if="formatNotificationTime(notif.ts)" class="ml-8px text-11px">
                  {{ formatNotificationTime(notif.ts) }}
                </span>
              </template>
              <template #right-icon>
                <span
                  v-if="isNotificationRead(notif)"
                  class="text-12px text-[--tjg-text-tertiary]"
                  data-testid="notification-read">
                  {{ t('setting.push.history.read') }}
                </span>
                <van-button
                  v-else
                  size="mini"
                  type="primary"
                  plain
                  :loading="ackingId === getNotificationId(notif)"
                  data-testid="notification-ack"
                  @click="handleAck(notif)">
                  {{ t('setting.push.history.mark_read') }}
                </van-button>
              </template>
            </van-cell>
          </van-cell-group>

          <van-empty v-else :description="t('setting.push.history.empty')" data-testid="notification-empty" />
        </template>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import SettingCellIcon from '@/mobile/components/my/SettingCellIcon.vue'
import { matrixNotificationService } from '@/services/matrix/notifications/MatrixNotificationService'
import {
  formatNotificationTime,
  getNotificationContent,
  getNotificationId,
  isNotificationRead,
  notificationKey
} from '@/services/matrix/notifications/notificationHistoryPresentation'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileNotificationHistory')
const { t } = useI18n()

const loading = ref(true)
const notifications = ref<Array<Record<string, unknown>>>([])
const ackingId = ref<string | null>(null)

onMounted(load)

async function load() {
  try {
    const result = await matrixNotificationService.getNotifications(undefined, 30)
    notifications.value = result.notifications
  } catch (error) {
    logger.error('Failed to load notifications', error)
    showToast({ type: 'fail', message: t('mobile_push.load_failed') })
  } finally {
    loading.value = false
  }
}

/**
 * 标记已读。
 *
 * ⚠️ ack 端点只认 `notification_id`（用 `event_id` 会 400），且**不会把条目从列表里移除**，
 * 只在服务端置 `read=true`。所以这里必须同步改本地状态，否则用户点完看不到任何变化。
 */
async function handleAck(notif: Record<string, unknown>) {
  const notificationId = getNotificationId(notif)
  const roomId = typeof notif.room_id === 'string' ? notif.room_id : ''
  const eventId = typeof notif.event_id === 'string' ? notif.event_id : ''

  if (notificationId === null || !roomId || !eventId) {
    showToast(t('setting.push.history.ack_unavailable'))
    return
  }
  if (ackingId.value) return

  ackingId.value = notificationId
  try {
    const ok = await matrixNotificationService.ackNotificationWithFallback(notificationId, roomId, eventId)
    if (!ok) {
      showToast({ type: 'fail', message: t('setting.push.history.ack_failed') })
      return
    }
    notif.read = true
    showToast(t('setting.push.history.ack_success'))
  } catch (error) {
    logger.error('Failed to ack notification', error)
    showToast({ type: 'fail', message: t('setting.push.history.ack_failed') })
  } finally {
    ackingId.value = null
  }
}
</script>
