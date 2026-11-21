<template>
  <n-space vertical size="large">
    <n-alert :bordered="false" type="info">{{ t('admin.callbacks.media.hint') }}</n-alert>

    <div class="tab-header">
      <n-space align="center" :wrap="true">
        <n-input
          v-model:value="mediaType"
          data-testid="admin-callbacks-media-filter"
          :placeholder="t('admin.callbacks.media.filterPlaceholder')"
          clearable
          class="w-[240px]" />
        <n-button data-testid="admin-callbacks-media-refresh" :loading="mediaLoading" @click="handleLoadMedia">
          {{ t('admin.callbacks.media.refresh') }}
        </n-button>
      </n-space>
    </div>

    <n-alert
      v-if="mediaError"
      data-testid="admin-callbacks-media-error"
      type="error"
      closable
      @close="mediaError = null">
      {{ mediaError }}
    </n-alert>

    <AdminTable
      :columns="mediaColumns"
      :data="mediaCallbacks"
      :loading="mediaLoading"
      :row-key="(row: AdminMediaCallback) => row.id"
      :scroll-x="960">
      <template #empty>
        <EmptyState data-testid="admin-callbacks-media-empty" :description="t('admin.callbacks.media.empty')" />
      </template>
    </AdminTable>

    <n-card :title="t('admin.callbacks.media.createTitle')">
      <n-form label-placement="top">
        <n-space vertical>
          <n-form-item :label="t('admin.callbacks.media.name')">
            <n-input
              v-model:value="mediaDraft.callbackName"
              data-testid="admin-callbacks-media-name"
              :placeholder="t('admin.callbacks.media.namePlaceholder')" />
          </n-form-item>
          <n-form-item :label="t('admin.callbacks.media.type')">
            <n-input
              v-model:value="mediaDraft.callbackType"
              data-testid="admin-callbacks-media-type"
              :placeholder="t('admin.callbacks.media.typePlaceholder')" />
          </n-form-item>
          <n-form-item :label="t('admin.callbacks.media.url')">
            <n-input
              v-model:value="mediaDraft.url"
              data-testid="admin-callbacks-media-url"
              :placeholder="t('admin.callbacks.media.urlPlaceholder')" />
          </n-form-item>
          <n-space align="center" :wrap="true">
            <n-input
              v-model:value="mediaDraft.method"
              data-testid="admin-callbacks-media-method"
              :placeholder="t('admin.callbacks.media.methodPlaceholder')"
              class="w-[160px]" />
            <n-input-number
              v-model:value="mediaDraft.timeoutMs"
              data-testid="admin-callbacks-media-timeout"
              :min="1"
              class="w-[180px]" />
            <n-input-number
              v-model:value="mediaDraft.retryCount"
              data-testid="admin-callbacks-media-retry"
              :min="0"
              class="w-[180px]" />
            <n-switch v-model:value="mediaDraft.isEnabled" data-testid="admin-callbacks-media-enabled" />
            <span>{{ t('admin.callbacks.media.enabled') }}</span>
          </n-space>
          <n-space>
            <n-button
              data-testid="admin-callbacks-media-submit"
              type="primary"
              :loading="mediaSaving"
              @click="handleCreateMedia">
              {{ t('admin.callbacks.media.submit') }}
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
  NInputNumber,
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
import type { AdminMediaCallback } from '@/services/matrix/admin'

defineOptions({ name: 'MediaCallbacksPanel' })

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { mediaCallbacks, mediaLoading, mediaSaving, mediaError, loadMediaCallbacks, createMediaCallback } =
  useAdminCallbacks()

const mediaType = ref('')
const mediaDraft = ref({
  callbackName: '',
  callbackType: '',
  url: '',
  method: 'POST',
  timeoutMs: 5000,
  retryCount: 0,
  isEnabled: true
})

function formatTs(ts: number | null): string {
  if (!ts) return '-'
  return new Date(ts > 1e12 ? ts : ts * 1000).toLocaleString()
}

function formatResult(result: unknown): string {
  if (result === null || result === undefined) return '-'
  if (typeof result === 'string') return result
  try {
    return JSON.stringify(result)
  } catch {
    return String(result)
  }
}

const mediaColumns: DataTableColumns<AdminMediaCallback> = [
  { title: t('admin.callbacks.media.column.id'), key: 'id', width: 80 },
  {
    title: t('admin.callbacks.media.column.callbackType'),
    key: 'callback_type',
    width: 160,
    ellipsis: { tooltip: true }
  },
  { title: t('admin.callbacks.media.column.mediaId'), key: 'media_id', width: 200, ellipsis: { tooltip: true } },
  { title: t('admin.callbacks.media.column.userId'), key: 'user_id', width: 200, ellipsis: { tooltip: true } },
  {
    title: t('admin.callbacks.media.column.status'),
    key: 'status',
    width: 120,
    render: (row) => h(NTag, { size: 'small', type: 'info' }, () => row.status)
  },
  {
    title: t('admin.callbacks.media.column.result'),
    key: 'result',
    width: 220,
    ellipsis: { tooltip: true },
    render: (row) => formatResult(row.result)
  },
  {
    title: t('admin.callbacks.media.column.created'),
    key: 'created_ts',
    width: 180,
    render: (row) => formatTs(row.created_ts)
  },
  {
    title: t('admin.callbacks.media.column.completed'),
    key: 'completed_ts',
    width: 180,
    render: (row) => formatTs(row.completed_ts)
  },
  {
    title: t('admin.callbacks.media.column.enabled'),
    key: 'is_enabled',
    width: 100,
    render: (row) =>
      h(NTag, { size: 'small', type: row.is_enabled ? 'success' : 'default' }, () =>
        row.is_enabled ? t('admin.callbacks.enabled') : t('admin.callbacks.disabled')
      )
  }
]

function handleLoadMedia(): void {
  void loadMediaCallbacks(mediaType.value)
}

async function handleCreateMedia(): Promise<void> {
  if (!mediaDraft.value.callbackName.trim()) {
    showFeedback(t('admin.callbacks.media.requiredName'), 'error')
    return
  }
  if (!mediaDraft.value.callbackType.trim()) {
    showFeedback(t('admin.callbacks.media.requiredType'), 'error')
    return
  }
  if (!mediaDraft.value.url.trim()) {
    showFeedback(t('admin.callbacks.media.requiredUrl'), 'error')
    return
  }
  const ok = await createMediaCallback({
    callbackName: mediaDraft.value.callbackName,
    callbackType: mediaDraft.value.callbackType,
    url: mediaDraft.value.url,
    method: mediaDraft.value.method,
    timeoutMs: mediaDraft.value.timeoutMs ?? 5000,
    retryCount: mediaDraft.value.retryCount ?? 0,
    isEnabled: mediaDraft.value.isEnabled
  })
  showFeedback(ok ? t('admin.callbacks.media.success') : t('admin.callbacks.media.failed'), ok ? 'success' : 'error')
  if (ok) {
    mediaDraft.value = {
      callbackName: '',
      callbackType: '',
      url: '',
      method: 'POST',
      timeoutMs: 5000,
      retryCount: 0,
      isEnabled: true
    }
  }
}

onMounted(() => {
  void loadMediaCallbacks()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;

.tab-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

@include responsive.down('md') {
  .tab-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
