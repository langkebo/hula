<script setup lang="ts">
import { NAlert, NButton, NProgress, NTag } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminStatCard from '@/components/admin/AdminStatCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useQuotaStore } from '@/stores/domains/admin/quota'
import { formatBytes } from '@/utils/Formatting'

const { t } = useI18n()
const quotaStore = useQuotaStore()
const { quotaStatus, quotaStats, alerts, serverQuota, loading, error, alertsError, quotaPercentage, isExceeded } =
  storeToRefs(quotaStore)

/** 进度条不能超过 100%，超限状态由标签文案表达（不依赖颜色） */
const progressPercentage = computed(() => Math.min(100, Math.max(0, Math.round(quotaPercentage.value))))

const quotaState = computed<'exceeded' | 'warning' | 'normal'>(() => {
  if (isExceeded.value) return 'exceeded'
  if (progressPercentage.value >= 80) return 'warning'
  return 'normal'
})

const progressStatus = computed(() => {
  switch (quotaState.value) {
    case 'exceeded':
      return 'error' as const
    case 'warning':
      return 'warning' as const
    default:
      return 'success' as const
  }
})

const tagType = computed(() => {
  switch (quotaState.value) {
    case 'exceeded':
      return 'error' as const
    case 'warning':
      return 'warning' as const
    default:
      return 'success' as const
  }
})

const stateLabel = computed(() => t(`admin.media.quota.state.${quotaState.value}`))

const usageText = computed(() => {
  const status = quotaStatus.value
  if (!status) return ''
  return t('admin.media.quota.usage', {
    used: formatBytes(status.used),
    limit: formatBytes(status.limit),
    percent: Math.round(status.percentage)
  })
})

const remainingText = computed(() => {
  const status = quotaStatus.value
  if (!status) return ''
  return t('admin.media.quota.remaining', { remaining: formatBytes(status.remaining) })
})

const hasServerQuota = computed(() => serverQuota.value !== null)

/** 无配额告警且读取成功时，才展示「暂无告警」空态 */
const isEmptyAlerts = computed(() => alerts.value.length === 0 && !alertsError.value)

function formatAlertTime(createdTs: number): string {
  if (!createdTs) return ''
  return new Date(createdTs).toLocaleString()
}

function alertTypeLabel(type: 'quota_warning' | 'quota_exceeded'): string {
  return type === 'quota_exceeded'
    ? t('admin.media.quota.alertType.exceeded')
    : t('admin.media.quota.alertType.warning')
}

function handleRefresh(): void {
  void quotaStore.fetchAllQuota()
}

onMounted(() => {
  void quotaStore.fetchAllQuota()
})
</script>

<template>
  <div class="media-quota-panel">
    <div class="media-quota-panel__header">
      <div>
        <h3 class="media-quota-panel__title">{{ t('admin.media.quota.title') }}</h3>
        <p class="media-quota-panel__description">{{ t('admin.media.quota.description') }}</p>
      </div>
      <n-button size="small" :loading="loading" data-test="quota-refresh" @click="handleRefresh">
        {{ t('admin.media.quota.refresh') }}
      </n-button>
    </div>

    <n-alert v-if="error" type="error" class="mb-12px" :title="t('admin.media.quota.loadFailed')">
      {{ error }}
    </n-alert>

    <div class="media-quota-panel__stats">
      <admin-stat-card
        v-if="quotaStats"
        data-test="quota-stat-storage"
        :label="t('admin.media.quota.storageUsed')"
        :value="formatBytes(quotaStats.storageBytes)"
        icon="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Zm0 0v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7" />
      <admin-stat-card
        v-if="quotaStats"
        data-test="quota-stat-count"
        :label="t('admin.media.quota.mediaCount')"
        :value="quotaStats.mediaCount"
        icon="M4 5h16v14H4zM4 15l4-4 4 4 3-3 5 5"
        color="var(--tjg-color-info-500)" />
      <admin-stat-card
        v-if="hasServerQuota"
        data-test="quota-stat-server-size"
        :label="t('admin.media.quota.serverSize')"
        :value="formatBytes(serverQuota?.totalSize ?? 0)"
        icon="M4 6h16v5H4zM4 13h16v5H4zM7 8.5h.01M7 15.5h.01"
        color="var(--tjg-color-warning-500)" />
      <admin-stat-card
        v-if="hasServerQuota"
        data-test="quota-stat-server-count"
        :label="t('admin.media.quota.serverCount')"
        :value="serverQuota?.totalCount ?? 0"
        icon="M7 4h10l3 3v13H4V4h3zm0 5h10M8 13h8M8 17h5"
        color="var(--tjg-color-success-500)" />
    </div>

    <div v-if="quotaStatus" class="media-quota-panel__card" data-test="quota-status">
      <div class="media-quota-panel__row">
        <span class="media-quota-panel__label">{{ t('admin.media.quota.myQuota') }}</span>
        <n-tag :type="tagType" size="small" data-test="quota-state-label">{{ stateLabel }}</n-tag>
      </div>
      <n-progress
        type="line"
        :percentage="progressPercentage"
        :status="progressStatus"
        :show-indicator="false"
        data-test="quota-progress" />
      <div class="media-quota-panel__meta">
        <span data-test="quota-usage">{{ usageText }}</span>
        <span data-test="quota-remaining">{{ remainingText }}</span>
      </div>
    </div>
    <EmptyState v-else compact :description="t('admin.media.quota.noStatus')" data-test="quota-status-empty" />

    <div v-if="hasServerQuota" class="media-quota-panel__card" data-test="quota-server-defaults">
      <span class="media-quota-panel__label">{{ t('admin.media.quota.serverDefaults') }}</span>
      <div class="media-quota-panel__meta">
        <span>
          {{ t('admin.media.quota.defaultSizeLimit', { size: formatBytes(serverQuota?.defaultSizeLimit ?? 0) }) }}
        </span>
        <span>
          {{ t('admin.media.quota.defaultCountLimit', { count: serverQuota?.defaultCountLimit ?? 0 }) }}
        </span>
      </div>
    </div>

    <div class="media-quota-panel__alerts" data-test="quota-alerts">
      <div class="media-quota-panel__row">
        <span class="media-quota-panel__label">{{ t('admin.media.quota.alerts') }}</span>
        <span class="media-quota-panel__hint">{{ t('admin.media.quota.alertHint') }}</span>
      </div>
      <n-alert v-if="alertsError" type="warning" :show-icon="false" class="mb-8px" data-test="quota-alerts-error">
        {{ t('admin.media.quota.alertsUnavailable') }}
      </n-alert>
      <EmptyState
        v-else-if="isEmptyAlerts"
        compact
        :description="t('admin.media.quota.noAlerts')"
        data-test="quota-alerts-empty" />
      <ul v-else class="media-quota-panel__alert-list">
        <li v-for="alert in alerts" :key="alert.alert_id" class="media-quota-panel__alert-item">
          <n-tag :type="alert.alert_type === 'quota_exceeded' ? 'error' : 'warning'" size="small">
            {{ alertTypeLabel(alert.alert_type) }}
          </n-tag>
          <span class="media-quota-panel__alert-message">{{ alert.message }}</span>
          <time class="media-quota-panel__alert-time">{{ formatAlertTime(alert.created_ts) }}</time>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.media-quota-panel {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-4);
  padding-top: 8px;
}

.media-quota-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tjg-space-4);
}

.media-quota-panel__title {
  margin: 0;
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-semibold);
  color: var(--tjg-text-primary);
}

.media-quota-panel__description {
  margin: 4px 0 0;
  font-size: var(--tjg-font-size-md);
  color: var(--tjg-text-tertiary);
}

.media-quota-panel__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--tjg-space-4);
}

.media-quota-panel__card,
.media-quota-panel__alerts {
  padding: var(--tjg-space-4);
  background: var(--tjg-admin-card-bg);
  border: 1px solid var(--tjg-border-muted);
  border-radius: var(--tjg-radius-lg);
}

.media-quota-panel__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
  margin-bottom: var(--tjg-space-3);
}

.media-quota-panel__label {
  font-size: var(--tjg-font-size-md);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.media-quota-panel__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--tjg-space-3);
  margin-top: var(--tjg-space-2);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
}

.media-quota-panel__hint {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.media-quota-panel__alert-list {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.media-quota-panel__alert-item {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  font-size: var(--tjg-font-size-md);
  color: var(--tjg-text-secondary);
}

.media-quota-panel__alert-message {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-quota-panel__alert-time {
  flex-shrink: 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}
</style>
