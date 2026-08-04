<template>
  <div class="admin-telemetry">
    <n-page-header :title="t('telemetry.title')" :subtitle="t('telemetry.subtitle')">
      <template #extra>
        <n-space align="center" :size="8">
          <n-select
            v-model:value="filterStatus"
            :options="statusOptions"
            :placeholder="t('telemetry.filters.status_placeholder')"
            size="small"
            clearable
            data-testid="filter-status"
            style="width: 140px"
            @update:value="reloadAlerts" />
          <n-select
            v-model:value="filterSeverity"
            :options="severityOptions"
            :placeholder="t('telemetry.filters.severity_placeholder')"
            size="small"
            clearable
            data-testid="filter-severity"
            style="width: 140px"
            @update:value="reloadAlerts" />
          <n-button data-testid="refresh-btn" :loading="loading" @click="loadAll">
            {{ t('telemetry.actions.refresh') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-card :title="t('telemetry.status.title')" size="small" class="mt-16px">
      <div v-if="loading" class="card-loading">
        <n-spin size="small" />
      </div>
      <n-descriptions v-else-if="status" :column="3" size="small" bordered>
        <n-descriptions-item :label="t('telemetry.status.enabled')">
          <n-tag size="small" :type="status.enabled ? 'success' : 'default'">
            {{ status.enabled ? t('telemetry.common.yes') : t('telemetry.common.no') }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.status.trace_enabled')">
          <n-tag size="small" :type="status.trace_enabled ? 'success' : 'default'">
            {{ status.trace_enabled ? t('telemetry.common.yes') : t('telemetry.common.no') }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.status.metrics_enabled')">
          <n-tag size="small" :type="status.metrics_enabled ? 'success' : 'default'">
            {{ status.metrics_enabled ? t('telemetry.common.yes') : t('telemetry.common.no') }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.status.service_name')">
          {{ status.service_name }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.status.service_version')">
          {{ status.service_version }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.status.sampling_ratio')">
          {{ status.sampling_ratio.toFixed(4) }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.status.otlp_endpoint')">
          {{ status.export_config.otlp_endpoint ?? '-' }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.status.prometheus_port')">
          {{ status.export_config.prometheus_port ?? '-' }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.status.batch_export')">
          <n-tag size="small" :type="status.export_config.batch_export ? 'info' : 'default'">
            {{ status.export_config.batch_export ? t('telemetry.common.yes') : t('telemetry.common.no') }}
          </n-tag>
        </n-descriptions-item>
      </n-descriptions>
      <n-empty v-else :description="t('telemetry.status.empty')" size="small" />
    </n-card>

    <n-card :title="t('telemetry.metrics.title')" size="small" class="mt-16px">
      <div v-if="loading" class="card-loading">
        <n-spin size="small" />
      </div>
      <n-descriptions v-else-if="metrics" :column="3" size="small" bordered>
        <n-descriptions-item :label="t('telemetry.metrics.total_metrics')">
          <n-tag size="small">{{ metrics.total_metrics }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.metrics.total_counters')">
          <n-tag size="small" type="info">{{ metrics.total_counters }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.metrics.total_gauges')">
          <n-tag size="small" type="success">{{ metrics.total_gauges }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.metrics.total_histograms')">
          <n-tag size="small" type="warning">{{ metrics.total_histograms }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.metrics.rendered_bytes')">
          {{ formatBytes(metrics.rendered_bytes) }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.metrics.snapshot_ts')">
          {{ formatTimestamp(metrics.snapshot_ts) }}
        </n-descriptions-item>
      </n-descriptions>
      <n-empty v-else :description="t('telemetry.metrics.empty')" size="small" />
    </n-card>

    <n-card v-if="metrics?.appservice_scheduler" :title="t('telemetry.scheduler.title')" size="small" class="mt-16px">
      <n-descriptions :column="3" size="small" bordered>
        <n-descriptions-item :label="t('telemetry.scheduler.total_services')">
          {{ metrics.appservice_scheduler.total_services }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.scheduler.available_services')">
          <n-tag size="small" type="success">{{ metrics.appservice_scheduler.scheduler_available_services }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.scheduler.in_backoff')">
          <n-tag size="small" type="warning">{{ metrics.appservice_scheduler.services_in_backoff }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.scheduler.capacity_limited')">
          <n-tag size="small" type="warning">{{ metrics.appservice_scheduler.services_capacity_limited }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.scheduler.pending_events')">
          {{ metrics.appservice_scheduler.total_pending_events }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.scheduler.pending_transactions')">
          {{ metrics.appservice_scheduler.total_pending_transactions }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.scheduler.success_count')">
          <n-tag size="small" type="success">{{ metrics.appservice_scheduler.total_success_count }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.scheduler.failure_count')">
          <n-tag size="small" type="error">{{ metrics.appservice_scheduler.total_failure_count }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('telemetry.scheduler.in_flight')">
          {{ metrics.appservice_scheduler.total_in_flight_count }}
        </n-descriptions-item>
      </n-descriptions>
    </n-card>

    <n-card :title="t('telemetry.alerts.title')" size="small" class="mt-16px">
      <template #header-extra>
        <n-space :size="8">
          <n-tag v-if="alerts.length > 0" size="small" type="warning" data-testid="alerts-count">
            {{ t('telemetry.alerts.count', { count: alerts.length }) }}
          </n-tag>
        </n-space>
      </template>
      <div v-if="alertsLoading" class="card-loading">
        <n-spin size="small" />
      </div>
      <n-empty v-else-if="alerts.length === 0" :description="t('telemetry.alerts.empty')" size="small" />
      <div v-else class="alerts-table">
        <div class="table-row table-header">
          <div class="table-cell">{{ t('telemetry.alerts.severity') }}</div>
          <div class="table-cell">{{ t('telemetry.alerts.rule_name') }}</div>
          <div class="table-cell">{{ t('telemetry.alerts.status') }}</div>
          <div class="table-cell">{{ t('telemetry.alerts.message') }}</div>
          <div class="table-cell">{{ t('telemetry.alerts.trigger_count') }}</div>
          <div class="table-cell">{{ t('telemetry.alerts.triggered_at') }}</div>
          <div class="table-cell">{{ t('telemetry.alerts.last_seen_ts') }}</div>
          <div class="table-cell">{{ t('telemetry.alerts.actions') }}</div>
        </div>
        <div v-for="alert in alerts" :key="alert.alert_id" class="table-row">
          <div class="table-cell">
            <n-tag size="small" :type="severityTagType(alert.severity)">{{ alert.severity }}</n-tag>
          </div>
          <div class="table-cell" :title="alert.rule_name">{{ alert.rule_name }}</div>
          <div class="table-cell">
            <n-tag size="small" :type="alertStatusTagType(alert.status)">{{ alert.status }}</n-tag>
          </div>
          <div class="table-cell" :title="alert.message">{{ alert.message }}</div>
          <div class="table-cell">{{ alert.trigger_count }}</div>
          <div class="table-cell">{{ formatTimestamp(alert.triggered_at) }}</div>
          <div class="table-cell">{{ formatTimestamp(alert.last_seen_ts) }}</div>
          <div class="table-cell">
            <n-button
              v-if="alert.status === 'firing'"
              size="tiny"
              type="primary"
              secondary
              :loading="actionLoading === `ack:${alert.alert_id}`"
              :disabled="actionLoading !== null"
              data-testid="ack-btn"
              @click="handleAcknowledge(alert.alert_id)">
              {{ t('telemetry.alerts.acknowledge') }}
            </n-button>
            <span v-else-if="alert.status === 'acknowledged' && alert.acknowledged_by">
              {{ alert.acknowledged_by }}
            </span>
            <span v-else>-</span>
          </div>
        </div>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import {
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NPageHeader,
  NSelect,
  NSpace,
  NSpin,
  NTag
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { adminService } from '@/services/matrix/admin'
import type {
  TelemetryAlert,
  TelemetryAlertSeverity,
  TelemetryAlertStatus,
  TelemetryMetricsSummary,
  TelemetryStatus
} from '@/services/matrix/admin/TelemetryService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminTelemetry')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loading = ref(false)
const alertsLoading = ref(false)
const actionLoading = ref<string | null>(null)

const status = ref<TelemetryStatus | null>(null)
const metrics = ref<TelemetryMetricsSummary | null>(null)
const alerts = ref<TelemetryAlert[]>([])

const filterStatus = ref<TelemetryAlertStatus | null>(null)
const filterSeverity = ref<TelemetryAlertSeverity | null>(null)

const statusOptions = computed(() => [
  { label: t('telemetry.alerts.status_firing'), value: 'firing' },
  { label: t('telemetry.alerts.status_acknowledged'), value: 'acknowledged' },
  { label: t('telemetry.alerts.status_recovered'), value: 'recovered' },
  { label: t('telemetry.alerts.status_closed'), value: 'closed' }
])

const severityOptions = computed(() => [
  { label: t('telemetry.alerts.severity_info'), value: 'info' },
  { label: t('telemetry.alerts.severity_warning'), value: 'warning' },
  { label: t('telemetry.alerts.severity_high'), value: 'high' },
  { label: t('telemetry.alerts.severity_critical'), value: 'critical' }
])

const formatTimestamp = (ts?: number | null): string => {
  if (!ts) return '-'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts)
  }
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

const severityTagType = (severity: TelemetryAlertSeverity): 'default' | 'info' | 'warning' | 'error' => {
  switch (severity) {
    case 'critical':
      return 'error'
    case 'high':
      return 'error'
    case 'warning':
      return 'warning'
    default:
      return 'info'
  }
}

const alertStatusTagType = (
  alertStatus: TelemetryAlertStatus
): 'default' | 'info' | 'success' | 'warning' | 'error' => {
  switch (alertStatus) {
    case 'firing':
      return 'error'
    case 'acknowledged':
      return 'warning'
    case 'recovered':
      return 'success'
    default:
      return 'default'
  }
}

async function loadStatus() {
  try {
    status.value = await adminService.telemetry.getStatus()
  } catch (err) {
    logger.error('加载遥测状态失败:', err)
  }
}

async function loadMetrics() {
  try {
    metrics.value = await adminService.telemetry.getMetricsSummary()
  } catch (err) {
    logger.error('加载指标摘要失败:', err)
  }
}

async function loadAlerts() {
  alertsLoading.value = true
  try {
    alerts.value = await adminService.telemetry.listAlerts({
      status: filterStatus.value ?? undefined,
      severity: filterSeverity.value ?? undefined,
      refresh: true
    })
  } catch (err) {
    logger.error('加载告警列表失败:', err)
    alerts.value = []
  } finally {
    alertsLoading.value = false
  }
}

async function loadAll() {
  loading.value = true
  try {
    await Promise.allSettled([loadStatus(), loadMetrics(), loadAlerts()])
  } finally {
    loading.value = false
  }
}

async function reloadAlerts() {
  await loadAlerts()
}

async function handleAcknowledge(alertId: string) {
  actionLoading.value = `ack:${alertId}`
  try {
    const updated = await adminService.telemetry.acknowledgeAlert(alertId)
    const idx = alerts.value.findIndex((a) => a.alert_id === alertId)
    if (idx >= 0) {
      alerts.value[idx] = updated
    }
    showFeedback(t('telemetry.feedback.ack_success'), 'success')
  } catch (err) {
    logger.error('确认告警失败:', err)
    showFeedback(t('telemetry.feedback.ack_failed'), 'error')
  } finally {
    actionLoading.value = null
  }
}

onMounted(() => {
  void loadAll()
})
</script>

<style scoped>
.admin-telemetry {
  padding: 16px 24px;
}

.card-loading {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.alerts-table {
  display: flex;
  flex-direction: column;
  font-size: 12px;
}

.table-row {
  display: grid;
  grid-template-columns: 0.9fr 1.4fr 1fr 2fr 0.7fr 1.3fr 1.3fr 1.2fr;
  gap: 8px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--tjg-border-layout-divider);
  align-items: center;
}

.table-row:last-child {
  border-bottom: none;
}

.table-header {
  font-weight: 600;
  color: var(--tjg-text-secondary);
  border-bottom: 2px solid var(--tjg-border-layout-divider);
}

.table-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
