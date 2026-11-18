<template>
  <!-- 服务端媒体配额：与上面「本机浏览器存储」是两件事，这里才是账号在服务器上的占用 -->
  <van-cell-group :title="t('mobile_storage.server_quota_section')" inset data-testid="server-quota-group">
    <template v-if="state === 'available'">
      <van-cell
        :title="t('mobile_storage.server_quota_used')"
        :value="formatBytes(used)"
        data-testid="server-quota-used" />
      <van-cell :title="t('mobile_storage.server_quota_limit')" :value="formatBytes(limit)" />
      <van-cell :title="t('mobile_storage.server_quota_remaining')" :value="formatBytes(remaining)" />
      <van-cell
        v-if="mediaCount === null"
        :title="t('mobile_storage.server_quota_media_count')"
        :value="t('mobile_storage.server_quota_partial')"
        :label="t('mobile_storage.server_quota_partial_desc')" />
      <van-cell v-else :title="t('mobile_storage.server_quota_media_count')" :value="String(mediaCount)" />
      <van-cell v-if="exceeded" data-testid="server-quota-exceeded">
        <template #title>
          <span class="text-[--tjg-color-danger-500]">{{ t('mobile_storage.server_quota_exceeded') }}</span>
        </template>
      </van-cell>
      <van-cell
        :title="t('mobile_storage.server_quota_alerts')"
        :value="
          alertsUnavailable
            ? t('mobile_storage.server_quota_alerts_unavailable')
            : alerts.length
              ? t('mobile_storage.server_quota_alert_count', { count: alerts.length })
              : t('mobile_storage.server_quota_no_alerts')
        "
        :data-testid="alertsUnavailable ? 'server-quota-alerts-unavailable' : undefined" />
      <van-cell v-for="alert in alerts" :key="alert.alert_id" data-testid="server-quota-alert">
        <template #title>
          <div class="flex flex-col gap-4px">
            <span class="flex items-center gap-6px">
              <span>{{ alert.message }}</span>
              <span
                v-if="!alert.is_read"
                class="text-12px px-4px rounded border border-[--tjg-color-warning-500] text-[--tjg-color-warning-500]"
                data-testid="server-quota-alert-unread">
                {{ t('mobile_storage.server_quota_alert_unread') }}
              </span>
            </span>
            <span class="text-12px text-[--tjg-text-tertiary]">{{ alertMeta(alert) }}</span>
          </div>
        </template>
      </van-cell>
    </template>
    <van-cell v-else-if="state === 'loading'" :title="t('mobile_storage.server_quota_loading')" />
    <van-cell v-else :title="t('mobile_storage.server_quota_unavailable')">
      <template #right-icon>
        <van-button size="mini" type="primary" plain data-testid="server-quota-retry" @click="emit('retry')">
          {{ t('common.retry') }}
        </van-button>
      </template>
    </van-cell>
  </van-cell-group>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { formatBytes } from '@/utils/Formatting'
import type { ServerQuotaAlert, ServerQuotaState } from '../composables/useServerQuota'

defineProps<{
  state: ServerQuotaState
  used: number
  limit: number
  remaining: number
  mediaCount: number | null
  alerts: ServerQuotaAlert[]
  alertsUnavailable: boolean
  exceeded: boolean
  alertMeta: (alert: ServerQuotaAlert) => string
}>()

const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
</script>
