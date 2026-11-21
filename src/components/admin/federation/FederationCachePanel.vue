<template>
  <div class="federation-cache-panel">
    <div class="panel-header">
      <n-button data-test="cache-refresh" @click="loadCache">
        {{ t('admin.common.refresh') }}
      </n-button>
      <n-button
        type="error"
        ghost
        data-test="cache-clear"
        :disabled="cacheEntries.length === 0"
        @click="handleClearCache">
        {{ t('admin.federation.cacheClear') }}
      </n-button>
    </div>

    <n-alert v-if="cacheError" type="error" :bordered="false" class="mb-12px" data-test="cache-error">
      {{ cacheError }}
    </n-alert>

    <AdminTable
      :columns="columns"
      :data="cacheEntries"
      :loading="cacheLoading"
      :pagination="{ pageSize: 20 }"
      :bordered="false"
      :row-key="(row: FederationCacheEntry) => row.key">
      <template #empty>
        <EmptyState data-test="cache-empty" :description="t('admin.federation.cacheEmpty')" />
      </template>
    </AdminTable>
  </div>
</template>

<script setup lang="ts">
import { type DataTableColumns, NAlert, NButton, useDialog } from 'naive-ui'
import { computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminTable from '@/components/admin/AdminTable.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { useAdminFederation } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { FederationCacheEntry } from '@/services/matrix/admin'

const { t } = useI18n()
const dialog = useDialog()
const { showFeedback } = useActionFeedback()
const { cacheEntries, cacheLoading, cacheError, loadCache, clearCache, removeCacheEntry } = useAdminFederation()

/** 加载完成、无错误且无缓存条目时才展示空态 */

function formatTime(ts: number | null): string {
  return ts ? new Date(ts).toLocaleString() : '-'
}

function summarizeValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > 80 ? `${text.slice(0, 80)}…` : text
}

const columns = computed<DataTableColumns<FederationCacheEntry>>(() => [
  {
    title: t('admin.federation.cacheKey'),
    key: 'key',
    ellipsis: { tooltip: true },
    width: 260
  },
  {
    title: t('admin.federation.cacheExpiry'),
    key: 'expiryTs',
    width: 180,
    render: (row) => formatTime(row.expiryTs)
  },
  {
    title: t('admin.federation.cacheValue'),
    key: 'value',
    ellipsis: { tooltip: true },
    render: (row) => summarizeValue(row.value)
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      h(
        NButton,
        { size: 'small', type: 'error', class: 'cache-delete-btn', onClick: () => handleRemoveEntry(row.key) },
        () => t('admin.common.delete')
      )
  }
])

function handleClearCache() {
  dialog.warning({
    title: t('admin.federation.cacheClear'),
    content: t('admin.federation.cacheClearConfirm'),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      const ok = await clearCache()
      showFeedback(
        ok ? t('admin.federation.cacheCleared') : t('admin.federation.cacheClearFailed'),
        ok ? 'success' : 'error'
      )
    }
  })
}

function handleRemoveEntry(key: string) {
  dialog.warning({
    title: t('admin.federation.cacheClear'),
    content: t('admin.federation.deleteCacheConfirm', { key }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      const ok = await removeCacheEntry(key)
      showFeedback(
        ok ? t('admin.federation.deleteCacheSuccess') : t('admin.federation.deleteCacheFailed'),
        ok ? 'success' : 'error'
      )
    }
  })
}

onMounted(() => {
  void loadCache()
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
