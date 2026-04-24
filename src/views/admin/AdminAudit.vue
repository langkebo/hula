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
            style="width: 160px"
          />
          <n-input
            v-model:value="filterUserId"
            :placeholder="t('admin.audit.filter_user')"
            clearable
            style="width: 200px"
          />
          <n-button @click="loadAuditLogs" :loading="loading">
            {{ t('common.refresh') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-data-table
      :columns="columns"
      :data="auditLogs"
      :loading="loading"
      :pagination="pagination"
      :row-key="(row: AuditEntry) => row.id"
      striped
      class="mt-16px"
    />

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
import { ref, onMounted, computed, h } from 'vue'
import {
  NPageHeader,
  NDataTable,
  NSpace,
  NButton,
  NInput,
  NSelect,
  NModal,
  NDescriptions,
  NDescriptionsItem,
  NCode,
  NTag,
  type DataTableColumns
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAdminAudit, type AuditEntryView as AuditEntry } from '@/composables/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminAudit')
const { t } = useI18n()

const audit = useAdminAudit()
const auditLogs = audit.logs
const loading = audit.loading
const selectedEntry = audit.selected

const filterType = ref<string | null>(null)
const filterUserId = ref('')
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

onMounted(() => {
  loadAuditLogs()
})
</script>

<style scoped>
.admin-audit {
  padding: 16px 24px;
}
</style>
