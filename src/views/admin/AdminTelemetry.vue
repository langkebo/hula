<template>
  <div class="admin-telemetry">
    <n-page-header :title="t('telemetry.title')" :subtitle="t('telemetry.subtitle')">
      <template #extra>
        <n-button :loading="loading" @click="loadAll">{{ t('common.refresh') }}</n-button>
      </template>
    </n-page-header>

    <n-alert v-if="unsupported" class="mt-16px" type="warning" :show-icon="false">
      <div class="telemetry-unavailable">
        <div>
          <div class="telemetry-unavailable-title">{{ t('telemetry.unavailable.title') }}</div>
          <div class="telemetry-unavailable-desc">{{ t('telemetry.unavailable.description') }}</div>
        </div>
        <n-button size="small" :loading="loading" @click="loadAll">
          {{ t('admin.availability.retry') }}
        </n-button>
      </div>
    </n-alert>

    <n-spin v-else :show="loading">
      <section class="telemetry-section">
        <h4 class="telemetry-section-title">{{ t('telemetry.section.status') }}</h4>
        <n-descriptions bordered :column="2" label-placement="left" size="small">
          <n-descriptions-item :label="t('telemetry.status.enabled')">
            <n-tag :type="onOffTag(status?.enabled)" size="small">{{ onOffLabel(status?.enabled) }}</n-tag>
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.status.health')">
            <n-tag :type="healthTagType" size="small">{{ health?.status ?? '-' }}</n-tag>
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.status.trace')">
            <n-tag :type="onOffTag(status?.trace_enabled)" size="small">{{ onOffLabel(status?.trace_enabled) }}</n-tag>
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.status.metrics')">
            <n-tag :type="onOffTag(status?.metrics_enabled)" size="small">
              {{ onOffLabel(status?.metrics_enabled) }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.status.service')">
            {{ status?.service_name ?? '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.status.version')">
            {{ status?.service_version ?? '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.status.sampling')">
            {{ formatRatio(status?.sampling_ratio) }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.status.batch')">
            <n-tag :type="onOffTag(status?.export_config?.batch_export)" size="small">
              {{ onOffLabel(status?.export_config?.batch_export) }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.status.otlp')">
            {{ status?.export_config?.otlp_endpoint ?? t('telemetry.status.none') }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.status.prometheus')">
            {{ prometheusLabel }}
          </n-descriptions-item>
        </n-descriptions>
      </section>

      <section class="telemetry-section">
        <h4 class="telemetry-section-title">{{ t('telemetry.section.metrics') }}</h4>
        <n-descriptions bordered :column="3" label-placement="left" size="small">
          <n-descriptions-item :label="t('telemetry.metrics.total')">
            {{ metrics?.total_metrics ?? '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.metrics.counters')">
            {{ metrics?.total_counters ?? '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.metrics.gauges')">
            {{ metrics?.total_gauges ?? '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.metrics.histograms')">
            {{ metrics?.total_histograms ?? '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.metrics.rendered')">
            {{ metrics?.rendered_bytes ?? '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('telemetry.metrics.snapshot')">
            {{ formatTs(metrics?.snapshot_ts) }}
          </n-descriptions-item>
        </n-descriptions>

        <div v-if="metrics?.appservice_scheduler" class="telemetry-subsection">
          <h5 class="telemetry-subtitle">{{ t('telemetry.section.scheduler') }}</h5>
          <n-descriptions bordered :column="3" label-placement="left" size="small">
            <n-descriptions-item :label="t('telemetry.metrics.services')">
              {{ metrics.appservice_scheduler.total_services }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('telemetry.metrics.schedulerAvailable')">
              {{ metrics.appservice_scheduler.scheduler_available_services }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('telemetry.metrics.backoff')">
              {{ metrics.appservice_scheduler.services_in_backoff }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('telemetry.metrics.pendingEvents')">
              {{ metrics.appservice_scheduler.total_pending_events }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('telemetry.metrics.pendingTransactions')">
              {{ metrics.appservice_scheduler.total_pending_transactions }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('telemetry.metrics.success')">
              {{ metrics.appservice_scheduler.total_success_count }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('telemetry.metrics.failure')">
              {{ metrics.appservice_scheduler.total_failure_count }}
            </n-descriptions-item>
          </n-descriptions>
        </div>
      </section>

      <section class="telemetry-section">
        <h4 class="telemetry-section-title">{{ t('telemetry.section.alerts') }}</h4>
        <n-data-table
          :columns="alertColumns"
          :data="alerts"
          :bordered="false"
          :loading="loading"
          :pagination="false"
          :row-key="(row: TelemetryAlert) => row.alert_id"
          size="small" />
      </section>

      <section class="telemetry-section">
        <h4 class="telemetry-section-title">{{ t('telemetry.section.attributes') }}</h4>
        <n-descriptions v-if="attributeEntries.length > 0" bordered :column="2" label-placement="left" size="small">
          <n-descriptions-item v-for="[key, value] in attributeEntries" :key="key" :label="key">
            {{ value }}
          </n-descriptions-item>
        </n-descriptions>
        <n-empty v-else :description="t('telemetry.status.none')" size="small" class="py-16px" />
      </section>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import {
  type DataTableColumns,
  NAlert,
  NButton,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NPageHeader,
  NSpin,
  NTag,
  useDialog
} from 'naive-ui'
import { computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminTelemetry } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type {
  TelemetryAlert,
  TelemetryAlertSeverity,
  TelemetryAlertStatus
} from '@/services/matrix/admin/TelemetryService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminTelemetry')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const dialog = useDialog()

const { status, health, metrics, alerts, attributes, loading, ackLoading, unsupported, loadAll, acknowledge } =
  useAdminTelemetry()

const attributeEntries = computed(() => Object.entries(attributes.value))

const prometheusLabel = computed(() => {
  const config = status.value?.export_config
  if (!config?.prometheus_port) return t('telemetry.status.none')
  return config.prometheus_path ? `:${config.prometheus_port}${config.prometheus_path}` : `:${config.prometheus_port}`
})

const healthTagType = computed<'success' | 'warning' | 'default'>(() => {
  const value = health.value?.status
  if (!value) return 'default'
  return value === 'ok' || value === 'healthy' ? 'success' : 'warning'
})

function onOffLabel(value: boolean | undefined): string {
  return value ? t('telemetry.status.on') : t('telemetry.status.off')
}

function onOffTag(value: boolean | undefined): 'success' | 'default' {
  return value ? 'success' : 'default'
}

function formatRatio(ratio?: number): string {
  if (typeof ratio !== 'number') return '-'
  return `${Math.round(ratio * 100)}%`
}

function formatTs(ts?: number | null): string {
  if (!ts) return '-'
  return new Date(ts > 1e12 ? ts : ts * 1000).toLocaleString()
}

function severityLabel(severity: TelemetryAlertSeverity): string {
  switch (severity) {
    case 'info':
      return t('telemetry.severity.info')
    case 'warning':
      return t('telemetry.severity.warning')
    case 'high':
      return t('telemetry.severity.high')
    default:
      return t('telemetry.severity.critical')
  }
}

function severityTagType(severity: TelemetryAlertSeverity): 'info' | 'warning' | 'error' {
  switch (severity) {
    case 'info':
      return 'info'
    case 'warning':
      return 'warning'
    default:
      return 'error'
  }
}

function alertStatusLabel(alertStatus: TelemetryAlertStatus): string {
  switch (alertStatus) {
    case 'firing':
      return t('telemetry.alert_status.firing')
    case 'acknowledged':
      return t('telemetry.alert_status.acknowledged')
    case 'recovered':
      return t('telemetry.alert_status.recovered')
    default:
      return t('telemetry.alert_status.closed')
  }
}

function alertStatusTagType(alertStatus: TelemetryAlertStatus): 'error' | 'success' | 'default' {
  switch (alertStatus) {
    case 'firing':
      return 'error'
    case 'acknowledged':
      return 'success'
    default:
      return 'default'
  }
}

function confirmAcknowledge(alert: TelemetryAlert) {
  dialog.warning({
    title: t('telemetry.alerts.ack_title'),
    content: t('telemetry.alerts.ack_content'),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await acknowledge(alert.alert_id)
        showFeedback(t('telemetry.alerts.ack_success'), 'success')
      } catch (err) {
        logger.error('Failed to acknowledge telemetry alert:', err)
        showFeedback(t('telemetry.alerts.ack_failed'), 'error')
      }
    }
  })
}

const alertColumns: DataTableColumns<TelemetryAlert> = [
  { title: t('telemetry.alerts.col_rule'), key: 'rule_name', width: 180, ellipsis: { tooltip: true } },
  {
    title: t('telemetry.alerts.col_severity'),
    key: 'severity',
    width: 100,
    render: (row) => h(NTag, { size: 'small', type: severityTagType(row.severity) }, () => severityLabel(row.severity))
  },
  {
    title: t('telemetry.alerts.col_status'),
    key: 'status',
    width: 110,
    render: (row) =>
      h(NTag, { size: 'small', type: alertStatusTagType(row.status) }, () => alertStatusLabel(row.status))
  },
  { title: t('telemetry.alerts.col_message'), key: 'message', ellipsis: { tooltip: true } },
  {
    title: t('telemetry.alerts.col_triggered'),
    key: 'triggered_at',
    width: 170,
    render: (row) => formatTs(row.triggered_at)
  },
  {
    title: t('telemetry.alerts.col_actions'),
    key: 'actions',
    width: 110,
    render: (row) =>
      h(
        NButton,
        {
          size: 'small',
          disabled: row.status !== 'firing',
          loading: ackLoading.value,
          onClick: () => confirmAcknowledge(row)
        },
        () => t('telemetry.alerts.ack')
      )
  }
]

onMounted(() => {
  void loadAll()
})
</script>

<style scoped>
.admin-telemetry {
  padding: 16px 24px;
}

.telemetry-section {
  margin-top: 20px;
}

.telemetry-section-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.telemetry-subsection {
  margin-top: 14px;
}

.telemetry-subtitle {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.telemetry-unavailable {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.telemetry-unavailable-title {
  font-weight: 600;
}

.telemetry-unavailable-desc {
  margin-top: 4px;
  font-size: 12px;
  opacity: 0.8;
}
</style>
