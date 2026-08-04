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

      <!-- 注册控制 Tab -->
      <n-tab-pane name="registration" :tab="t('admin.security.registration_tab')">
        <n-spin :show="registrationLoading">
          <n-form label-placement="left" :label-width="160">
            <n-form-item :label="t('admin.security.registration_policy')">
              <n-radio-group v-model:value="registrationPolicy">
                <n-radio value="open">{{ t('admin.security.registration_open') }}</n-radio>
                <n-radio value="closed">{{ t('admin.security.registration_closed') }}</n-radio>
                <n-radio value="approval">{{ t('admin.security.registration_approval') }}</n-radio>
              </n-radio-group>
            </n-form-item>
            <n-form-item :label="' '">
              <n-button type="primary" :loading="registrationSaving" @click="saveRegistrationPolicy">
                {{ t('admin.common.save') }}
              </n-button>
            </n-form-item>
          </n-form>
        </n-spin>
      </n-tab-pane>

      <!-- 联邦控制 Tab -->
      <n-tab-pane name="federation" :tab="t('admin.security.federation_tab')">
        <n-spin :show="federationLoading">
          <n-form label-placement="left" :label-width="160">
            <n-form-item :label="t('admin.security.federation_enabled')">
              <n-switch v-model:value="federationEnabled" />
            </n-form-item>
            <n-form-item :label="t('admin.security.federation_deny_list')">
              <n-input
                v-model:value="federationDenyList"
                type="textarea"
                :rows="4"
                :placeholder="t('admin.security.federation_blacklist')" />
            </n-form-item>
            <n-form-item :label="t('admin.security.federation_allow_list')">
              <n-input
                v-model:value="federationAllowList"
                type="textarea"
                :rows="4"
                :placeholder="t('admin.security.federation_whitelist')" />
            </n-form-item>
            <n-form-item :label="' '">
              <n-button type="primary" :loading="federationSaving" @click="saveFederationPolicy">
                {{ t('admin.common.save') }}
              </n-button>
            </n-form-item>
          </n-form>
        </n-spin>
      </n-tab-pane>

      <!-- 密码策略 Tab -->
      <n-tab-pane name="password" :tab="t('admin.security.password_tab')">
        <n-spin :show="passwordLoading">
          <n-form label-placement="left" :label-width="180">
            <n-form-item :label="t('admin.security.password_min_length')">
              <n-input-number v-model:value="passwordPolicy.minLength" :min="1" :max="128" />
            </n-form-item>
            <n-form-item :label="t('admin.security.password_require_uppercase')">
              <n-switch v-model:value="passwordPolicy.requireUppercase" />
            </n-form-item>
            <n-form-item :label="t('admin.security.password_require_lowercase')">
              <n-switch v-model:value="passwordPolicy.requireLowercase" />
            </n-form-item>
            <n-form-item :label="t('admin.security.password_require_digit')">
              <n-switch v-model:value="passwordPolicy.requireDigit" />
            </n-form-item>
            <n-form-item :label="t('admin.security.password_require_symbol')">
              <n-switch v-model:value="passwordPolicy.requireSymbol" />
            </n-form-item>
            <n-form-item :label="t('admin.security.password_expiry_days')">
              <n-input-number v-model:value="passwordPolicy.expiryDays" :min="0" :max="365" />
            </n-form-item>
            <n-form-item :label="' '">
              <n-button type="primary" :loading="passwordSaving" @click="savePasswordPolicy">
                {{ t('admin.common.save') }}
              </n-button>
            </n-form-item>
          </n-form>
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
  NInputNumber,
  NModal,
  NPageHeader,
  NPopconfirm,
  NRadio,
  NRadioGroup,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
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

// ===== 注册控制 =====
const registrationLoading = ref(false)
const registrationSaving = ref(false)
const registrationPolicy = ref<'open' | 'closed' | 'approval'>('closed')

async function loadRegistrationPolicy() {
  registrationLoading.value = true
  try {
    const config = await adminService.getServerConfig()
    const cfg = config as Record<string, unknown>
    const enabled = Boolean(cfg?.registrations_enabled)
    const approval = Boolean(cfg?.registration_requires_approval)
    if (enabled && approval) registrationPolicy.value = 'approval'
    else if (enabled) registrationPolicy.value = 'open'
    else registrationPolicy.value = 'closed'
  } catch (e) {
    logger.error('加载注册策略失败', e)
  } finally {
    registrationLoading.value = false
  }
}

async function saveRegistrationPolicy() {
  registrationSaving.value = true
  try {
    const enabled = registrationPolicy.value !== 'closed'
    const approval = registrationPolicy.value === 'approval'
    await adminService.updateServerConfig({
      registrations_enabled: enabled,
      registration_requires_approval: approval
    })
    showFeedback(t('admin.security.registration_policy_saved'), 'success')
  } catch (e) {
    logger.error('保存注册策略失败', e)
    showFeedback(t('admin.security.registration_policy_failed'), 'error')
  } finally {
    registrationSaving.value = false
  }
}

// ===== 联邦控制 =====
const federationLoading = ref(false)
const federationSaving = ref(false)
const federationEnabled = ref(false)
const federationDenyList = ref('')
const federationAllowList = ref('')

async function loadFederationPolicy() {
  federationLoading.value = true
  try {
    const [config, blacklist] = await Promise.all([
      adminService.getServerConfig(),
      adminService.getFederationBlacklist()
    ])
    const cfg = config as Record<string, unknown>
    federationEnabled.value = Boolean(cfg?.federation_enabled ?? true)
    federationDenyList.value = (blacklist ?? []).map((b) => b.domain).join('\n')
    const allow = cfg?.federation_allow_list
    federationAllowList.value = Array.isArray(allow) ? (allow as string[]).join('\n') : ''
  } catch (e) {
    logger.error('加载联邦策略失败', e)
  } finally {
    federationLoading.value = false
  }
}

async function saveFederationPolicy() {
  federationSaving.value = true
  try {
    const allowList = federationAllowList.value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    await adminService.updateServerConfig({
      federation_enabled: federationEnabled.value,
      federation_allow_list: allowList
    })
    // Sync blacklist: diff current vs desired
    const currentBlacklist = await adminService.getFederationBlacklist()
    const currentDomains = new Set((currentBlacklist ?? []).map((b) => b.domain))
    const desiredDomains = new Set(
      federationDenyList.value
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    )
    for (const domain of desiredDomains) {
      if (!currentDomains.has(domain)) {
        await adminService.addToFederationBlacklist(domain)
      }
    }
    for (const domain of currentDomains) {
      if (!desiredDomains.has(domain)) {
        await adminService.removeFromFederationBlacklist(domain)
      }
    }
    showFeedback(t('admin.security.federation_policy_saved'), 'success')
  } catch (e) {
    logger.error('保存联邦策略失败', e)
    showFeedback(t('admin.security.federation_policy_failed'), 'error')
  } finally {
    federationSaving.value = false
  }
}

// ===== 密码策略 =====
const passwordLoading = ref(false)
const passwordSaving = ref(false)
const passwordPolicy = reactive({
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireDigit: false,
  requireSymbol: false,
  expiryDays: 0
})

async function loadPasswordPolicy() {
  passwordLoading.value = true
  try {
    const config = await adminService.getServerConfig()
    const cfg = config as Record<string, unknown>
    const policy = (cfg?.password_policy ?? {}) as Record<string, unknown>
    passwordPolicy.minLength = Number(policy.minimum_length ?? 8)
    passwordPolicy.requireUppercase = Boolean(policy.require_uppercase)
    passwordPolicy.requireLowercase = Boolean(policy.require_lowercase)
    passwordPolicy.requireDigit = Boolean(policy.require_digit)
    passwordPolicy.requireSymbol = Boolean(policy.require_symbol)
    passwordPolicy.expiryDays = Number(policy.expiry_days ?? 0)
  } catch (e) {
    logger.error('加载密码策略失败', e)
  } finally {
    passwordLoading.value = false
  }
}

async function savePasswordPolicy() {
  passwordSaving.value = true
  try {
    await adminService.updateServerConfig({
      password_policy: {
        minimum_length: passwordPolicy.minLength,
        require_uppercase: passwordPolicy.requireUppercase,
        require_lowercase: passwordPolicy.requireLowercase,
        require_digit: passwordPolicy.requireDigit,
        require_symbol: passwordPolicy.requireSymbol,
        expiry_days: passwordPolicy.expiryDays
      }
    })
    showFeedback(t('admin.security.password_policy_saved'), 'success')
  } catch (e) {
    logger.error('保存密码策略失败', e)
    showFeedback(t('admin.security.password_policy_failed'), 'error')
  } finally {
    passwordSaving.value = false
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
  } else if (tab === 'registration') {
    loadRegistrationPolicy()
  } else if (tab === 'federation') {
    loadFederationPolicy()
  } else if (tab === 'password') {
    loadPasswordPolicy()
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
  } else if (activeTab.value === 'registration') {
    loadRegistrationPolicy()
  } else if (activeTab.value === 'federation') {
    loadFederationPolicy()
  } else if (activeTab.value === 'password') {
    loadPasswordPolicy()
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
