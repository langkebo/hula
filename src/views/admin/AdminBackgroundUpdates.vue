<template>
  <div class="admin-background-updates">
    <n-page-header :title="t('background_updates.title')" :subtitle="t('background_updates.subtitle')">
      <template #extra>
        <n-space align="center">
          <span class="bu-auto-refresh-label">{{ t('background_updates.auto_refresh') }}</span>
          <n-switch :value="autoRefresh" size="small" @update:value="setAutoRefresh" />
          <n-button :disabled="(summary?.failed_count ?? 0) === 0" :loading="actionLoading" @click="confirmRetryFailed">
            {{ t('background_updates.actions.retry_failed') }}
          </n-button>
          <n-button :loading="actionLoading" @click="confirmCleanupLocks">
            {{ t('background_updates.actions.cleanup_locks') }}
          </n-button>
          <n-button :loading="loading" @click="loadAll">{{ t('common.refresh') }}</n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-alert v-if="summary?.current_update" class="mt-16px" type="info" :show-icon="false">
      {{ t('background_updates.current') }}: {{ summary.current_update.job_name }} ·
      {{ statusLabel(summary.current_update.status) }}
    </n-alert>

    <section class="bu-section">
      <h4 class="bu-section-title">{{ t('background_updates.section.summary') }}</h4>
      <n-descriptions bordered :column="5" label-placement="top" size="small">
        <n-descriptions-item :label="t('background_updates.summary.pending')">
          {{ summary?.pending_count ?? '-' }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('background_updates.summary.running')">
          {{ summary?.running_count ?? '-' }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('background_updates.summary.completed')">
          {{ summary?.completed_count ?? '-' }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('background_updates.summary.failed')">
          {{ summary?.failed_count ?? '-' }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('background_updates.summary.total')">
          {{ summary?.total_count ?? '-' }}
        </n-descriptions-item>
      </n-descriptions>
    </section>

    <section class="bu-section">
      <n-data-table
        :columns="columns"
        :data="updates"
        :loading="loading"
        :locale="{ emptyText: t('background_updates.empty') }"
        :pagination="{ pageSize: 20 }"
        :row-key="(row: BackgroundUpdate) => row.job_name"
        size="small"
        striped />
    </section>
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
  NPageHeader,
  NProgress,
  NSpace,
  NSwitch,
  NTag,
  useDialog
} from 'naive-ui'
import { h, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminBackgroundUpdates } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { BackgroundUpdate } from '@/services/matrix/admin/BackgroundUpdateService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminBackgroundUpdates')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const dialog = useDialog()

const {
  updates,
  summary,
  loading,
  actionLoading,
  autoRefresh,
  loadAll,
  startUpdate,
  cancelUpdate,
  retryFailed,
  cleanupLocks,
  setAutoRefresh,
  stopAutoRefresh
} = useAdminBackgroundUpdates()

function formatTs(ts?: number | null): string {
  if (!ts) return '-'
  return new Date(ts > 1e12 ? ts : ts * 1000).toLocaleString()
}

function statusLabel(value: string): string {
  switch (value) {
    case 'pending':
      return t('background_updates.status.pending')
    case 'running':
      return t('background_updates.status.running')
    case 'completed':
      return t('background_updates.status.completed')
    case 'failed':
      return t('background_updates.status.failed')
    case 'cancelled':
      return t('background_updates.status.cancelled')
    default:
      return t('background_updates.status.unknown')
  }
}

function statusTagType(value: string): 'default' | 'info' | 'success' | 'warning' | 'error' {
  switch (value) {
    case 'pending':
      return 'default'
    case 'running':
      return 'info'
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'cancelled':
      return 'warning'
    default:
      return 'default'
  }
}

function progressPercent(row: BackgroundUpdate): number {
  if (row.total_items > 0) {
    return Math.min(100, Math.round((row.processed_items / row.total_items) * 100))
  }
  return row.status === 'completed' ? 100 : 0
}

function confirmStart(row: BackgroundUpdate) {
  dialog.warning({
    title: t('background_updates.start_confirm_title'),
    content: t('background_updates.start_confirm_content', { job: row.job_name }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await startUpdate(row.job_name)
        showFeedback(t('background_updates.started_success'), 'success')
      } catch (err) {
        logger.error('Failed to start background update:', err)
        showFeedback(t('background_updates.start_failed'), 'error')
      }
    }
  })
}

function confirmCancel(row: BackgroundUpdate) {
  dialog.warning({
    title: t('background_updates.cancel_confirm_title'),
    content: t('background_updates.cancel_confirm_content', { job: row.job_name }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await cancelUpdate(row.job_name)
        showFeedback(t('background_updates.cancelled_success'), 'success')
      } catch (err) {
        logger.error('Failed to cancel background update:', err)
        showFeedback(t('background_updates.cancel_failed'), 'error')
      }
    }
  })
}

function confirmRetryFailed() {
  dialog.warning({
    title: t('background_updates.retry_confirm_title'),
    content: t('background_updates.retry_confirm_content'),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        const count = await retryFailed()
        showFeedback(t('background_updates.retried_success', { count }), 'success')
      } catch (err) {
        logger.error('Failed to retry failed background updates:', err)
        showFeedback(t('background_updates.retried_error'), 'error')
      }
    }
  })
}

function confirmCleanupLocks() {
  dialog.warning({
    title: t('background_updates.cleanup_confirm_title'),
    content: t('background_updates.cleanup_confirm_content'),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        const count = await cleanupLocks()
        showFeedback(t('background_updates.cleaned_success', { count }), 'success')
      } catch (err) {
        logger.error('Failed to clean up background update locks:', err)
        showFeedback(t('background_updates.cleaned_error'), 'error')
      }
    }
  })
}

function renderAction(row: BackgroundUpdate) {
  if (row.status === 'pending') {
    return h(NButton, { size: 'small', type: 'primary', onClick: () => confirmStart(row) }, () =>
      t('background_updates.actions.start')
    )
  }
  if (row.status === 'running') {
    return h(NButton, { size: 'small', type: 'warning', onClick: () => confirmCancel(row) }, () =>
      t('background_updates.actions.cancel')
    )
  }
  return h('span', '-')
}

const columns: DataTableColumns<BackgroundUpdate> = [
  { title: t('background_updates.col_job'), key: 'job_name', width: 200, ellipsis: { tooltip: true } },
  { title: t('background_updates.col_type'), key: 'job_type', width: 140, ellipsis: { tooltip: true } },
  {
    title: t('background_updates.col_status'),
    key: 'status',
    width: 110,
    render: (row) => h(NTag, { size: 'small', type: statusTagType(row.status) }, () => statusLabel(row.status))
  },
  {
    title: t('background_updates.col_progress'),
    key: 'progress',
    width: 200,
    render: (row) => h(NProgress, { type: 'line', percentage: progressPercent(row), height: 8, showIndicator: false })
  },
  {
    title: t('background_updates.col_created'),
    key: 'created_ts',
    width: 170,
    render: (row) => formatTs(row.created_ts)
  },
  {
    title: t('background_updates.col_actions'),
    key: 'actions',
    width: 100,
    render: (row) => renderAction(row)
  }
]

onMounted(() => {
  void loadAll()
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>

<style scoped>
.admin-background-updates {
  padding: 16px 24px;
}

.bu-section {
  margin-top: 20px;
}

.bu-section-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.bu-auto-refresh-label {
  font-size: 12px;
  color: var(--tjg-text-secondary);
}
</style>
