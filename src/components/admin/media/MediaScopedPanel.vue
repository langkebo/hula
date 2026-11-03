<script setup lang="ts">
import { type DataTableColumns, NButton, NCard, NDataTable, NEmpty, NInput, NPopconfirm, NSpace } from 'naive-ui'
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type UseAdminMedia, useAdminMedia } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { formatBytes } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'

type RoomMediaItem = UseAdminMedia['roomMedia']['value'][number]
type UserMediaItem = UseAdminMedia['userMedia']['value'][number]

const { t } = useI18n()
const logger = createLogger('AdminMediaScoped')
const { showFeedback } = useActionFeedback()
const {
  roomMedia,
  roomMediaNextBatch,
  roomMediaLoading,
  roomMediaRoomId,
  userMedia,
  userMediaLoading,
  userMediaUserId,
  mutating,
  loadRoomMedia,
  loadMoreRoomMedia,
  loadUserMedia,
  deleteRoomOne,
  deleteOne,
  quarantineRoom,
  unquarantineRoom,
  quarantineUser
} = useAdminMedia()

const roomId = ref('')
const roomUserId = ref('')
const userId = ref('')
const roomLoaded = ref(false)
const userLoaded = ref(false)

const formatDateTime = (timestamp?: number): string =>
  typeof timestamp === 'number' && timestamp > 0 ? new Date(timestamp).toLocaleString() : '-'

const runAction = async (action: () => Promise<unknown>, successMessage: string): Promise<boolean> => {
  try {
    await action()
    showFeedback(successMessage, 'success')
    return true
  } catch (error) {
    logger.error('media action failed', { error: error instanceof Error ? error.message : String(error) })
    showFeedback(t('admin.media.feedback.failed'), 'error')
    return false
  }
}

const handleLoadRoom = async (): Promise<void> => {
  const id = roomId.value.trim()
  if (!id) return
  await loadRoomMedia(id)
  roomLoaded.value = true
}

const handleLoadUser = async (): Promise<void> => {
  const id = userId.value.trim()
  if (!id) return
  await loadUserMedia(id)
  userLoaded.value = true
}

const handleDeleteRoomMedia = async (row: RoomMediaItem): Promise<void> => {
  const id = roomMediaRoomId.value
  if (!id) return
  const deleted = await runAction(() => deleteRoomOne(id, row.media_id), t('admin.media.feedback.delete_success'))
  if (deleted) {
    await loadRoomMedia(id)
  }
}

const handleDeleteUserMedia = async (row: UserMediaItem): Promise<void> => {
  const id = userMediaUserId.value
  const deleted = await runAction(() => deleteOne(null, row.media_id), t('admin.media.feedback.delete_success'))
  if (deleted && id) {
    await loadUserMedia(id)
  }
}

const handleQuarantineRoom = (): Promise<boolean> => {
  const id = roomMediaRoomId.value
  if (!id) return Promise.resolve(false)
  return runAction(
    () => quarantineRoom(id, roomUserId.value.trim() || undefined),
    t('admin.media.feedback.quarantine_success')
  )
}

const handleUnquarantineRoom = (): Promise<boolean> => {
  const id = roomMediaRoomId.value
  if (!id) return Promise.resolve(false)
  return runAction(
    () => unquarantineRoom(id, roomUserId.value.trim() || undefined),
    t('admin.media.feedback.unquarantine_success')
  )
}

const handleQuarantineUser = async (): Promise<boolean> => {
  const id = userMediaUserId.value
  if (!id) return false
  const ok = await runAction(() => quarantineUser(id), t('admin.media.feedback.quarantine_success'))
  if (ok) {
    await loadUserMedia(id)
  }
  return ok
}

const renderDeleteAction = (onDelete: () => void, disabled: boolean) =>
  h(
    NPopconfirm,
    { onPositiveClick: onDelete },
    {
      trigger: () =>
        h(NButton, { size: 'small', text: true, type: 'error', disabled }, () => t('admin.media.action.delete')),
      default: () => t('admin.media.action.deleteConfirm')
    }
  )

const roomColumns = computed<DataTableColumns<RoomMediaItem>>(() => [
  { title: t('admin.media.column.mediaId'), key: 'media_id', width: 200, ellipsis: { tooltip: true } },
  { title: t('admin.media.column.name'), key: 'upload_name', width: 180, ellipsis: { tooltip: true } },
  { title: t('admin.media.column.type'), key: 'media_type', width: 130 },
  {
    title: t('admin.media.column.size'),
    key: 'media_length',
    width: 110,
    render: (row) => formatBytes(row.media_length ?? 0)
  },
  {
    title: t('admin.media.column.created'),
    key: 'created_ts',
    width: 180,
    render: (row) => formatDateTime(row.created_ts)
  },
  {
    title: t('admin.media.column.actions'),
    key: 'actions',
    width: 100,
    render: (row) => renderDeleteAction(() => void handleDeleteRoomMedia(row), mutating.value)
  }
])

const userColumns = computed<DataTableColumns<UserMediaItem>>(() => [
  { title: t('admin.media.column.mediaId'), key: 'media_id', width: 200, ellipsis: { tooltip: true } },
  { title: t('admin.media.column.name'), key: 'upload_name', width: 180, ellipsis: { tooltip: true } },
  { title: t('admin.media.column.type'), key: 'media_type', width: 130 },
  {
    title: t('admin.media.column.size'),
    key: 'media_length',
    width: 110,
    render: (row) => formatBytes(row.media_length ?? 0)
  },
  {
    title: t('admin.media.column.created'),
    key: 'created_ts',
    width: 180,
    render: (row) => formatDateTime(row.created_ts)
  },
  {
    title: t('admin.media.column.actions'),
    key: 'actions',
    width: 100,
    render: (row) => renderDeleteAction(() => void handleDeleteUserMedia(row), mutating.value)
  }
])
</script>

<template>
  <div class="media-scoped-panel">
    <div class="grid gap-16px xl:grid-cols-2">
      <n-card :title="t('admin.media.room.title')">
        <n-space vertical>
          <n-space align="center">
            <n-input v-model:value="roomId" :placeholder="t('admin.media.field.roomId')" class="max-w-280px" />
            <n-button type="primary" :loading="roomMediaLoading" @click="handleLoadRoom">
              {{ t('admin.common.refresh') }}
            </n-button>
          </n-space>

          <n-data-table :columns="roomColumns" :data="roomMedia" :loading="roomMediaLoading" size="small" />
          <n-empty
            v-if="roomLoaded && !roomMediaLoading && roomMedia.length === 0"
            :description="t('admin.media.empty.roomMedia')" />

          <div v-if="roomMediaNextBatch" class="flex justify-center">
            <n-button :loading="roomMediaLoading" @click="loadMoreRoomMedia">
              {{ t('admin.media.action.loadMore') }}
            </n-button>
          </div>

          <n-space align="center">
            <n-input
              v-model:value="roomUserId"
              :placeholder="t('admin.media.field.userIdOptional')"
              class="max-w-280px" />
            <n-button :disabled="mutating" @click="handleQuarantineRoom">
              {{ t('admin.media.action.quarantineRoom') }}
            </n-button>
            <n-button :disabled="mutating" @click="handleUnquarantineRoom">
              {{ t('admin.media.action.unquarantineRoom') }}
            </n-button>
          </n-space>
        </n-space>
      </n-card>

      <n-card :title="t('admin.media.user.title')">
        <n-space vertical>
          <n-space align="center">
            <n-input v-model:value="userId" :placeholder="t('admin.media.field.userId')" class="max-w-280px" />
            <n-button type="primary" :loading="userMediaLoading" @click="handleLoadUser">
              {{ t('admin.common.refresh') }}
            </n-button>
          </n-space>

          <n-data-table :columns="userColumns" :data="userMedia" :loading="userMediaLoading" size="small" />
          <n-empty
            v-if="userLoaded && !userMediaLoading && userMedia.length === 0"
            :description="t('admin.media.empty.userMedia')" />

          <div class="flex justify-end">
            <n-button :disabled="mutating" @click="handleQuarantineUser">
              {{ t('admin.media.action.quarantineUser') }}
            </n-button>
          </div>
        </n-space>
      </n-card>
    </div>
  </div>
</template>

<style scoped>
.media-scoped-panel {
  padding-top: 8px;
}
</style>
