<template>
  <div class="moderation-panel p-4">
    <n-card :title="t('moderation.title')">
      <n-tabs v-model:value="activeTab" type="line">
        <n-tab-pane name="reports" :tab="t('moderation.reports')">
          <n-space vertical size="large">
            <n-space>
              <n-select
                v-model:value="statusFilter"
                :options="statusOptions"
                :placeholder="t('moderation.filterByStatus')"
                style="width: 150px"
                @update:value="handleFilterChange" />
              <n-button @click="fetchReports">
                <template #icon>
                  <Icon icon="ion:refresh-outline" />
                </template>
                {{ t('common.refresh') }}
              </n-button>
            </n-space>

            <n-data-table
              :columns="reportColumns"
              :data="openReports"
              :loading="loading"
              :row-key="(row: Report) => row.id" />
          </n-space>
        </n-tab-pane>

        <n-tab-pane name="filters" :tab="t('moderation.filters')">
          <n-space vertical size="large">
            <n-button type="primary" @click="showAddFilterModal = true">
              {{ t('moderation.addFilter') }}
            </n-button>
            <n-list bordered>
              <n-list-item v-for="filter in enabledFilters" :key="filter.id">
                <n-thing :title="filter.pattern" :description="filter.type">
                  <template #header-extra>
                    <n-space>
                      <n-tag :type="filter.action === 'block' ? 'error' : 'warning'">
                        {{ filter.action }}
                      </n-tag>
                      <n-button text type="error" @click="handleRemoveFilter(filter.id)">
                        <template #icon>
                          <Icon icon="ion:trash-outline" />
                        </template>
                      </n-button>
                    </n-space>
                  </template>
                </n-thing>
              </n-list-item>
            </n-list>
          </n-space>
        </n-tab-pane>

        <n-tab-pane name="event-reports" :tab="t('moderation.event_reports.title')">
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
                style="width: 150px"
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
        </n-tab-pane>
      </n-tabs>
    </n-card>

    <n-modal v-model:show="showAddFilterModal" preset="dialog" :title="t('moderation.addFilter')">
      <n-form ref="formRef" :model="filterForm" label-placement="left">
        <n-form-item :label="t('moderation.filterType')" path="type">
          <n-select v-model:value="filterForm.type" :options="filterTypeOptions" />
        </n-form-item>
        <n-form-item :label="t('moderation.filterPattern')" path="pattern">
          <n-input v-model:value="filterForm.pattern" :placeholder="t('moderation.filterPatternPlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('moderation.filterAction')" path="action">
          <n-select v-model:value="filterForm.action" :options="filterActionOptions" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="showAddFilterModal = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="handleAddFilter">{{ t('common.add') }}</n-button>
        </n-space>
      </template>
    </n-modal>

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

    <n-modal :show="historyDialog.show" preset="dialog" :title="t('moderation.event_reports.history.title')">
      <n-list bordered>
        <n-list-item v-for="item in historyDialog.history" :key="item.id">
          <n-thing :title="item.action" :description="item.reason || ''">
            <template #header-extra>
              {{ item.actor_user_id }}
            </template>
          </n-thing>
        </n-list-item>
      </n-list>
      <template #action>
        <n-button @click="historyDialog.show = false">{{ t('common.close') }}</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  type DataTableColumns,
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NList,
  NListItem,
  NModal,
  NSelect,
  NSpace,
  NStatistic,
  NTabPane,
  NTabs,
  NTag,
  NThing
} from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { EventReport, EventReportHistory } from '@/services/matrix/admin/AdminTypes'
import { matrixEventReportService } from '@/services/matrix/moderation/MatrixEventReportService'
import { useModerationStore } from '@/stores/domains/chat/moderation'
import type { Report } from '@/types/matrix-services'

defineOptions({
  name: 'ModerationPanel'
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const moderationStore = useModerationStore()
const { openReports, enabledFilters, loading } = storeToRefs(moderationStore)

const activeTab = ref('reports')
const statusFilter = ref<string | null>('open')
const showAddFilterModal = ref(false)
const filterForm = ref({
  type: 'keyword' as 'keyword' | 'regex' | 'image_hash',
  pattern: '',
  action: 'flag' as 'flag' | 'block' | 'quarantine'
})

const statusOptions = computed(() => [
  { label: t('moderation.status.open'), value: 'open' },
  { label: t('moderation.status.resolved'), value: 'resolved' },
  { label: t('moderation.status.dismissed'), value: 'dismissed' }
])

const filterTypeOptions = computed(() => [
  { label: t('moderation.filterTypeOptions.keyword'), value: 'keyword' },
  { label: t('moderation.filterTypeOptions.regex'), value: 'regex' },
  { label: t('moderation.filterTypeOptions.imageHash'), value: 'image_hash' }
])

const filterActionOptions = computed(() => [
  { label: t('moderation.filterActionOptions.flag'), value: 'flag' },
  { label: t('moderation.filterActionOptions.block'), value: 'block' },
  { label: t('moderation.filterActionOptions.quarantine'), value: 'quarantine' }
])

const reportColumns: DataTableColumns<Report> = [
  { title: 'ID', key: 'id', width: 100 },
  { title: t('moderation.table.reporter'), key: 'reporterUserId', width: 150 },
  { title: t('moderation.table.reportedUser'), key: 'reportedUserId', width: 150 },
  { title: t('moderation.table.reason'), key: 'reason', ellipsis: { tooltip: true } },
  {
    title: t('moderation.table.createdAt'),
    key: 'createdAt',
    width: 150,
    render: (row) => new Date(row.createdAt).toLocaleString()
  },
  {
    title: t('moderation.table.actions'),
    key: 'actions',
    width: 200,
    render: (row) =>
      h(NSpace, null, {
        default: () => [
          h(
            NButton,
            { size: 'small', type: 'warning', onClick: () => handleResolveReport(row.id, 'warn') },
            { default: () => t('moderation.actions.warn') }
          ),
          h(
            NButton,
            { size: 'small', type: 'error', onClick: () => handleResolveReport(row.id, 'ban') },
            { default: () => t('moderation.actions.ban') }
          ),
          h(
            NButton,
            { size: 'small', onClick: () => handleResolveReport(row.id, 'dismiss') },
            { default: () => t('moderation.actions.dismiss') }
          )
        ]
      })
  }
]

async function fetchReports() {
  await moderationStore.fetchReports({
    status: statusFilter.value as 'open' | 'resolved' | 'dismissed' | undefined
  })
}

function handleFilterChange() {
  fetchReports()
}

async function handleResolveReport(reportId: string, action: 'dismiss' | 'warn' | 'mute' | 'ban') {
  const success = await moderationStore.resolveReport(reportId, action)
  if (success) {
    showFeedback(t('moderation.toast.reportResolved', { action }), 'success')
    fetchReports()
  }
}

async function handleAddFilter() {
  if (!filterForm.value.pattern) {
    showFeedback(t('moderation.toast.patternRequired'), 'error')
    return
  }
  const result = await moderationStore.addContentFilter(filterForm.value)
  if (result) {
    showAddFilterModal.value = false
    filterForm.value = { type: 'keyword', pattern: '', action: 'flag' }
    showFeedback(t('moderation.toast.filterAdded'), 'success')
  }
}

async function handleRemoveFilter(filterId: string) {
  const success = await moderationStore.removeContentFilter(filterId)
  if (success) {
    showFeedback(t('moderation.toast.filterRemoved'), 'success')
  }
}

// === Event Reports (P1-4 事件举报管理) ===
const eventReports = ref<EventReport[]>([])
const eventReportStats = ref({ total: 0, open: 0, resolved: 0, dismissed: 0 })
const eventReportStatusFilter = ref<string | null>(null)
const eventReportLoading = ref(false)
const actionDialog = ref({ show: false, type: 'resolve' as 'resolve' | 'dismiss', reportId: 0, reason: '' })
const historyDialog = ref({ show: false, history: [] as EventReportHistory[] })

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
          ),
          h(
            NButton,
            {
              size: 'small',
              'data-testid': 'event-report-action-history',
              onClick: () => handleHistory(row.id)
            },
            { default: () => t('moderation.event_reports.actions.history') }
          )
        ]
      })
  }
])

async function loadEventReports(): Promise<boolean> {
  eventReportLoading.value = true
  try {
    if (eventReportStatusFilter.value) {
      eventReports.value = (await matrixEventReportService.getReportsByStatus(eventReportStatusFilter.value, {
        limit: 100
      })) as EventReport[]
    } else {
      eventReports.value = (await matrixEventReportService.listReports({ limit: 100 })) as EventReport[]
    }
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

async function handleDelete(id: number) {
  if (!window.confirm(t('moderation.event_reports.dialog.deleteConfirm'))) return
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
    // 适配：SDK DTO 将 resolve 请求体声明为 resolution_reason，但后端契约（event_report.rs）实际读取 reason
    const body = { reason } as unknown as Parameters<typeof matrixEventReportService.resolveReport>[1]
    try {
      await matrixEventReportService.resolveReport(reportId, body)
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

async function handleHistory(id: number) {
  // 适配：SDK getReportHistory 声明返回 ReportResponse[]，但后端实际返回 ReportHistoryResponse[]
  // （含 action/actor_user_id/new_status 等历史字段，与本地 EventReportHistory 一致）
  try {
    const history = (await matrixEventReportService.getReportHistory(id)) as unknown as EventReportHistory[]
    historyDialog.value = { show: true, history }
  } catch {
    // 旧实现 getEventReportHistory 默认 throwOnError=false，失败返回 [] 且对话框照常打开；
    // 新服务失败抛错，这里 catch 后以空历史打开对话框，保持行为一致（同 delete 分支的静默策略）
    historyDialog.value = { show: true, history: [] }
  }
}

onMounted(() => {
  fetchReports()
  moderationStore.fetchContentFilters()
  loadEventReports()
  loadEventReportStats()
})
</script>

<style scoped>
.moderation-panel {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
