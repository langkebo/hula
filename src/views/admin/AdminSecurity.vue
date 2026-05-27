<template>
  <div class="admin-security">
    <n-page-header :title="t('admin.security.title')" :subtitle="t('admin.security.subtitle')">
      <template #extra>
        <n-space>
          <n-button @click="refreshCurrentTab()" :loading="loading">
            <template #icon>
              <n-icon><RefreshIcon /></n-icon>
            </template>
            {{ t('common.refresh') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-tabs v-model:value="activeTab" type="card" class="mt-16px" @update:value="handleTabChange">
      <!-- 审计日志 Tab -->
      <n-tab-pane name="audit" :tab="t('admin.security.audit_tab')">
        <n-alert type="info" class="mb-12px">
          {{ t('admin.security.audit_info') }}
        </n-alert>
        <n-data-table
          remote
          ref="table"
          :columns="auditColumns"
          :data="auditLogs"
          :loading="loading"
          :pagination="auditPagination"
          :row-key="(row: AuditLogRow) => row.id"
          striped
          @update:page="handleAuditPageChange" />
      </n-tab-pane>

      <!-- IP 封禁 Tab -->
      <n-tab-pane name="ip_blocks" :tab="t('admin.security.ip_blocks_tab')">
        <div class="section-toolbar">
          <n-button type="primary" @click="showBlockIpDialog = true">
            <template #icon>
              <n-icon><Icon icon="mdi:ip-network" /></n-icon>
            </template>
            {{ t('admin.security.block_ip') }}
          </n-button>
        </div>

        <n-spin :show="ipBlocksLoading">
          <div v-if="ipBlocks.length === 0" class="empty-state">
            <n-empty :description="t('admin.security.no_ip_blocks')" />
          </div>
          <n-data-table
            v-else
            :columns="ipBlockColumns"
            :data="ipBlocks"
            :row-key="(row: Record<string, unknown>) => String(row.ip ?? row.id)"
            striped />
        </n-spin>
      </n-tab-pane>

      <!-- 安全事件 Tab -->
      <n-tab-pane name="security_events" :tab="t('admin.security.events_tab')">
        <div class="section-toolbar">
          <n-select
            v-model:value="securityEventFilter"
            :options="securityEventTypeOptions"
            :placeholder="t('admin.security.filter_event_type')"
            clearable
            style="width: 200px" />
        </div>

        <n-spin :show="securityEventsLoading">
          <div v-if="securityEvents.length === 0" class="empty-state">
            <n-empty :description="t('admin.security.no_security_events')" />
          </div>
          <n-data-table
            v-else
            :columns="securityEventColumns"
            :data="securityEvents"
            :row-key="(row: Record<string, unknown>) => String(row.event_id ?? '')"
            striped />
        </n-spin>
      </n-tab-pane>

      <!-- 登录失败 Tab -->
      <n-tab-pane name="login_failures" :tab="t('admin.security.login_failures_tab')">
        <n-spin :show="loginFailuresLoading">
          <div v-if="loginFailures.length === 0" class="empty-state">
            <n-empty :description="t('admin.security.no_login_failures')" />
          </div>
          <n-data-table
            v-else
            :columns="loginFailureColumns"
            :data="loginFailures"
            :row-key="(row: Record<string, unknown>) => String(row.id ?? '')"
            striped />
        </n-spin>
      </n-tab-pane>
    </n-tabs>

    <!-- 封禁 IP 对话框 -->
    <n-modal v-model:show="showBlockIpDialog" preset="card" :title="t('admin.security.block_ip')" style="width: 480px">
      <n-form ref="blockIpFormRef" :model="blockIpForm" :rules="blockIpRules">
        <n-form-item :label="t('admin.security.ip_placeholder')" path="ip">
          <n-input v-model:value="blockIpForm.ip" :placeholder="t('admin.security.ip_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('admin.security.col_reason')" path="reason">
          <n-input
            v-model:value="blockIpForm.reason"
            type="textarea"
            :placeholder="t('admin.security.reason_placeholder')"
            :rows="3" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="dialog-footer">
          <n-button @click="showBlockIpDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="blockIpLoading" @click="handleBlockIp">
            {{ t('admin.security.block_ip') }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  type DataTableColumns,
  type FormInst,
  NAlert,
  NButton,
  NDataTable,
  NEmpty,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NModal,
  NPageHeader,
  NPopconfirm,
  NSelect,
  NSpace,
  NSpin,
  NTabPane,
  NTabs,
  NTag
} from 'naive-ui'
import { h, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminSecurity } from '@/composables/admin/useAdminSecurity'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { adminService } from '@/services/matrix/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminSecurity')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { auditLogs, loading, nextBatch, loadAuditLogs } = useAdminSecurity()

// ===== Tab 状态 =====
const activeTab = ref('audit')

// ===== 审计日志 =====
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

const auditPagination = reactive({
  page: 1,
  pageSize: 50,
  showSizePicker: true,
  pageSizes: [20, 50, 100],
  onChange: (page: number) => {
    auditPagination.page = page
  },
  onUpdatePageSize: (pageSize: number) => {
    auditPagination.pageSize = pageSize
    auditPagination.page = 1
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

const auditColumns: DataTableColumns<AuditLogRow> = [
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

async function handleAuditPageChange(page: number) {
  if (page > auditPagination.page && nextBatch.value) {
    await loadAuditLogs(auditPagination.pageSize, nextBatch.value)
  }
  auditPagination.page = page
}

// ===== IP 封禁 =====
const ipBlocks = ref<Array<Record<string, unknown>>>([])
const ipBlocksLoading = ref(false)
const showBlockIpDialog = ref(false)
const blockIpLoading = ref(false)
const blockIpFormRef = ref<FormInst | null>(null)
const blockIpForm = reactive({ ip: '', reason: '' })
const blockIpRules = {
  ip: { required: true, message: t('admin.security.ip_required'), trigger: 'blur' }
}

const ipBlockColumns: DataTableColumns<Record<string, unknown>> = [
  {
    title: t('admin.security.col_ip'),
    key: 'ip',
    width: 180,
    render: (row) => String(row.ip ?? '')
  },
  {
    title: t('admin.security.col_reason'),
    key: 'reason',
    render: (row) => String(row.reason ?? '-')
  },
  {
    title: t('admin.security.col_blocked_at'),
    key: 'blocked_at',
    width: 180,
    render: (row) => {
      const ts = row.blocked_at ?? row.created_ts ?? row.created_at
      return ts ? new Date(Number(ts)).toLocaleString() : '-'
    }
  },
  {
    title: t('admin.security.col_blocked_by'),
    key: 'blocked_by',
    width: 200,
    render: (row) => String(row.blocked_by ?? row.created_by ?? '-')
  },
  {
    title: t('admin.security.col_actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      h(
        NPopconfirm,
        { onPositiveClick: () => handleUnblockIp(String(row.ip ?? '')) },
        {
          trigger: () => h(NButton, { type: 'error', size: 'small' }, { default: () => t('admin.security.unblock') }),
          default: () => t('admin.security.unblock_confirm')
        }
      )
  }
]

async function loadIpBlocks() {
  ipBlocksLoading.value = true
  try {
    const result = await adminService.getIpBlocks()
    ipBlocks.value = result ?? []
  } catch (e) {
    logger.error('加载IP封禁列表失败', e)
    ipBlocks.value = []
  } finally {
    ipBlocksLoading.value = false
  }
}

async function handleBlockIp() {
  try {
    await blockIpFormRef.value?.validate()
  } catch {
    return
  }
  blockIpLoading.value = true
  try {
    const result = await adminService.blockIp(blockIpForm.ip, {
      reason: blockIpForm.reason || undefined
    })
    if (result) {
      showFeedback(t('admin.security.ip_blocked'), 'success')
      showBlockIpDialog.value = false
      blockIpForm.ip = ''
      blockIpForm.reason = ''
      await loadIpBlocks()
    } else {
      showFeedback(t('admin.security.block_failed'), 'error')
    }
  } catch (e) {
    logger.error('封禁IP失败', e)
    showFeedback(t('admin.security.block_failed'), 'error')
  } finally {
    blockIpLoading.value = false
  }
}

async function handleUnblockIp(ip: string) {
  try {
    await adminService.unblockIp(ip)
    showFeedback(t('admin.security.ip_unblocked'), 'success')
    await loadIpBlocks()
  } catch (e) {
    logger.error('解封IP失败', e)
    showFeedback(t('admin.security.unblock_failed'), 'error')
  }
}

// ===== 安全事件 =====
const securityEvents = ref<Array<Record<string, unknown>>>([])
const securityEventsLoading = ref(false)
const securityEventFilter = ref<string | null>(null)

const securityEventTypeOptions = [
  { label: t('admin.security.event_type_login_failure'), value: 'login_failure' },
  { label: t('admin.security.event_type_suspicious_activity'), value: 'suspicious_activity' },
  { label: t('admin.security.event_type_brute_force'), value: 'brute_force' },
  { label: t('admin.security.event_type_rate_limit'), value: 'rate_limit' }
]

const securityEventColumns: DataTableColumns<Record<string, unknown>> = [
  {
    title: t('admin.security.col_type'),
    key: 'event_type',
    width: 160,
    render: (row) => h(NTag, { size: 'small', type: 'warning' }, () => String(row.event_type ?? row.type ?? ''))
  },
  {
    title: t('admin.security.col_ip'),
    key: 'ip',
    width: 160,
    render: (row) => String(row.ip ?? '-')
  },
  {
    title: t('admin.security.col_user'),
    key: 'user_id',
    width: 200,
    render: (row) => String(row.user_id ?? row.actor_id ?? '-')
  },
  {
    title: t('admin.security.col_time'),
    key: 'timestamp',
    width: 180,
    render: (row) => {
      const ts = row.timestamp ?? row.created_ts
      return ts ? new Date(Number(ts)).toLocaleString() : '-'
    }
  },
  {
    title: t('admin.security.col_details'),
    key: 'details',
    render: (row) => String(row.details ?? row.description ?? '-')
  }
]

async function loadSecurityEvents() {
  securityEventsLoading.value = true
  try {
    const filters: Record<string, unknown> = {}
    if (securityEventFilter.value) {
      filters.event_type = securityEventFilter.value
    }
    const result = await adminService.getSecurityEvents(
      100,
      undefined,
      Object.keys(filters).length > 0 ? filters : undefined
    )
    securityEvents.value = result?.events ?? []
  } catch (e) {
    logger.error('加载安全事件失败', e)
    securityEvents.value = []
  } finally {
    securityEventsLoading.value = false
  }
}

watch(securityEventFilter, () => {
  if (activeTab.value === 'security_events') {
    loadSecurityEvents()
  }
})

// ===== 登录失败 =====
const loginFailures = ref<Array<Record<string, unknown>>>([])
const loginFailuresLoading = ref(false)

const loginFailureColumns: DataTableColumns<Record<string, unknown>> = [
  {
    title: t('admin.security.col_user'),
    key: 'user_id',
    width: 200,
    render: (row) => String(row.user_id ?? '-')
  },
  {
    title: t('admin.security.col_ip'),
    key: 'ip',
    width: 160,
    render: (row) => String(row.ip ?? '-')
  },
  {
    title: t('admin.security.col_time'),
    key: 'timestamp',
    width: 180,
    render: (row) => {
      const ts = row.timestamp ?? row.created_ts
      return ts ? new Date(Number(ts)).toLocaleString() : '-'
    }
  },
  {
    title: t('admin.security.col_reason'),
    key: 'failure_reason',
    render: (row) => String(row.failure_reason ?? row.reason ?? '-')
  }
]

async function loadLoginFailures() {
  loginFailuresLoading.value = true
  try {
    const result = await adminService.getLoginFailures(100)
    loginFailures.value = result?.failures ?? []
  } catch (e) {
    logger.error('加载登录失败记录失败', e)
    loginFailures.value = []
  } finally {
    loginFailuresLoading.value = false
  }
}

// ===== Tab 切换 =====
function handleTabChange(tab: string) {
  if (tab === 'ip_blocks') {
    loadIpBlocks()
  } else if (tab === 'security_events') {
    loadSecurityEvents()
  } else if (tab === 'login_failures') {
    loadLoginFailures()
  }
}

function refreshCurrentTab() {
  if (activeTab.value === 'audit') {
    loadAuditLogs(auditPagination.pageSize)
  } else if (activeTab.value === 'ip_blocks') {
    loadIpBlocks()
  } else if (activeTab.value === 'security_events') {
    loadSecurityEvents()
  } else if (activeTab.value === 'login_failures') {
    loadLoginFailures()
  }
}

onMounted(() => {
  loadAuditLogs(auditPagination.pageSize)
})
</script>

<style scoped>
.admin-security {
  padding: 16px 24px;
}

.section-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
