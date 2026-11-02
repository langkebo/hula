<template>
  <n-space vertical size="large">
    <n-space>
      <n-statistic
        data-testid="event-report-stat-total"
        :label="t('moderation.event_reports.stats.total')"
        :value="eventReportStats.total" />
      <n-statistic :label="t('moderation.event_reports.stats.open')" :value="eventReportStats.open" />
      <n-statistic :label="t('moderation.event_reports.stats.resolved')" :value="eventReportStats.resolved" />
      <n-statistic :label="t('moderation.event_reports.stats.dismissed')" :value="eventReportStats.dismissed" />
    </n-space>

    <n-space>
      <n-select
        :value="eventReportStatusFilter"
        data-testid="event-report-status-filter"
        :options="eventReportStatusOptions"
        :placeholder="t('moderation.filterByStatus')"
        class="w-[150px]"
        @update:value="handleEventReportFilterChange" />
      <n-button data-testid="event-report-refresh-btn" @click="loadEventReports">
        <template #icon>
          <Icon icon="ion:refresh-outline" />
        </template>
        {{ t('common.refresh') }}
      </n-button>
    </n-space>

    <n-data-table
      :columns="eventReportColumns"
      :data="eventReports"
      :loading="eventReportLoading"
      :row-key="(row: EventReport) => row.id" />
  </n-space>

  <n-modal :show="actionDialog.show" preset="dialog" :title="actionDialogTitle">
    <n-input
      data-testid="event-report-action-reason"
      v-model:value="actionDialog.reason"
      type="textarea"
      :rows="3"
      :placeholder="t('moderation.event_reports.dialog.reasonPlaceholder')" />
    <template #action>
      <n-space>
        <n-button data-testid="event-report-action-cancel" @click="closeActionDialog">
          {{ t('common.cancel') }}
        </n-button>
        <n-button data-testid="event-report-action-confirm" type="primary" @click="confirmAction">
          {{ t('common.confirm') }}
        </n-button>
      </n-space>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  type DataTableColumns,
  NButton,
  NDataTable,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NStatistic,
  useDialog
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { EventReport } from '@/services/matrix/admin/AdminTypes'
import { matrixEventReportService } from '@/services/matrix/moderation/MatrixEventReportService'
import type { ReportResponse } from '@/services/matrix/sdk'

defineOptions({
  name: 'ModerationEventReportTab'
})

const { t } = useI18n()
const dialog = useDialog()
const { showFeedback } = useActionFeedback()

const eventReports = ref<EventReport[]>([])
const eventReportStats = ref({ total: 0, open: 0, resolved: 0, dismissed: 0 })
const eventReportStatusFilter = ref<string | null>(null)
const eventReportLoading = ref(false)
const actionDialog = ref({ show: false, type: 'resolve' as 'resolve' | 'dismiss', reportId: 0, reason: '' })

const eventReportStatusOptions = computed(() => [
  { label: t('moderation.status.open'), value: 'open' },
  { label: t('moderation.status.resolved'), value: 'resolved' },
  { label: t('moderation.status.dismissed'), value: 'dismissed' }
])

const actionDialogTitle = computed(() =>
  actionDialog.value.type === 'resolve'
    ? t('moderation.event_reports.dialog.resolveTitle')
    : t('moderation.event_reports.dialog.dismissTitle')
)

const eventReportColumns = computed<DataTableColumns<EventReport>>(() => [
  { title: 'ID', key: 'id', width: 80 },
  { title: t('moderation.event_reports.table.event_id'), key: 'event_id', width: 200 },
  { title: t('moderation.event_reports.table.reporter'), key: 'reporter_user_id', width: 150 },
  { title: t('moderation.event_reports.table.reported_user'), key: 'reported_user_id', width: 150 },
  { title: t('moderation.event_reports.table.reason'), key: 'reason' },
  { title: t('moderation.event_reports.table.status'), key: 'status', width: 100 },
  {
    title: t('moderation.event_reports.table.actions'),
    key: 'actions',
    width: 320,
    render: (row) =>
      h(NSpace, null, {
        default: () => [
          h(
            NButton,
            {
              size: 'small',
              type: 'warning',
              'data-testid': 'event-report-action-escalate',
              onClick: () => handleEscalate(row.id)
            },
            { default: () => t('moderation.event_reports.actions.escalate') }
          ),
          h(
            NButton,
            {
              size: 'small',
              type: 'error',
              'data-testid': 'event-report-action-delete',
              onClick: () => handleDelete(row.id)
            },
            { default: () => t('moderation.event_reports.actions.delete') }
          ),
          h(
            NButton,
            {
              size: 'small',
              type: 'info',
              'data-testid': 'event-report-action-resolve',
              disabled: row.status === 'resolved',
              onClick: () => openActionDialog('resolve', row.id)
            },
            { default: () => t('moderation.event_reports.actions.resolve') }
          ),
          h(
            NButton,
            {
              size: 'small',
              'data-testid': 'event-report-action-dismiss',
              onClick: () => openActionDialog('dismiss', row.id)
            },
            { default: () => t('moderation.event_reports.actions.dismiss') }
          )
        ]
      })
  }
])

type ReportStatus = EventReport['status']

/** SDK 的 status 为开放字符串，收敛为 UI 支持的四种状态（未知值按 open 处理）。 */
function normalizeReportStatus(status: string): ReportStatus {
  switch (status) {
    case 'resolved':
    case 'dismissed':
    case 'escalated':
      return status
    default:
      return 'open'
  }
}

/** 把 SDK 的可选字段归一化为 UI 的必填结构，替代 `as EventReport[]` 断言。 */
function toEventReport(report: ReportResponse): EventReport {
  return {
    id: report.id,
    event_id: report.event_id,
    room_id: report.room_id,
    reporter_user_id: report.reporter_user_id,
    reported_user_id: report.reported_user_id ?? '',
    reason: report.reason ?? '',
    description: report.description ?? null,
    status: normalizeReportStatus(report.status),
    score: report.score,
    received_ts: report.received_ts,
    resolved_ts: report.resolved_ts ?? null,
    resolved_by: report.resolved_by ?? null,
    resolution_reason: report.resolution_reason ?? null
  }
}

async function loadEventReports(): Promise<boolean> {
  eventReportLoading.value = true
  try {
    const reports = eventReportStatusFilter.value
      ? await matrixEventReportService.getReportsByStatus(eventReportStatusFilter.value, { limit: 100 })
      : await matrixEventReportService.listReports({ limit: 100 })
    eventReports.value = reports.map(toEventReport)
    return true
  } catch {
    showFeedback(t('moderation.event_reports.loadFailed'), 'error')
    eventReports.value = []
    return false
  } finally {
    eventReportLoading.value = false
  }
}

async function loadEventReportStats() {
  try {
    // 旧裸调族: countAllEventReports 读 count 字段恒为 0 / countEventReportsByStatus 路径 404；
    // 现经 SDK manager（契约：count 返回 { total_reports }，status/count 返回 { count }）
    const [total, open, resolved, dismissed] = await Promise.all([
      matrixEventReportService.getReportsCount(),
      matrixEventReportService.getStatusCount('open'),
      matrixEventReportService.getStatusCount('resolved'),
      matrixEventReportService.getStatusCount('dismissed')
    ])
    eventReportStats.value = {
      total: total.total_reports ?? 0,
      open: open.count,
      resolved: resolved.count,
      dismissed: dismissed.count
    }
  } catch {
    // 保持默认 0 值（旧实现 throwOnError=false 时同样降级为 0）
  }
}

function handleEventReportFilterChange(value: string) {
  eventReportStatusFilter.value = value
  loadEventReports()
}

async function handleEscalate(id: number) {
  try {
    await matrixEventReportService.escalateReport(id)
    showFeedback(t('moderation.event_reports.toast.escalateSuccess'), 'success')
    loadEventReports()
  } catch {
    showFeedback(t('moderation.event_reports.toast.escalateFailed'), 'error')
  }
}

function handleDelete(id: number) {
  dialog.warning({
    title: t('common.tip'),
    content: t('moderation.event_reports.dialog.deleteConfirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      // SDK deleteReport 对后端 204 No Content（空 body）执行 res.json() 会误抛错，
      // 但服务端实际已删除成功。因此不因 deleteReport 抛错就放弃：无论成败都重新加载
      // 列表，再按「被删 id 是否仍在列表」判定真实结果——旧 MatrixHttpClient 靠
      // responseText ? JSON.parse : {} 正确处理空 body（SDK 侧修复另立 backlog）。
      try {
        await matrixEventReportService.deleteReport(id)
      } catch {
        // 忽略 deleteReport 抛错（204 空 body 误判），以 reload 后的列表为准
      }
      const reloaded = await loadEventReports()
      if (!reloaded) {
        // 重新加载失败时 loadEventReports 已给出 loadFailed 错误反馈，不再重复提示
        return
      }
      if (eventReports.value.some((report) => report.id === id)) {
        showFeedback(t('moderation.event_reports.toast.deleteFailed'), 'error')
      } else {
        showFeedback(t('moderation.event_reports.toast.deleteSuccess'), 'success')
      }
    }
  })
}

function openActionDialog(type: 'resolve' | 'dismiss', reportId: number) {
  actionDialog.value = { show: true, type, reportId, reason: '' }
}

function closeActionDialog() {
  actionDialog.value = { ...actionDialog.value, show: false }
}

async function confirmAction() {
  if (!actionDialog.value.reason) {
    showFeedback(t('moderation.event_reports.dialog.reasonRequired'), 'error')
    return
  }
  const { type, reportId, reason } = actionDialog.value
  if (type === 'resolve') {
    try {
      await matrixEventReportService.resolveReport(reportId, { reason })
      showFeedback(t('moderation.event_reports.toast.resolveSuccess'), 'success')
      actionDialog.value = { ...actionDialog.value, show: false }
      loadEventReports()
    } catch {
      // 失败时保持对话框打开（旧实现返回 null 时不关闭）
    }
  } else {
    try {
      await matrixEventReportService.dismissReport(reportId, { reason })
      showFeedback(t('moderation.event_reports.toast.dismissSuccess'), 'success')
      actionDialog.value = { ...actionDialog.value, show: false }
      loadEventReports()
    } catch {
      // 失败时保持对话框打开（旧实现返回 null 时不关闭）
    }
  }
}

onMounted(() => {
  loadEventReports()
  loadEventReportStats()
})
</script>
