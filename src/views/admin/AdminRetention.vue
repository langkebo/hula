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

    <n-data-table
      :columns="columns"
      :data="policies"
      :loading="loading"
      :pagination="pagination"
      :row-key="(row: RetentionPolicy) => row.roomId"
      striped />

    <n-modal v-model:show="editVisible" preset="dialog" :title="t('admin.retention.edit_title')">
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
      <template #action>
        <n-space>
          <n-button @click="editVisible = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="savePolicy" :loading="saveLoading">{{ t('common.save') }}</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import {
  type DataTableColumns,
  NAlert,
  NButton,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NModal,
  NPageHeader,
  NSpace,
  NTag
} from 'naive-ui'
import { h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type RetentionPolicyView as RetentionPolicy, useAdminRetention } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminRetention')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const retention = useAdminRetention()
const policies = retention.policies
const retentionStatus = retention.retentionStatus
const loading = retention.loading
const taskLoading = retention.taskLoading

const saveLoading = ref(false)
const editVisible = ref(false)
const editForm = ref({ roomId: '', minLifetime: 0, maxLifetime: 0 })

const pagination = { pageSize: 20 }

function formatDuration(ms?: number): string {
  if (!ms) return '-'
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`
  if (ms < 86400000) return `${Math.round(ms / 3600000)}h`
  return `${Math.round(ms / 86400000)}d`
}

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
    render: (row) =>
      h(NSpace, () => [
        h(NButton, { size: 'small', onClick: () => openEdit(row) }, () => t('common.edit')),
        h(NButton, { size: 'small', type: 'error', onClick: () => deletePolicy(row.roomId) }, () => t('common.delete'))
      ])
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
    logger.error('加载保留策略失败:', err)
  }
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
    logger.error('保存保留策略失败:', err)
    showFeedback(t('admin.retention.save_failed'), 'error')
  } finally {
    saveLoading.value = false
  }
}

async function deletePolicy(roomId: string) {
  try {
    await retention.deletePolicy(roomId)
    showFeedback(t('admin.retention.delete_success'), 'success')
  } catch (err) {
    logger.error('删除保留策略失败:', err)
    showFeedback(t('admin.retention.delete_failed'), 'error')
  }
}

async function handleRunTask() {
  try {
    await retention.runTask()
    showFeedback(t('admin.retention.task_started'), 'success')
  } catch (err) {
    logger.error('启动保留任务失败:', err)
    showFeedback(t('admin.retention.task_failed'), 'error')
  }
}

onMounted(() => loadData())
</script>

<style scoped>
.admin-retention {
  padding: 16px 24px;
}
</style>
