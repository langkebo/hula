<template>
  <div class="admin-security">
    <n-page-header :title="t('admin.security.title')" :subtitle="t('admin.security.subtitle')">
      <template #extra>
        <n-space>
          <n-button @click="loadAuditLogs()" :loading="loading">
            <template #icon>
              <n-icon><RefreshIcon /></n-icon>
            </template>
            {{ t('common.refresh') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-alert type="info" class="my-12px">
      {{ t('admin.security.audit_info') }}
    </n-alert>

    <n-data-table
      remote
      ref="table"
      :columns="columns"
      :data="auditLogs"
      :loading="loading"
      :pagination="pagination"
      :row-key="(row: AuditLogRow) => row.id"
      striped
      class="mt-16px"
      @update:page="handlePageChange" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h, reactive } from 'vue'
import {
  NPageHeader,
  NDataTable,
  NSpace,
  NButton,
  NAlert,
  NIcon,
  NTag,
  useMessage,
  type DataTableColumns
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAdminSecurity } from '@/composables/admin/useAdminSecurity'

interface AuditLogRow {
  id: string
  action: string
  result: string
  actor_id: string
  resource_type: string
  resource_id: string
  timestamp: number
  details?: string
}

const { t } = useI18n()
const message = useMessage()
const { auditLogs, loading, nextBatch, loadAuditLogs } = useAdminSecurity()

const pagination = reactive({
  page: 1,
  pageSize: 50,
  showSizePicker: true,
  pageSizes: [20, 50, 100],
  onChange: (page: number) => {
    pagination.page = page
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    loadAuditLogs(pageSize)
  }
})

const RefreshIcon = {
  render: () =>
    h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }, [
      h('polyline', { points: '23 4 23 10 17 10' }),
      h('path', { d: 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10' })
    ])
}

const columns: DataTableColumns<AuditLogRow> = [
  {
    title: t('admin.security.col_type'),
    key: 'action',
    width: 150,
    render: (row) => h(NTag, { size: 'small', type: row.result === 'success' ? 'success' : 'error' }, () => row.action)
  },
  { title: t('admin.security.col_user'), key: 'actor_id', width: 200 },
  {
    title: t('admin.security.col_resource'),
    key: 'resource_type',
    width: 150,
    render: (row) => `${row.resource_type}: ${row.resource_id}`
  },
  {
    title: t('admin.security.col_time'),
    key: 'timestamp',
    width: 180,
    render: (row) => new Date(row.timestamp).toLocaleString()
  },
  {
    title: t('admin.security.col_result'),
    key: 'result',
    width: 100,
    render: (row) => h(NTag, { size: 'small', type: row.result === 'success' ? 'success' : 'error' }, () => row.result)
  }
]

async function handlePageChange(page: number) {
  if (page > pagination.page && nextBatch.value) {
    await loadAuditLogs(pagination.pageSize, nextBatch.value)
  }
  pagination.page = page
}

onMounted(() => {
  loadAuditLogs(pagination.pageSize)
})
</script>

<style scoped>
.admin-security {
  padding: 16px 24px;
}
</style>
