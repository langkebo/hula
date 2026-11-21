<template>
  <n-space vertical size="large">
    <n-alert :bordered="false" type="info">{{ t('admin.callbacks.accountData.hint') }}</n-alert>

    <n-space>
      <n-button
        data-testid="admin-callbacks-account-refresh"
        :loading="accountDataLoading"
        @click="loadAccountDataCallbacks">
        {{ t('admin.callbacks.accountData.refresh') }}
      </n-button>
    </n-space>

    <n-alert
      v-if="accountDataError"
      data-testid="admin-callbacks-account-error"
      type="error"
      closable
      @close="accountDataError = null">
      {{ accountDataError }}
    </n-alert>

    <AdminTable
      :columns="accountDataColumns"
      :data="accountDataCallbacks"
      :loading="accountDataLoading"
      :row-key="(row: AdminAccountDataCallback) => row.id"
      :scroll-x="720">
      <template #empty>
        <EmptyState data-testid="admin-callbacks-account-empty" :description="t('admin.callbacks.accountData.empty')" />
      </template>
    </AdminTable>

    <n-card :title="t('admin.callbacks.accountData.createTitle')">
      <n-form label-placement="top">
        <n-space vertical>
          <n-form-item :label="t('admin.callbacks.accountData.name')">
            <n-input
              v-model:value="accountDraft.callbackName"
              data-testid="admin-callbacks-account-name"
              :placeholder="t('admin.callbacks.accountData.namePlaceholder')" />
          </n-form-item>
          <n-form-item :label="t('admin.callbacks.accountData.dataTypes')">
            <n-input
              v-model:value="accountDraft.dataTypes"
              data-testid="admin-callbacks-account-types"
              :placeholder="t('admin.callbacks.accountData.dataTypesPlaceholder')" />
          </n-form-item>
          <n-form-item :label="t('admin.callbacks.accountData.config')">
            <n-input
              v-model:value="accountConfig"
              data-testid="admin-callbacks-account-config"
              type="textarea"
              :rows="4"
              :placeholder="t('admin.callbacks.accountData.configPlaceholder')" />
          </n-form-item>
          <n-space align="center">
            <n-switch v-model:value="accountDraft.isEnabled" data-testid="admin-callbacks-account-enabled" />
            <span>{{ t('admin.callbacks.accountData.enabled') }}</span>
          </n-space>
          <n-space>
            <n-button
              data-testid="admin-callbacks-account-submit"
              type="primary"
              :loading="accountDataSaving"
              @click="handleCreateAccountData">
              {{ t('admin.callbacks.accountData.submit') }}
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
  NForm,
  NFormItem,
  NInput,
  NSpace,
  NSwitch,
  NTag
} from 'naive-ui'
import { h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminTable from '@/components/admin/AdminTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useAdminCallbacks } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { AdminAccountDataCallback } from '@/services/matrix/admin'

defineOptions({ name: 'AccountDataCallbacksPanel' })

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const {
  accountDataCallbacks,
  accountDataLoading,
  accountDataSaving,
  accountDataError,
  loadAccountDataCallbacks,
  createAccountDataCallback
} = useAdminCallbacks()

const accountConfig = ref('{}')
const accountDraft = ref({
  callbackName: '',
  dataTypes: '',
  isEnabled: true
})

function formatTs(ts: number | null): string {
  if (!ts) return '-'
  return new Date(ts > 1e12 ? ts : ts * 1000).toLocaleString()
}

const accountDataColumns: DataTableColumns<AdminAccountDataCallback> = [
  { title: t('admin.callbacks.accountData.column.id'), key: 'id', width: 80 },
  {
    title: t('admin.callbacks.accountData.column.name'),
    key: 'callback_name',
    width: 200,
    ellipsis: { tooltip: true }
  },
  {
    title: t('admin.callbacks.accountData.column.dataTypes'),
    key: 'data_types',
    width: 260,
    render: (row) => (row.data_types && row.data_types.length > 0 ? row.data_types.join(', ') : '-')
  },
  {
    title: t('admin.callbacks.accountData.column.enabled'),
    key: 'is_enabled',
    width: 100,
    render: (row) =>
      h(NTag, { size: 'small', type: row.is_enabled ? 'success' : 'default' }, () =>
        row.is_enabled ? t('admin.callbacks.enabled') : t('admin.callbacks.disabled')
      )
  },
  {
    title: t('admin.callbacks.accountData.column.created'),
    key: 'created_ts',
    width: 180,
    render: (row) => formatTs(row.created_ts)
  }
]

async function handleCreateAccountData(): Promise<void> {
  if (!accountDraft.value.callbackName.trim()) {
    showFeedback(t('admin.callbacks.accountData.requiredName'), 'error')
    return
  }
  let config: Record<string, unknown>
  try {
    const parsed = JSON.parse(accountConfig.value || '{}')
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      showFeedback(t('admin.callbacks.accountData.invalidConfig'), 'error')
      return
    }
    config = parsed as Record<string, unknown>
  } catch {
    showFeedback(t('admin.callbacks.accountData.invalidConfig'), 'error')
    return
  }
  const ok = await createAccountDataCallback({
    callbackName: accountDraft.value.callbackName,
    dataTypes: accountDraft.value.dataTypes,
    config,
    isEnabled: accountDraft.value.isEnabled
  })
  showFeedback(
    ok ? t('admin.callbacks.accountData.success') : t('admin.callbacks.accountData.failed'),
    ok ? 'success' : 'error'
  )
  if (ok) {
    accountDraft.value = { callbackName: '', dataTypes: '', isEnabled: true }
    accountConfig.value = '{}'
  }
}

onMounted(() => {
  void loadAccountDataCallbacks()
})
</script>
