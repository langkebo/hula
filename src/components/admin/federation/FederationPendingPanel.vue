<template>
  <div class="federation-pending-panel">
    <div class="panel-header">
      <n-button data-test="pending-refresh" @click="loadPending">
        {{ t('admin.common.refresh') }}
      </n-button>
    </div>

    <n-alert v-if="pendingError" type="error" :bordered="false" class="mb-12px" data-test="pending-error">
      {{ pendingError }}
    </n-alert>

    <AdminTable
      :columns="columns"
      :data="pendingServers"
      :loading="pendingLoading"
      :pagination="{ pageSize: 20 }"
      :bordered="false"
      :row-key="(row: PendingFederationServer) => row.serverName"
      :empty-hidden="Boolean(pendingError)">
      <template #empty>
        <EmptyState data-test="pending-empty" :description="t('admin.federation.pendingEmpty')" />
      </template>
    </AdminTable>
  </div>
</template>

<script setup lang="ts">
import { type DataTableColumns, NAlert, NButton, NSpace, NTag, useDialog } from 'naive-ui'
import { computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminTable from '@/components/admin/AdminTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useAdminFederation } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { PendingFederationServer } from '@/services/matrix/admin'

const { t } = useI18n()
const dialog = useDialog()
const { showFeedback } = useActionFeedback()
const { pendingServers, pendingLoading, pendingError, loadPending, confirmPending } = useAdminFederation()

function formatTime(ts: number | null): string {
  return ts ? new Date(ts).toLocaleString() : '-'
}

const columns = computed<DataTableColumns<PendingFederationServer>>(() => [
  {
    title: t('admin.federation.destination'),
    key: 'serverName',
    ellipsis: { tooltip: true },
    width: 240
  },
  {
    title: t('admin.federation.failureCount'),
    key: 'failureCount',
    width: 110
  },
  {
    title: t('admin.federation.lastFailedConnectAt'),
    key: 'lastFailedConnectAt',
    width: 180,
    render: (row) => formatTime(row.lastFailedConnectAt)
  },
  {
    title: t('admin.federation.lastSuccessfulConnectAt'),
    key: 'lastSuccessfulConnectAt',
    width: 180,
    render: (row) => formatTime(row.lastSuccessfulConnectAt)
  },
  {
    title: t('admin.federation.status'),
    key: 'status',
    width: 120,
    render: (row) => h(NTag, { size: 'small', type: 'warning' }, () => row.status)
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 160,
    render: (row) =>
      h(NSpace, { size: 8 }, () => [
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            class: 'pending-accept-btn',
            onClick: () => handleConfirm(row.serverName, true)
          },
          () => t('admin.federation.accept')
        ),
        h(
          NButton,
          {
            size: 'small',
            type: 'error',
            class: 'pending-reject-btn',
            onClick: () => handleConfirm(row.serverName, false)
          },
          () => t('admin.federation.reject')
        )
      ])
  }
])

function handleConfirm(serverName: string, accept: boolean) {
  const action = accept ? t('admin.federation.accept') : t('admin.federation.reject')
  dialog.warning({
    title: action,
    content: t('admin.federation.confirmPendingConfirm', { action, server: serverName }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      const ok = await confirmPending(serverName, accept)
      showFeedback(
        ok ? t('admin.federation.confirmPendingSuccess') : t('admin.federation.confirmPendingFailed'),
        ok ? 'success' : 'error'
      )
    }
  })
}

onMounted(() => {
  void loadPending()
})
</script>

<style scoped>
.panel-header {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 16px;
}
</style>
