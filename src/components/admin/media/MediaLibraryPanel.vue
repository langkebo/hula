<script setup lang="ts">
import {
  type DataTableColumns,
  NButton,
  NDataTable,
  NDatePicker,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSpace,
  NTag
} from 'naive-ui'
import { h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type MediaLibraryItem, type UseAdminMedia, useAdminMedia } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { formatBytes } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'

type MediaHistoryEntry = Awaited<ReturnType<UseAdminMedia['loadMediaQuarantineHistory']>>[number]

const { t } = useI18n()
const logger = createLogger('AdminMediaLibrary')
const { showFeedback } = useActionFeedback()
const {
  library,
  libraryNextBatch,
  libraryLoading,
  selectedMedia,
  detailLoading,
  mutating,
  loadLibrary,
  loadMoreLibrary,
  openMediaDetail,
  closeMediaDetail,
  loadMediaQuarantineHistory,
  quarantine,
  unquarantine,
  protect,
  unprotect,
  deleteOne,
  deleteByPolicy
} = useAdminMedia()

const detailVisible = ref(false)
const history = ref<MediaHistoryEntry[]>([])
const policyVisible = ref(false)
const policyBeforeTs = ref<number | null>(null)
const policyMaxSize = ref<number | null>(null)

const formatDateTime = (timestamp?: number): string =>
  typeof timestamp === 'number' && timestamp > 0 ? new Date(timestamp).toLocaleString() : '-'

/**
 * 媒体库只返回本服务器媒体，服务器名以当前 homeserver 域名为准。
 * 媒体 ID 若显式带有形如域名的前缀则优先采用，避免臆造服务器名。
 */
const resolveServerName = (mediaId: string): string => {
  const prefix = mediaId.includes('_') ? mediaId.split('_')[0] : ''
  if (prefix.includes('.')) {
    return prefix
  }
  return matrixClientService.getClient()?.getDomain() ?? ''
}

const runAction = async (action: () => Promise<unknown>, successKey: string): Promise<void> => {
  try {
    await action()
    showFeedback(t(successKey), 'success')
  } catch (error) {
    logger.error('media action failed', { error: error instanceof Error ? error.message : String(error) })
    showFeedback(t('admin.media.feedback.failed'), 'error')
  }
}

const requireServerName = (mediaId: string): string | null => {
  const serverName = resolveServerName(mediaId)
  if (!serverName) {
    showFeedback(t('admin.media.feedback.failed'), 'error')
    return null
  }
  return serverName
}

const handleDetail = async (row: MediaLibraryItem): Promise<void> => {
  detailVisible.value = true
  try {
    await openMediaDetail(row.mediaId)
    history.value = await loadMediaQuarantineHistory(row.mediaId)
  } catch (error) {
    logger.error('load media detail failed', { error: error instanceof Error ? error.message : String(error) })
    showFeedback(t('admin.media.feedback.failed'), 'error')
  }
}

const handleDetailVisibleChange = (visible: boolean): void => {
  detailVisible.value = visible
  if (!visible) {
    history.value = []
    closeMediaDetail()
  }
}

const handleQuarantine = (row: MediaLibraryItem): Promise<void> => {
  const serverName = requireServerName(row.mediaId)
  if (!serverName) return Promise.resolve()
  return runAction(() => quarantine(serverName, row.mediaId), 'admin.media.feedback.quarantine_success')
}

const handleUnquarantine = (row: MediaLibraryItem): Promise<void> => {
  const serverName = requireServerName(row.mediaId)
  if (!serverName) return Promise.resolve()
  return runAction(() => unquarantine(serverName, row.mediaId), 'admin.media.feedback.unquarantine_success')
}

const handleProtect = (row: MediaLibraryItem): Promise<void> => {
  const serverName = requireServerName(row.mediaId)
  if (!serverName) return Promise.resolve()
  return runAction(() => protect(serverName, row.mediaId), 'admin.media.feedback.protect_success')
}

const handleUnprotect = (row: MediaLibraryItem): Promise<void> =>
  runAction(() => unprotect(row.mediaId), 'admin.media.feedback.unprotect_success')

const handleDelete = (row: MediaLibraryItem): Promise<void> =>
  runAction(() => deleteOne(resolveServerName(row.mediaId) || null, row.mediaId), 'admin.media.feedback.delete_success')

const refresh = (): Promise<void> => loadLibrary()

const openPolicyModal = (): void => {
  policyBeforeTs.value = null
  policyMaxSize.value = null
  policyVisible.value = true
}

const handlePolicyDelete = async (): Promise<void> => {
  const options: { beforeTs?: number; maxSize?: number } = {}
  if (policyBeforeTs.value) options.beforeTs = policyBeforeTs.value
  if (policyMaxSize.value) options.maxSize = policyMaxSize.value
  try {
    const deleted = await deleteByPolicy(options)
    showFeedback(t('admin.media.feedback.policy_deleted', { count: deleted }), 'success')
    policyVisible.value = false
    await loadLibrary()
  } catch (error) {
    logger.error('delete media by policy failed', { error: error instanceof Error ? error.message : String(error) })
    showFeedback(t('admin.media.feedback.failed'), 'error')
  }
}

const renderActions = (row: MediaLibraryItem) =>
  h(NSpace, { size: 4, wrap: false }, () => [
    h(NButton, { size: 'small', text: true, onClick: () => void handleDetail(row) }, () =>
      t('admin.media.action.detail')
    ),
    h(NButton, { size: 'small', text: true, onClick: () => void handleQuarantine(row) }, () =>
      t('admin.media.action.quarantine')
    ),
    h(NButton, { size: 'small', text: true, onClick: () => void handleUnquarantine(row) }, () =>
      t('admin.media.action.unquarantine')
    ),
    h(NButton, { size: 'small', text: true, onClick: () => void handleProtect(row) }, () =>
      t('admin.media.action.protect')
    ),
    h(NButton, { size: 'small', text: true, onClick: () => void handleUnprotect(row) }, () =>
      t('admin.media.action.unprotect')
    ),
    h(
      NPopconfirm,
      { onPositiveClick: () => void handleDelete(row) },
      {
        trigger: () => h(NButton, { size: 'small', text: true, type: 'error' }, () => t('admin.media.action.delete')),
        default: () => t('admin.media.action.deleteConfirm')
      }
    )
  ])

const columns: DataTableColumns<MediaLibraryItem> = [
  { title: t('admin.media.column.mediaId'), key: 'mediaId', width: 200, ellipsis: { tooltip: true } },
  { title: t('admin.media.column.type'), key: 'mediaType', width: 140 },
  { title: t('admin.media.column.name'), key: 'uploadName', width: 180, ellipsis: { tooltip: true } },
  {
    title: t('admin.media.column.size'),
    key: 'mediaLength',
    width: 110,
    render: (row) => formatBytes(row.mediaLength ?? 0)
  },
  {
    title: t('admin.media.column.created'),
    key: 'createdAt',
    width: 180,
    render: (row) => formatDateTime(row.createdAt)
  },
  { title: t('admin.media.column.actions'), key: 'actions', width: 360, render: renderActions }
]

const historyColumns: DataTableColumns<MediaHistoryEntry> = [
  {
    title: t('admin.media.column.created'),
    key: 'created_ts',
    width: 180,
    render: (row) => formatDateTime(row.created_ts)
  },
  { title: t('admin.media.column.type'), key: 'change_type', width: 120 },
  { title: t('admin.media.column.mediaId'), key: 'media_id', ellipsis: { tooltip: true } }
]

onMounted(() => {
  void loadLibrary()
})
</script>

<template>
  <div class="media-library-panel">
    <n-space class="mb-12px" align="center">
      <n-button type="primary" @click="openPolicyModal">{{ t('admin.media.action.policyDelete') }}</n-button>
      <n-button :loading="libraryLoading" @click="refresh">{{ t('admin.common.refresh') }}</n-button>
    </n-space>

    <n-data-table
      :columns="columns"
      :data="library"
      :loading="libraryLoading"
      :row-key="(row: MediaLibraryItem) => row.mediaId"
      striped />
    <n-empty
      v-if="!libraryLoading && library.length === 0"
      class="py-24px"
      :description="t('admin.media.empty.library')" />

    <div v-if="libraryNextBatch" class="mt-12px flex justify-center">
      <n-button :loading="libraryLoading" @click="loadMoreLibrary">
        {{ t('admin.media.action.loadMore') }}
      </n-button>
    </div>

    <n-drawer :show="detailVisible" :width="520" placement="right" @update:show="handleDetailVisibleChange">
      <n-drawer-content :title="t('admin.media.detail.title')" closable>
        <n-descriptions v-if="selectedMedia" :column="1" bordered size="small">
          <n-descriptions-item :label="t('admin.media.column.mediaId')">
            {{ selectedMedia.media_id }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.media.column.type')">
            {{ selectedMedia.media_type || '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.media.column.name')">
            {{ selectedMedia.upload_name || '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.media.column.size')">
            {{ formatBytes(selectedMedia.media_length ?? 0) }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.media.column.created')">
            {{ formatDateTime(selectedMedia.created_ts) }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.media.column.quarantined')">
            <n-tag :type="selectedMedia.quarantined ? 'warning' : 'default'" size="small">
              {{ selectedMedia.quarantined ? t('admin.media.column.quarantined') : '-' }}
            </n-tag>
          </n-descriptions-item>
        </n-descriptions>

        <h4 class="mt-16px mb-8px">{{ t('admin.media.detail.history') }}</h4>
        <n-data-table :columns="historyColumns" :data="history" size="small" :loading="detailLoading" />
      </n-drawer-content>
    </n-drawer>

    <n-modal
      :show="policyVisible"
      preset="card"
      :title="t('admin.media.action.policyDelete')"
      class="w-440px"
      @update:show="policyVisible = $event">
      <n-space vertical>
        <div>
          <div class="mb-4px text-12px">{{ t('admin.media.field.before') }}</div>
          <n-date-picker v-model:value="policyBeforeTs" type="datetime" clearable class="w-full" />
        </div>
        <div>
          <div class="mb-4px text-12px">{{ t('admin.media.field.maxSize') }}</div>
          <n-input-number v-model:value="policyMaxSize" :min="0" class="w-full" />
        </div>
      </n-space>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <n-button @click="policyVisible = false">{{ t('admin.common.cancel') }}</n-button>
          <n-button type="error" :loading="mutating" @click="handlePolicyDelete">
            {{ t('admin.common.confirm') }}
          </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.media-library-panel {
  padding-top: 8px;
}
</style>
