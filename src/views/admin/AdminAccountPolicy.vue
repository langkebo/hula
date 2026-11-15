<template>
  <div class="admin-account-policy">
    <n-alert :bordered="false" type="info">{{ t('admin.accountPolicy.hint') }}</n-alert>

    <n-tabs v-model:value="activeTab" type="line" animated class="tabs">
      <n-tab-pane name="validity" :tab="t('admin.accountPolicy.tabs.validity')">
        <div class="tab-header">
          <n-space align="center">
            <n-input
              v-model:value="validityUserId"
              data-testid="account-policy-validity-user-id"
              :placeholder="t('admin.accountPolicy.validity.userIdPlaceholder')"
              clearable
              class="w-[300px]" />
            <n-button
              data-testid="account-policy-validity-load"
              type="primary"
              :loading="validityLoading"
              @click="handleLoadValidity">
              {{ t('admin.accountPolicy.validity.load') }}
            </n-button>
          </n-space>
        </div>

        <n-alert
          v-if="validityError"
          data-testid="account-policy-validity-error"
          type="error"
          closable
          @close="validityError = null">
          {{ validityError }}
        </n-alert>

        <n-card v-if="validity" data-testid="account-policy-validity-card" :title="validity.user_id" class="mb-16px">
          <n-descriptions :column="2" bordered size="small" label-placement="left">
            <n-descriptions-item :label="t('admin.accountPolicy.validity.fieldExpiration')">
              {{ formatTs(validity.expiration_ts) }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.accountPolicy.validity.fieldLastCheck')">
              {{ formatTs(validity.last_check_at) }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.accountPolicy.validity.fieldIsValid')">
              {{
                validity.is_valid ? t('admin.accountPolicy.validity.valid') : t('admin.accountPolicy.validity.invalid')
              }}
            </n-descriptions-item>
            <n-descriptions-item :label="t('admin.accountPolicy.validity.fieldUpdatedAt')">
              {{ formatTs(validity.updated_ts) }}
            </n-descriptions-item>
          </n-descriptions>
        </n-card>
        <n-empty
          v-else-if="validityUserId && !validityLoading"
          data-testid="account-policy-validity-empty"
          :description="t('admin.accountPolicy.validity.empty')" />

        <n-card :title="t('admin.accountPolicy.validity.setTitle')" class="mb-16px">
          <n-space align="center">
            <n-date-picker
              v-model:value="setExpiration"
              data-testid="account-policy-validity-expiration"
              type="datetime"
              clearable />
            <n-button
              data-testid="account-policy-validity-set"
              type="primary"
              :loading="validitySaving"
              @click="handleSetValidity">
              {{ t('admin.accountPolicy.validity.set') }}
            </n-button>
          </n-space>
        </n-card>

        <n-card :title="t('admin.accountPolicy.validity.renewTitle')">
          <n-space align="center" :wrap="true">
            <n-input
              v-model:value="renewalToken"
              data-testid="account-policy-validity-renew-token"
              :placeholder="t('admin.accountPolicy.validity.renewalTokenPlaceholder')"
              class="w-[240px]" />
            <n-date-picker
              v-model:value="renewExpiration"
              data-testid="account-policy-validity-renew-expiration"
              type="datetime"
              clearable />
            <n-button
              data-testid="account-policy-validity-renew"
              :loading="validitySaving"
              @click="handleRenewValidity">
              {{ t('admin.accountPolicy.validity.renew') }}
            </n-button>
          </n-space>
        </n-card>
      </n-tab-pane>

      <n-tab-pane name="providers" :tab="t('admin.accountPolicy.tabs.providers')">
        <n-space vertical size="large">
          <n-alert :bordered="false" type="info">{{ t('admin.accountPolicy.providers.hint') }}</n-alert>

          <n-alert
            v-if="providersError"
            data-testid="account-policy-provider-error"
            type="error"
            closable
            @close="providersError = null">
            {{ providersError }}
          </n-alert>

          <n-space>
            <n-button data-testid="account-policy-provider-refresh" :loading="providersLoading" @click="loadProviders">
              {{ t('admin.accountPolicy.providers.refresh') }}
            </n-button>
          </n-space>

          <n-data-table
            :columns="providerColumns"
            :data="providers"
            :loading="providersLoading"
            :row-key="(row: AdminPasswordAuthProvider) => row.id"
            :scroll-x="760" />

          <n-empty
            v-if="!providersLoading && providers.length === 0"
            data-testid="account-policy-provider-empty"
            :description="t('admin.accountPolicy.providers.empty')" />

          <n-card :title="t('admin.accountPolicy.providers.createTitle')">
            <n-form label-placement="top">
              <n-space vertical>
                <n-form-item :label="t('admin.accountPolicy.providers.providerName')">
                  <n-input
                    v-model:value="providerDraft.providerName"
                    data-testid="account-policy-provider-name"
                    :placeholder="t('admin.accountPolicy.providers.providerNamePlaceholder')" />
                </n-form-item>
                <n-form-item :label="t('admin.accountPolicy.providers.providerType')">
                  <n-input
                    v-model:value="providerDraft.providerType"
                    data-testid="account-policy-provider-type"
                    :placeholder="t('admin.accountPolicy.providers.providerTypePlaceholder')" />
                </n-form-item>
                <n-form-item :label="t('admin.accountPolicy.providers.config')">
                  <n-input
                    v-model:value="providerConfig"
                    data-testid="account-policy-provider-config"
                    type="textarea"
                    :rows="4"
                    :placeholder="t('admin.accountPolicy.providers.configPlaceholder')" />
                </n-form-item>
                <n-space align="center">
                  <n-switch v-model:value="providerDraft.isEnabled" data-testid="account-policy-provider-enabled" />
                  <span>{{ t('admin.accountPolicy.providers.enabled') }}</span>
                  <n-input-number
                    v-model:value="providerPriority"
                    data-testid="account-policy-provider-priority"
                    :min="0"
                    class="w-[160px]" />
                </n-space>
                <n-space>
                  <n-button
                    data-testid="account-policy-provider-submit"
                    type="primary"
                    :loading="providersSaving"
                    @click="handleCreateProvider">
                    {{ t('admin.accountPolicy.providers.submit') }}
                  </n-button>
                </n-space>
              </n-space>
            </n-form>
          </n-card>
        </n-space>
      </n-tab-pane>

      <n-tab-pane name="policy" :tab="t('admin.accountPolicy.tabs.policy')">
        <n-space vertical size="large">
          <n-alert :bordered="false" type="info">{{ t('admin.accountPolicy.policy.hint') }}</n-alert>

          <n-alert
            v-if="policyError"
            data-testid="account-policy-policy-error"
            type="error"
            closable
            @close="policyError = null">
            {{ policyError }}
          </n-alert>

          <n-space>
            <n-button data-testid="account-policy-policy-refresh" :loading="policyLoading" @click="loadPolicyStatus">
              {{ t('admin.accountPolicy.policy.refresh') }}
            </n-button>
          </n-space>

          <n-card
            v-if="policyStatus"
            data-testid="account-policy-policy-status"
            :title="t('admin.accountPolicy.policy.statusTitle')">
            <n-descriptions :column="2" bordered size="small" label-placement="left">
              <n-descriptions-item :label="t('admin.accountPolicy.policy.enabled')">
                {{ policyStatus.enabled ? t('admin.accountPolicy.policy.on') : t('admin.accountPolicy.policy.off') }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.accountPolicy.policy.endpoint')">
                {{ policyStatus.endpoint || '-' }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.accountPolicy.policy.failMode')">
                {{
                  policyStatus.fail_mode === 'fail_closed'
                    ? t('admin.accountPolicy.policy.failClosed')
                    : t('admin.accountPolicy.policy.failOpen')
                }}
              </n-descriptions-item>
            </n-descriptions>
          </n-card>

          <n-card :title="t('admin.accountPolicy.policy.checkTitle')">
            <n-space vertical>
              <n-input
                v-model:value="policyRoomId"
                data-testid="account-policy-policy-room"
                :placeholder="t('admin.accountPolicy.policy.roomIdPlaceholder')" />
              <n-input
                v-model:value="policyUserId"
                data-testid="account-policy-policy-user"
                :placeholder="t('admin.accountPolicy.policy.userIdPlaceholder')" />
              <n-space align="center">
                <n-select
                  v-model:value="policyAction"
                  data-testid="account-policy-policy-action"
                  :options="policyActionOptions"
                  class="w-[200px]" />
                <n-button
                  data-testid="account-policy-policy-check"
                  type="primary"
                  :loading="policyChecking"
                  @click="handlePolicyCheck">
                  {{ t('admin.accountPolicy.policy.check') }}
                </n-button>
              </n-space>
            </n-space>
          </n-card>

          <n-alert
            v-if="policyResult"
            data-testid="account-policy-policy-result"
            :type="policyResult.allowed ? 'success' : 'warning'"
            :bordered="false">
            {{
              policyResult.allowed ? t('admin.accountPolicy.policy.allowed') : t('admin.accountPolicy.policy.denied')
            }}
            <span v-if="policyResult.reason">- {{ policyResult.reason }}</span>
          </n-alert>
        </n-space>
      </n-tab-pane>

      <n-tab-pane name="rate-limit" :tab="t('admin.accountPolicy.tabs.rateLimit')">
        <n-space vertical size="large">
          <n-alert :bordered="false" type="info">{{ t('admin.accountPolicy.rateLimit.hint') }}</n-alert>

          <n-alert
            v-if="rateLimitError"
            data-testid="account-policy-rate-limit-error"
            type="error"
            closable
            @close="rateLimitError = null">
            {{ rateLimitError }}
          </n-alert>

          <n-space>
            <n-button
              data-testid="account-policy-rate-limit-refresh"
              :loading="rateLimitLoading"
              @click="loadRateLimit">
              {{ t('admin.accountPolicy.rateLimit.refresh') }}
            </n-button>
          </n-space>

          <n-card
            v-if="rateLimit"
            data-testid="account-policy-rate-limit-status"
            :title="t('admin.accountPolicy.rateLimit.statusTitle')">
            <n-descriptions :column="2" bordered size="small" label-placement="left">
              <n-descriptions-item :label="t('admin.accountPolicy.rateLimit.enabled')">
                {{ rateLimit.enabled ? t('admin.accountPolicy.policy.on') : t('admin.accountPolicy.policy.off') }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.accountPolicy.rateLimit.backend')">
                {{ rateLimit.backend }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.accountPolicy.rateLimit.redis')">
                {{
                  rateLimit.redis_available
                    ? t('admin.accountPolicy.rateLimit.available')
                    : t('admin.accountPolicy.rateLimit.unavailable')
                }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.accountPolicy.rateLimit.activeRules')">
                {{ rateLimit.active_rules }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.accountPolicy.rateLimit.exemptPaths')">
                {{ rateLimit.exempt_paths }}
              </n-descriptions-item>
            </n-descriptions>
          </n-card>

          <n-card v-if="rateLimit" :title="t('admin.accountPolicy.rateLimit.metricsTitle')">
            <div class="metrics-grid">
              <div v-for="metric in rateLimitMetrics" :key="metric.key" class="metric-item">
                <span class="metric-label">{{ metric.label }}</span>
                <span class="metric-value">{{ metric.value }}</span>
              </div>
            </div>
          </n-card>
        </n-space>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import {
  type DataTableColumns,
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NDatePicker,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NSwitch,
  NTabPane,
  NTabs,
  NTag
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminAccountPolicy } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { AdminPasswordAuthProvider, PolicyCheckAction } from '@/services/matrix/admin'

defineOptions({
  name: 'AdminAccountPolicy'
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const {
  validity,
  validityLoading,
  validitySaving,
  validityError,
  providers,
  providersLoading,
  providersSaving,
  providersError,
  policyStatus,
  policyLoading,
  policyChecking,
  policyError,
  policyResult,
  rateLimit,
  rateLimitLoading,
  rateLimitError,
  loadValidity,
  setValidity,
  renewValidity,
  loadProviders,
  createProvider,
  loadPolicyStatus,
  runPolicyCheck,
  loadRateLimit
} = useAdminAccountPolicy()

const activeTab = ref('validity')

const validityUserId = ref('')
const setExpiration = ref<number | null>(null)
const renewalToken = ref('')
const renewExpiration = ref<number | null>(null)

const providerDraft = ref({ providerName: '', providerType: '', isEnabled: true })
const providerPriority = ref<number | null>(100)
const providerConfig = ref('{}')

const policyRoomId = ref('')
const policyUserId = ref('')
const policyAction = ref<PolicyCheckAction>('join')

const policyActionOptions = computed(() => [
  { label: t('admin.accountPolicy.policy.actions.create'), value: 'create' },
  { label: t('admin.accountPolicy.policy.actions.join'), value: 'join' },
  { label: t('admin.accountPolicy.policy.actions.invite'), value: 'invite' },
  { label: t('admin.accountPolicy.policy.actions.send'), value: 'send' }
])

const rateLimitMetrics = computed(() => {
  const metrics = rateLimit.value?.metrics
  if (!metrics) return []
  return [
    { key: 'requests_total', label: t('admin.accountPolicy.rateLimit.requestsTotal'), value: metrics.requests_total },
    { key: 'rejected_total', label: t('admin.accountPolicy.rateLimit.rejectedTotal'), value: metrics.rejected_total },
    { key: 'allowed_total', label: t('admin.accountPolicy.rateLimit.allowedTotal'), value: metrics.allowed_total },
    { key: 'exempt_total', label: t('admin.accountPolicy.rateLimit.exemptTotal'), value: metrics.exempt_total },
    { key: 'fail_open_total', label: t('admin.accountPolicy.rateLimit.failOpenTotal'), value: metrics.fail_open_total },
    {
      key: 'fail_closed_total',
      label: t('admin.accountPolicy.rateLimit.failClosedTotal'),
      value: metrics.fail_closed_total
    },
    {
      key: 'rejected_ratio_percent',
      label: t('admin.accountPolicy.rateLimit.rejectedRatio'),
      value: `${metrics.rejected_ratio_percent}%`
    }
  ]
})

const providerColumns: DataTableColumns<AdminPasswordAuthProvider> = [
  { title: 'ID', key: 'id', width: 80 },
  { title: t('admin.accountPolicy.providers.table.name'), key: 'provider_name', ellipsis: { tooltip: true } },
  { title: t('admin.accountPolicy.providers.table.type'), key: 'provider_type', width: 140 },
  {
    title: t('admin.accountPolicy.providers.table.enabled'),
    key: 'is_enabled',
    width: 110,
    render: (row) =>
      h(
        NTag,
        { size: 'small', type: row.is_enabled ? 'success' : 'default' },
        { default: () => (row.is_enabled ? t('admin.accountPolicy.policy.on') : t('admin.accountPolicy.policy.off')) }
      )
  },
  { title: t('admin.accountPolicy.providers.table.priority'), key: 'priority', width: 100 },
  {
    title: t('admin.accountPolicy.providers.table.createdAt'),
    key: 'created_ts',
    width: 180,
    render: (row) => formatTs(row.created_ts)
  }
]

function formatTs(ts: number | null | undefined): string {
  return ts ? new Date(ts).toLocaleString() : '-'
}

async function handleLoadValidity() {
  const userId = validityUserId.value.trim()
  if (!userId) {
    showFeedback(t('admin.accountPolicy.validity.userIdRequired'), 'error')
    return
  }
  await loadValidity(userId)
}

async function handleSetValidity() {
  const userId = validityUserId.value.trim()
  if (!userId) {
    showFeedback(t('admin.accountPolicy.validity.userIdRequired'), 'error')
    return
  }
  if (!setExpiration.value) {
    showFeedback(t('admin.accountPolicy.validity.expirationRequired'), 'error')
    return
  }
  const ok = await setValidity(userId, setExpiration.value)
  showFeedback(
    ok ? t('admin.accountPolicy.validity.setSuccess') : t('admin.accountPolicy.validity.setFailed'),
    ok ? 'success' : 'error'
  )
}

async function handleRenewValidity() {
  const userId = validityUserId.value.trim()
  if (!userId) {
    showFeedback(t('admin.accountPolicy.validity.userIdRequired'), 'error')
    return
  }
  if (!renewalToken.value.trim()) {
    showFeedback(t('admin.accountPolicy.validity.renewalTokenRequired'), 'error')
    return
  }
  if (!renewExpiration.value) {
    showFeedback(t('admin.accountPolicy.validity.expirationRequired'), 'error')
    return
  }
  const ok = await renewValidity(userId, renewalToken.value.trim(), renewExpiration.value)
  showFeedback(
    ok ? t('admin.accountPolicy.validity.renewSuccess') : t('admin.accountPolicy.validity.renewFailed'),
    ok ? 'success' : 'error'
  )
}

async function handleCreateProvider() {
  const providerName = providerDraft.value.providerName.trim()
  const providerType = providerDraft.value.providerType.trim()
  if (!providerName) {
    showFeedback(t('admin.accountPolicy.providers.nameRequired'), 'error')
    return
  }
  if (!providerType) {
    showFeedback(t('admin.accountPolicy.providers.typeRequired'), 'error')
    return
  }
  let config: Record<string, unknown>
  try {
    const parsed = JSON.parse(providerConfig.value || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid')
    config = parsed as Record<string, unknown>
  } catch {
    showFeedback(t('admin.accountPolicy.providers.configInvalid'), 'error')
    return
  }
  const ok = await createProvider({
    providerName,
    providerType,
    config,
    isEnabled: providerDraft.value.isEnabled,
    priority: providerPriority.value ?? 0
  })
  if (!ok) {
    showFeedback(t('admin.accountPolicy.providers.createFailed'), 'error')
    return
  }
  providerDraft.value = { providerName: '', providerType: '', isEnabled: true }
  providerPriority.value = 100
  providerConfig.value = '{}'
  showFeedback(t('admin.accountPolicy.providers.created'), 'success')
}

async function handlePolicyCheck() {
  const roomId = policyRoomId.value.trim()
  const userId = policyUserId.value.trim()
  if (!roomId || !userId) {
    showFeedback(t('admin.accountPolicy.policy.required'), 'error')
    return
  }
  const ok = await runPolicyCheck({ room_id: roomId, user_id: userId, action: policyAction.value })
  if (!ok) {
    showFeedback(t('admin.accountPolicy.policy.checkFailed'), 'error')
  }
}

onMounted(() => {
  loadProviders()
  loadPolicyStatus()
  loadRateLimit()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;

.admin-account-policy {
  max-width: 1200px;
}

.tabs {
  margin-top: 16px;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.metric-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--n-color-modal);
}

.metric-label {
  font-size: 13px;
  color: var(--n-text-color-2);
}

.metric-value {
  font-size: 13px;
  color: var(--n-text-color);
}

@include responsive.down('md') {
  .tab-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
