<template>
  <div class="admin-audit">
    <n-page-header :title="t('admin.audit.title')" :subtitle="t('admin.audit.subtitle')">
      <template #extra>
        <n-space>
          <n-select
            v-model:value="filterType"
            :options="typeOptions"
            :placeholder="t('admin.audit.filter_type')"
            clearable
            style="width: 160px" />
          <n-input
            v-model:value="filterUserId"
            :placeholder="t('admin.audit.filter_user')"
            clearable
            style="width: 200px" />
          <n-date-picker
            v-model:value="dateRange"
            type="daterange"
            clearable
            :placeholder="t('admin.audit.filter_time_range')"
            style="width: 280px" />
          <n-button @click="loadAuditLogs" :loading="loading">
            {{ t('common.refresh') }}
          </n-button>
          <n-button @click="exportCsv" :disabled="displayedLogs.length === 0">
            {{ t('admin.audit.export_csv') }}
          </n-button>
          <n-button @click="exportJson" :disabled="displayedLogs.length === 0">
            {{ t('admin.audit.export_json') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-data-table
      :columns="columns"
      :data="displayedLogs"
      :loading="loading"
      :pagination="pagination"
      :row-key="(row: AuditEntry) => row.id"
      striped
      class="mt-16px" />

    <n-modal v-model:show="detailVisible" preset="card" :title="t('admin.audit.detail_title')" style="width: 600px">
      <n-descriptions :column="1" bordered label-placement="left" v-if="selectedEntry">
        <n-descriptions-item :label="t('admin.audit.col_id')">{{ selectedEntry.id }}</n-descriptions-item>
        <n-descriptions-item :label="t('admin.audit.col_type')">{{ selectedEntry.type }}</n-descriptions-item>
        <n-descriptions-item :label="t('admin.audit.col_user')">{{ selectedEntry.user_id }}</n-descriptions-item>
        <n-descriptions-item :label="t('admin.audit.col_target')">{{ selectedEntry.target }}</n-descriptions-item>
        <n-descriptions-item :label="t('admin.audit.col_time')">
          {{ new Date(selectedEntry.timestamp).toLocaleString() }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.audit.col_details')">
          <n-code :code="JSON.stringify(selectedEntry.details, null, 2)" language="json" />
        </n-descriptions-item>
      </n-descriptions>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import {
  type DataTableColumns,
  NButton,
  NCode,
  NDataTable,
  NDatePicker,
  NDescriptions,
  NDescriptionsItem,
  NInput,
  NModal,
  NPageHeader,
  NSelect,
  NSpace,
  NTag
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type AuditEntryView as AuditEntry, useAdminAudit } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminAudit')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const audit = useAdminAudit()
const auditLogs = audit.logs
const loading = audit.loading
const selectedEntry = audit.selected

const filterType = ref<string | null>(null)
const filterUserId = ref('')
const dateRange = ref<[number, number] | null>(null)
const detailVisible = ref(false)

const pagination = {
  pageSize: 25
}

const typeOptions = computed(() => [
  { label: t('admin.audit.type_user'), value: 'user' },
  { label: t('admin.audit.type_room'), value: 'room' },
  { label: t('admin.audit.type_admin'), value: 'admin' },
  { label: t('admin.audit.type_auth'), value: 'auth' },
  { label: t('admin.audit.type_federation'), value: 'federation' }
])

// Client-side time-range filter applied on top of the loaded logs.
// The backend audit API exposes pagination (from) but no direct time bounds,
// so we narrow the displayed set locally.
const displayedLogs = computed<AuditEntry[]>(() => {
  if (!dateRange.value) return auditLogs.value
  const [start, end] = dateRange.value
  // Inclusive end-of-day: extend end by 23:59:59.999
  const endOfDay = end + 24 * 60 * 60 * 1000 - 1
  return auditLogs.value.filter((entry) => entry.timestamp >= start && entry.timestamp <= endOfDay)
})

const columns: DataTableColumns<AuditEntry> = [
  {
    title: t('admin.audit.col_type'),
    key: 'type',
    width: 120,
    render: (row) => h(NTag, { size: 'small', type: getTagType(row.type) }, () => row.type)
  },
  { title: t('admin.audit.col_user'), key: 'user_id', width: 200, ellipsis: { tooltip: true } },
  { title: t('admin.audit.col_target'), key: 'target', width: 200, ellipsis: { tooltip: true } },
  {
    title: t('admin.audit.col_time'),
    key: 'timestamp',
    width: 180,
    render: (row) => new Date(row.timestamp).toLocaleString(),
    sorter: (a, b) => a.timestamp - b.timestamp,
    defaultSortOrder: 'descend'
  },
  {
    title: t('admin.audit.col_actions'),
    key: 'actions',
    width: 80,
    render: (row) =>
      h(NButton, { size: 'small', quaternary: true, onClick: () => showDetail(row) }, () => t('common.view'))
  }
]

function getTagType(type: string): 'info' | 'success' | 'warning' | 'error' {
  if (type.includes('admin')) return 'warning'
  if (type.includes('auth')) return 'error'
  if (type.includes('room')) return 'success'
  return 'info'
}

function showDetail(entry: AuditEntry) {
  audit.selected.value = entry
  detailVisible.value = true
}

async function loadAuditLogs() {
  try {
    await audit.loadLogs({
      userId: filterUserId.value.trim() || undefined,
      type: filterType.value || undefined
    })
  } catch (err) {
    logger.error('加载审计日志失败:', err)
  }
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value)
  // Wrap in quotes and escape inner quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function exportCsv() {
  try {
    const rows = displayedLogs.value
    const header = [
      t('admin.audit.col_id'),
      t('admin.audit.col_type'),
      t('admin.audit.col_user'),
      t('admin.audit.col_target'),
      t('admin.audit.col_time'),
      t('admin.audit.col_details')
    ]
    const lines = [header.join(',')]
    for (const entry of rows) {
      lines.push(
        [
          escapeCsv(entry.id),
          escapeCsv(entry.type),
          escapeCsv(entry.user_id),
          escapeCsv(entry.target),
          escapeCsv(new Date(entry.timestamp).toISOString()),
          escapeCsv(entry.details)
        ].join(',')
      )
    }
    const ts = new Date().toISOString().slice(0, 10)
    triggerDownload(lines.join('\n'), `audit-logs-${ts}.csv`, 'text/csv;charset=utf-8;')
    showFeedback(t('admin.audit.export_success'), 'success')
  } catch (err) {
    logger.error('导出 CSV 失败:', err)
    showFeedback(t('admin.audit.export_failed'), 'error')
  }
}

function exportJson() {
  try {
    const rows = displayedLogs.value
    const payload = rows.map((entry) => ({
      id: entry.id,
      type: entry.type,
      user_id: entry.user_id,
      target: entry.target ?? null,
      timestamp: entry.timestamp,
      time_iso: new Date(entry.timestamp).toISOString(),
      details: entry.details ?? null
    }))
    const ts = new Date().toISOString().slice(0, 10)
    triggerDownload(JSON.stringify(payload, null, 2), `audit-logs-${ts}.json`, 'application/json;charset=utf-8;')
    showFeedback(t('admin.audit.export_success'), 'success')
  } catch (err) {
    logger.error('导出 JSON 失败:', err)
    showFeedback(t('admin.audit.export_failed'), 'error')
  }
}

onMounted(() => {
  loadAuditLogs()
})
</script>

<style scoped>
.admin-audit {
  padding: 16px 24px;
}
</style>
