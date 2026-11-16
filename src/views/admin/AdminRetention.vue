<template>
  <div class="admin-retention">
    <n-page-header :title="t('admin.retention.title')" :subtitle="t('admin.retention.subtitle')">
      <template #extra>
        <n-space>
          <n-button @click="handleRunTask" :loading="taskLoading" type="warning">
            {{ t('admin.retention.run_task') }}
          </n-button>
          <n-button @click="loadData" :loading="loading">
            {{ t('common.refresh') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-alert v-if="retentionStatus" type="info" class="mb-16px" :show-icon="false">
      {{ t('admin.retention.status_label') }}:
      {{ retentionStatus.running ? t('admin.retention.status_running') : t('admin.retention.status_idle') }}
    </n-alert>

    <n-grid :cols="2" :x-gap="16" :y-gap="16" responsive="screen" item-responsive class="mb-16px">
      <n-gi span="2 m:1">
        <n-card size="small" :title="t('admin.retention.room_policy_title')">
          <p class="retention-hint">{{ t('admin.retention.room_policy_hint') }}</p>
          <n-space align="center" class="mb-12px">
            <n-input
              v-model:value="roomIdInput"
              :placeholder="t('admin.retention.room_id_placeholder')"
              class="flex-1"
              @keyup.enter="handleLoadRoomPolicy" />
            <n-button size="small" :loading="roomPolicyLoading" @click="handleLoadRoomPolicy">
              {{ t('admin.retention.load_room_policy') }}
            </n-button>
          </n-space>

          <n-spin :show="roomPolicyLoading">
            <template v-if="roomPolicy">
              <n-descriptions v-if="roomPolicy.policy" bordered :column="2" size="small" label-placement="left">
                <n-descriptions-item :label="t('admin.retention.min_lifetime')">
                  {{ formatDuration(roomPolicy.policy.min_lifetime) }}
                </n-descriptions-item>
                <n-descriptions-item :label="t('admin.retention.max_lifetime')">
                  {{ formatDuration(roomPolicy.policy.max_lifetime) }}
                </n-descriptions-item>
              </n-descriptions>
              <n-empty v-else :description="t('admin.retention.room_policy_empty')" class="py-16px" />

              <n-space align="center" class="mt-12px">
                <n-input-number
                  v-model:value="roomMinLifetime"
                  :min="0"
                  :placeholder="t('admin.retention.ms_unit')"
                  class="w-[180px]" />
                <n-input-number
                  v-model:value="roomMaxLifetime"
                  :min="0"
                  :placeholder="t('admin.retention.ms_unit')"
                  class="w-[180px]" />
                <n-button size="small" type="primary" :loading="roomWriteLoading" @click="handleSaveRoomPolicy">
                  {{ t('common.save') }}
                </n-button>
                <n-button size="small" type="error" :loading="roomWriteLoading" @click="handleDeleteRoomPolicy">
                  {{ t('admin.retention.delete_room_policy') }}
                </n-button>
              </n-space>
            </template>
            <n-empty v-else :description="t('admin.retention.room_policy_empty')" class="py-16px" />
          </n-spin>
        </n-card>
      </n-gi>

      <n-gi span="2 m:1">
        <n-card size="small" :title="t('admin.retention.default_policy_title')">
          <n-spin :show="defaultLoading">
            <n-descriptions v-if="defaultRetention" bordered :column="2" size="small" label-placement="left">
              <n-descriptions-item :label="t('admin.retention.min_lifetime')">
                {{ formatDuration(defaultRetention.min_lifetime) }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.retention.max_lifetime')">
                {{ formatDuration(defaultRetention.max_lifetime) }}
              </n-descriptions-item>
            </n-descriptions>
            <n-empty v-else :description="t('admin.retention.default_policy_empty')" class="py-16px" />
          </n-spin>
        </n-card>
      </n-gi>
    </n-grid>

    <n-data-table
      :columns="columns"
      :data="policies"
      :loading="loading"
      :pagination="pagination"
      :row-key="(row: RetentionPolicy) => row.roomId"
      striped />

    <n-drawer v-model:show="editVisible" placement="right" :width="380">
      <n-drawer-content :title="t('admin.retention.edit_title')" closable>
        <n-form :model="editForm" label-placement="left" label-width="120px">
          <n-form-item :label="t('admin.retention.col_room')">
            <n-input v-model:value="editForm.roomId" disabled />
          </n-form-item>
          <n-form-item :label="t('admin.retention.min_lifetime')">
            <n-input-number v-model:value="editForm.minLifetime" :min="0" :placeholder="t('admin.retention.ms_unit')" />
          </n-form-item>
          <n-form-item :label="t('admin.retention.max_lifetime')">
            <n-input-number v-model:value="editForm.maxLifetime" :min="0" :placeholder="t('admin.retention.ms_unit')" />
          </n-form-item>
        </n-form>
        <template #footer>
          <div class="flex justify-end gap-12px">
            <n-button @click="editVisible = false">{{ t('common.cancel') }}</n-button>
            <n-button type="primary" @click="savePolicy" :loading="saveLoading">{{ t('common.save') }}</n-button>
          </div>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup lang="ts">
import {
  type DataTableColumns,
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NInput,
  NInputNumber,
  NPageHeader,
  NSpace,
  NSpin,
  NTag,
  useDialog
} from 'naive-ui'
import { h, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type RetentionPolicyView as RetentionPolicy, useAdminRetention } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminRetention')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const dialog = useDialog()

const retention = useAdminRetention()
const policies = retention.policies
const retentionStatus = retention.retentionStatus
const loading = retention.loading
const taskLoading = retention.taskLoading
const defaultRetention = retention.defaultRetention
const defaultLoading = retention.defaultLoading
const roomPolicy = retention.roomPolicy
const roomPolicyLoading = retention.roomPolicyLoading
const roomWriteLoading = retention.roomWriteLoading

const saveLoading = ref(false)
const editVisible = ref(false)
const editForm = ref({ roomId: '', minLifetime: 0, maxLifetime: 0 })

const roomIdInput = ref('')
const roomMinLifetime = ref<number | null>(null)
const roomMaxLifetime = ref<number | null>(null)

const pagination = { pageSize: 20 }

function formatDuration(ms?: number): string {
  if (!ms) return '-'
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h`
  return `${Math.round(ms / 86400000)}d`
}

/** 写入/读取后把服务端回读结果同步到编辑框，保证输入与真实策略一致。 */
function syncRoomInputs() {
  roomMinLifetime.value = roomPolicy.value?.policy?.min_lifetime ?? null
  roomMaxLifetime.value = roomPolicy.value?.policy?.max_lifetime ?? null
}

watch(roomPolicy, syncRoomInputs, { immediate: true })

const columns: DataTableColumns<RetentionPolicy> = [
  { title: t('admin.retention.col_room'), key: 'roomId', width: 260, ellipsis: { tooltip: true } },
  {
    title: t('admin.retention.min_lifetime'),
    key: 'minLifetime',
    width: 140,
    render: (row) => h(NTag, { size: 'small' }, () => formatDuration(row.minLifetime))
  },
  {
    title: t('admin.retention.max_lifetime'),
    key: 'maxLifetime',
    width: 140,
    render: (row) => h(NTag, { size: 'small', type: 'warning' }, () => formatDuration(row.maxLifetime))
  },
  {
    title: t('admin.retention.col_actions'),
    key: 'actions',
    width: 160,
    render: (row) => h(NButton, { size: 'small', onClick: () => openEdit(row) }, () => t('common.edit'))
  }
]

function openEdit(policy: RetentionPolicy) {
  editForm.value = {
    roomId: policy.roomId,
    minLifetime: policy.minLifetime ?? 0,
    maxLifetime: policy.maxLifetime ?? 0
  }
  editVisible.value = true
}

async function loadData() {
  try {
    await retention.loadAll()
  } catch (err) {
    logger.error('Failed to load retention policy:', err)
  }
}

async function handleLoadRoomPolicy() {
  const roomId = roomIdInput.value.trim()
  if (!roomId) {
    showFeedback(t('admin.retention.room_id_required'), 'warning')
    return
  }
  try {
    await retention.loadRoomPolicy(roomId)
    showFeedback(t('admin.retention.room_policy_load_success'), 'success')
  } catch (err) {
    logger.error('Failed to load room retention policy:', err)
    showFeedback(t('admin.retention.room_policy_load_failed'), 'error')
  }
}

async function handleSaveRoomPolicy() {
  const roomId = roomIdInput.value.trim()
  if (!roomId) {
    showFeedback(t('admin.retention.room_id_required'), 'warning')
    return
  }
  if (roomMinLifetime.value === null && roomMaxLifetime.value === null) {
    showFeedback(t('admin.retention.room_policy_required'), 'warning')
    return
  }
  try {
    await retention.setRoomPolicy(roomId, {
      ...(roomMinLifetime.value !== null ? { min_lifetime: roomMinLifetime.value } : {}),
      ...(roomMaxLifetime.value !== null ? { max_lifetime: roomMaxLifetime.value } : {})
    })
    showFeedback(t('admin.retention.room_policy_save_success'), 'success')
  } catch (err) {
    logger.error('Failed to save room retention policy:', err)
    showFeedback(t('admin.retention.room_policy_save_failed'), 'error')
  }
}

function handleDeleteRoomPolicy() {
  const roomId = roomIdInput.value.trim()
  if (!roomId) {
    showFeedback(t('admin.retention.room_id_required'), 'warning')
    return
  }
  dialog.warning({
    title: t('admin.retention.delete_room_policy'),
    content: t('admin.retention.delete_room_policy_confirm', { roomId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await retention.deleteRoomPolicy(roomId)
        showFeedback(t('admin.retention.room_policy_delete_success'), 'success')
      } catch (err) {
        logger.error('Failed to delete room retention policy:', err)
        showFeedback(t('admin.retention.room_policy_delete_failed'), 'error')
      }
    }
  })
}

async function savePolicy() {
  saveLoading.value = true
  try {
    await retention.setPolicy(
      editForm.value.roomId,
      editForm.value.maxLifetime || undefined,
      editForm.value.minLifetime || undefined
    )
    showFeedback(t('admin.retention.save_success'), 'success')
    editVisible.value = false
  } catch (err) {
    logger.error('Failed to save retention policy:', err)
    showFeedback(t('admin.retention.save_failed'), 'error')
  } finally {
    saveLoading.value = false
  }
}

async function handleRunTask() {
  try {
    await retention.runTask()
    showFeedback(t('admin.retention.task_started'), 'success')
  } catch (err) {
    logger.error('Failed to start retention task:', err)
    showFeedback(t('admin.retention.task_failed'), 'error')
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.admin-retention {
  padding: 16px 24px;
}

.retention-hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--tjg-text-secondary);
}
</style>
