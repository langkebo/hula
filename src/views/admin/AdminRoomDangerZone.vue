<template>
  <n-card size="small" :title="t('admin.rooms.dangerZone')" class="border-[var(--n-error-color)]">
    <n-space vertical>
      <n-popconfirm @positive-click="handlePurgeHistory">
        <template #trigger>
          <n-button size="small" type="error">
            {{ t('admin.rooms.purgeHistory') }}
          </n-button>
        </template>
        {{ t('admin.rooms.purgeHistoryConfirm') }}
      </n-popconfirm>

      <n-popconfirm @positive-click="handlePurgeRoom">
        <template #trigger>
          <n-button size="small" type="error" ghost data-testid="admin-rooms-purge-room">
            {{ t('admin.rooms.purgeRoom') }}
          </n-button>
        </template>
        {{ t('admin.rooms.purgeRoomConfirm') }}
      </n-popconfirm>

      <n-button size="small" type="error" @click="emit('shutdown')">
        {{ t('admin.rooms.shutdown') }}
      </n-button>
      <n-button size="small" type="error" ghost @click="emit('delete')">
        {{ t('admin.rooms.delete') }}
      </n-button>
    </n-space>
  </n-card>
</template>

<script setup lang="ts">
import { NButton, NCard, NPopconfirm, NSpace } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { RoomInfo, useAdminRooms } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAdminErrorHandler } from './useAdminError'

const props = defineProps<{
  /** 父级持有的房间管理 composable 实例；本组件不自行创建，避免状态分叉。 */
  admin: ReturnType<typeof useAdminRooms>
  room: RoomInfo | null
}>()

const emit = defineEmits<{
  shutdown: []
  delete: []
  'close-detail': []
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { handleAdminError } = useAdminErrorHandler()

async function handlePurgeHistory() {
  if (!props.room) return
  try {
    const result = await props.admin.purgeHistory(props.room.roomId)
    // 后端 purge_history 返回 {success, deleted_events, dry_run}，**不返回 purge_id**
    // （purge_id 只属于另一个端点 purgeRoom）——旧文案「已启动（ID: …）」会显示空 ID。
    showFeedback(t('admin.rooms.purgeHistorySuccess', { count: result.deletedEvents }), 'success')
  } catch (err) {
    if (handleAdminError(err)) {
      showFeedback(t('admin.rooms.purgeHistoryFailed'), 'error')
    }
  }
}

async function handlePurgeRoom() {
  if (!props.room) return
  try {
    await props.admin.purgeRoom(props.room.roomId)
    showFeedback(t('admin.rooms.purgeRoomSuccess'), 'success')
    emit('close-detail')
  } catch (err) {
    if (handleAdminError(err)) {
      showFeedback(t('admin.rooms.purgeRoomFailed'), 'error')
    }
  }
}
</script>
