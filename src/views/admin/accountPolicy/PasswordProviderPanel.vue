<template>
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

    <EmptyState
      v-if="showProvidersEmpty"
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
</template>

<script setup lang="ts">
import {
  type DataTableColumns,
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSpace,
  NSwitch,
  NTag
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import { useAdminAccountPolicy } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { AdminPasswordAuthProvider } from '@/services/matrix/admin'

defineOptions({ name: 'PasswordProviderPanel' })

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { providers, providersLoading, providersSaving, providersError, loadProviders, createProvider } =
  useAdminAccountPolicy()

const providerDraft = ref({ providerName: '', providerType: '', isEnabled: true })
const providerPriority = ref<number | null>(100)
const providerConfig = ref('{}')

const showProvidersEmpty = computed(() => !providersLoading.value && providers.value.length === 0)

function formatTs(ts: number | null | undefined): string {
  return ts ? new Date(ts).toLocaleString() : '-'
}

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

async function handleCreateProvider(): Promise<void> {
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

onMounted(() => {
  void loadProviders()
})
</script>
