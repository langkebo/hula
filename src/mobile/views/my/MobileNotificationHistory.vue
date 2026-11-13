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
          <div class="flex items-center justify-between">
            <div class="text-12px text-[--tjg-text-tertiary]">{{ t('setting.push.history.desc') }}</div>
            <van-button
              v-if="hasUnread"
              size="mini"
              type="primary"
              plain
              :loading="ackingAll"
              data-testid="notification-ack-all"
              @click="handleAckAll">
              {{ t('setting.push.history.mark_all_read') }}
            </van-button>
          </div>

          <van-cell-group v-if="notifications.length > 0" inset>
            <van-cell
              v-for="(notif, index) in notifications"
              :key="notificationKey(notif, index)"
              clickable
              data-testid="notification-row"
              @click="openRoom(notif)">
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
                  @click.stop="handleAck(notif)">
                  {{ t('setting.push.history.mark_read') }}
                </van-button>
              </template>
            </van-cell>
          </van-cell-group>

          <van-button
            v-if="nextToken"
            block
            plain
            :loading="loadingMore"
            data-testid="notification-load-more"
            @click="loadMore">
            {{ t('mobile_push.load_more') }}
          </van-button>

          <van-empty
            v-if="notifications.length === 0"
            :description="t('setting.push.history.empty')"
            data-testid="notification-empty" />
        </template>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
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
const router = useRouter()

const loading = ref(true)
const loadingMore = ref(false)
const notifications = ref<Array<Record<string, unknown>>>([])
const nextToken = ref<string | undefined>()
const ackingId = ref<string | null>(null)
const ackingAll = ref(false)

const hasUnread = computed(() => notifications.value.some((notif) => !isNotificationRead(notif)))

onMounted(load)

async function load() {
  try {
    const result = await matrixNotificationService.getNotifications(undefined, 30)
    notifications.value = result.notifications
    nextToken.value = result.next_token
  } catch (error) {
    logger.error('Failed to load notifications', error)
    showToast({ type: 'fail', message: t('mobile_push.load_failed') })
  } finally {
    loading.value = false
  }
}

/**
 * 加载下一页通知。服务端通过 `next_token` 游标分页，首页之外必须带上游标，
 * 否则永远只能看到最近 30 条。
 */
async function loadMore() {
  if (loadingMore.value || !nextToken.value) return
  loadingMore.value = true
  try {
    const result = await matrixNotificationService.getNotifications(nextToken.value, 30)
    notifications.value = [...notifications.value, ...result.notifications]
    nextToken.value = result.next_token
  } catch (error) {
    logger.error('Failed to load more notifications', error)
    showToast({ type: 'fail', message: t('mobile_push.load_failed') })
  } finally {
    loadingMore.value = false
  }
}

/**
 * 标记单条已读。
 *
 * ⚠️ ack 端点只认 `notification_id`（用 `event_id` 会 400），且**不会把条目从列表里移除**，
 * 只在服务端置 `read=true`。所以这里必须同步改本地状态，否则用户点完看不到任何变化。
 */
async function handleAck(notif: Record<string, unknown>) {
  const target = resolveAckTarget(notif)
  if (target.notificationId === null || !target.roomId || !target.eventId) {
    showToast(t('setting.push.history.ack_unavailable'))
    return
  }
  if (ackingId.value) return

  ackingId.value = target.notificationId
  try {
    const ok = await ackOne(notif)
    if (!ok) {
      showToast({ type: 'fail', message: t('setting.push.history.ack_failed') })
      return
    }
    showToast(t('setting.push.history.ack_success'))
  } catch (error) {
    logger.error('Failed to ack notification', error)
    showToast({ type: 'fail', message: t('setting.push.history.ack_failed') })
  } finally {
    ackingId.value = null
  }
}

/**
 * 一键已读：只处理当前已加载且未读的条目。
 *
 * 服务端没有批量 ack 接口，这里串行逐条调用既有 `ackNotificationWithFallback`，
 * 避免并发触发限流；失败的条目保持未读并汇总提示。
 */
async function handleAckAll() {
  if (ackingAll.value) return
  const pending = notifications.value.filter((notif) => !isNotificationRead(notif))
  if (pending.length === 0) return

  ackingAll.value = true
  let failed = 0
  try {
    for (const notif of pending) {
      try {
        if (!(await ackOne(notif))) failed++
      } catch (error) {
        logger.error('Failed to ack notification', error)
        failed++
      }
    }
    if (failed === 0) {
      showToast(t('setting.push.history.ack_all_success'))
    } else {
      showToast({ type: 'fail', message: t('setting.push.history.ack_all_partial', { count: failed }) })
    }
  } finally {
    ackingAll.value = false
  }
}

function resolveAckTarget(notif: Record<string, unknown>) {
  return {
    notificationId: getNotificationId(notif),
    roomId: typeof notif.room_id === 'string' ? notif.room_id : '',
    eventId: typeof notif.event_id === 'string' ? notif.event_id : ''
  }
}

async function ackOne(notif: Record<string, unknown>): Promise<boolean> {
  const { notificationId, roomId, eventId } = resolveAckTarget(notif)
  if (notificationId === null || !roomId || !eventId) return false
  const result = await matrixNotificationService.ackNotificationWithFallback(notificationId, roomId, eventId)
  if (!result.success) return false
  notif.read = true
  return true
}

/** 点击通知进入对应会话；缺少 room_id 时忽略，避免跳到空路由。 */
function openRoom(notif: Record<string, unknown>) {
  const roomId = typeof notif.room_id === 'string' ? notif.room_id : ''
  if (!roomId) return
  void router.push({ name: 'mobileChatMain', params: { roomId } })
}
</script>
