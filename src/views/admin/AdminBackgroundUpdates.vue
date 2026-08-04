<template>
  <div class="admin-background-updates">
    <n-page-header :title="t('background_updates.title')" :subtitle="t('background_updates.subtitle')">
      <template #extra>
        <n-space align="center" :size="8">
          <n-button
            data-testid="retry-failed-btn"
            :loading="actionLoading === 'retry'"
            secondary
            @click="handleRetryFailed">
            {{ t('background_updates.actions.retry_failed') }}
          </n-button>
          <n-button
            data-testid="cleanup-locks-btn"
            :loading="actionLoading === 'cleanup'"
            secondary
            @click="handleCleanupLocks">
            {{ t('background_updates.actions.cleanup_locks') }}
          </n-button>
          <n-button data-testid="refresh-btn" :loading="loading" @click="loadAll">
            {{ t('background_updates.actions.refresh') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-card :title="t('background_updates.status.title')" size="small" class="mt-16px">
      <n-descriptions v-if="status" :column="3" size="small" bordered>
        <n-descriptions-item :label="t('background_updates.status.pending')">
          <n-tag size="small" type="warning">{{ status.pending_count }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('background_updates.status.running')">
          <n-tag size="small" type="info">{{ status.running_count }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('background_updates.status.completed')">
          <n-tag size="small" type="success">{{ status.completed_count }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('background_updates.status.failed')">
          <n-tag size="small" type="error">{{ status.failed_count }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('background_updates.status.total')">
          <n-tag size="small">{{ status.total_count }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item :label="t('background_updates.status.current')">
          <span v-if="status.current_update">{{ status.current_update.job_name }}</span>
          <span v-else>-</span>
        </n-descriptions-item>
      </n-descriptions>
      <n-empty v-else :description="t('background_updates.list.empty')" size="small" />
    </n-card>

    <n-card :title="t('background_updates.list.title')" size="small" class="mt-16px">
      <div v-if="loading" class="table-loading">
        <n-spin size="small" />
      </div>
      <n-empty v-else-if="updates.length === 0" :description="t('background_updates.list.empty')" size="small" />
      <div v-else class="updates-table">
        <div class="table-row table-header">
          <div class="table-cell">{{ t('background_updates.list.job_name') }}</div>
          <div class="table-cell">{{ t('background_updates.list.job_type') }}</div>
          <div class="table-cell">{{ t('background_updates.list.status') }}</div>
          <div class="table-cell">{{ t('background_updates.list.progress') }}</div>
          <div class="table-cell">{{ t('background_updates.list.created_ts') }}</div>
          <div class="table-cell">{{ t('background_updates.list.started_ts') }}</div>
          <div class="table-cell">{{ t('background_updates.list.error_message') }}</div>
          <div class="table-cell">{{ t('background_updates.list.retry_count') }}</div>
          <div class="table-cell">{{ t('background_updates.list.actions') }}</div>
        </div>
        <div v-for="row in updates" :key="row.job_name" class="table-row">
          <div class="table-cell" :title="row.job_name">{{ row.job_name }}</div>
          <div class="table-cell" :title="row.job_type">{{ row.job_type }}</div>
          <div class="table-cell">
            <n-tag size="small" :type="statusTagType(row.status)">{{ row.status }}</n-tag>
          </div>
          <div class="table-cell">{{ row.processed_items }} / {{ row.total_items }}</div>
          <div class="table-cell">{{ formatTimestamp(row.created_ts) }}</div>
          <div class="table-cell">{{ formatTimestamp(row.started_ts) }}</div>
          <div class="table-cell" :title="row.error_message ?? ''">{{ row.error_message ?? '-' }}</div>
          <div class="table-cell">{{ row.retry_count }}</div>
          <div class="table-cell action-buttons">
            <n-button
              size="tiny"
              secondary
              :disabled="actionLoading !== null"
              data-testid="action-start"
              @click="handleStart(row.job_name)">
              {{ t('background_updates.actions.start') }}
            </n-button>
            <n-button
              size="tiny"
              secondary
              :disabled="actionLoading !== null"
              data-testid="action-cancel"
              @click="handleCancel(row.job_name)">
              {{ t('background_updates.actions.cancel') }}
            </n-button>
            <n-button
              size="tiny"
              secondary
              :disabled="actionLoading !== null"
              data-testid="action-complete"
              @click="handleComplete(row.job_name)">
              {{ t('background_updates.actions.complete') }}
            </n-button>
            <n-button
              size="tiny"
              secondary
              type="error"
              :disabled="actionLoading !== null"
              data-testid="action-fail"
              @click="openFailDialog(row.job_name)">
              {{ t('background_updates.actions.fail') }}
            </n-button>
            <n-button
              size="tiny"
              secondary
              :disabled="actionLoading !== null"
              data-testid="action-delete"
              @click="handleDelete(row.job_name)">
              {{ t('background_updates.actions.delete') }}
            </n-button>
          </div>
        </div>
      </div>
    </n-card>

    <n-modal v-model:show="failDialogVisible" preset="dialog" :title="t('background_updates.dialog.fail_title')">
      <n-form :model="failForm">
        <n-form-item :label="t('background_updates.dialog.fail_message_label')">
          <n-input
            v-model:value="failForm.message"
            type="textarea"
            :rows="3"
            :placeholder="t('background_updates.dialog.fail_message_placeholder')"
            data-testid="fail-message-input" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-space>
          <n-button @click="failDialogVisible = false">{{ t('background_updates.dialog.fail_cancel') }}</n-button>
          <n-button
            type="error"
            data-testid="fail-confirm-btn"
            :loading="actionLoading === `fail:${failForm.jobName}`"
            :disabled="!failForm.message?.trim()"
            @click="confirmFail">
            {{ t('background_updates.dialog.fail_confirm') }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import {
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPageHeader,
  NSpace,
  NSpin,
  NTag
} from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { adminService } from '@/services/matrix/admin'
import type { BackgroundUpdate, BackgroundUpdateStatusSummary } from '@/services/matrix/admin/BackgroundUpdateService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminBackgroundUpdates')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loading = ref(false)
const actionLoading = ref<string | null>(null)
const updates = ref<BackgroundUpdate[]>([])
const status = ref<BackgroundUpdateStatusSummary | null>(null)

const failDialogVisible = ref(false)
const failForm = ref<{ jobName: string; message: string }>({ jobName: '', message: '' })

const formatTimestamp = (ts?: number | null): string => {
  if (!ts) return '-'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts)
  }
}

const statusTagType = (status: string): 'default' | 'info' | 'success' | 'warning' | 'error' => {
  switch (status) {
    case 'pending':
      return 'warning'
    case 'running':
      return 'info'
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    default:
      return 'default'
  }
}

async function loadStatus() {
  try {
    status.value = await adminService.backgroundUpdates.getStatus()
  } catch (err) {
    logger.error('加载状态失败:', err)
  }
}

async function loadUpdates() {
  try {
    const result = await adminService.backgroundUpdates.listUpdates({ limit: 100 })
    updates.value = result.updates
  } catch (err) {
    logger.error('加载任务列表失败:', err)
    updates.value = []
  }
}

async function loadAll() {
  loading.value = true
  try {
    await Promise.allSettled([loadStatus(), loadUpdates()])
  } finally {
    loading.value = false
  }
}

async function runAction(key: string, serviceMethod: () => Promise<unknown>, successKey: string, failedKey: string) {
  actionLoading.value = key
  try {
    await serviceMethod()
    showFeedback(t(successKey), 'success')
    await loadAll()
  } catch (err) {
    logger.error(`操作失败 ${key}:`, err)
    showFeedback(t(failedKey), 'error')
  } finally {
    actionLoading.value = null
  }
}

function handleStart(jobName: string) {
  void runAction(
    `start:${jobName}`,
    () => adminService.backgroundUpdates.startUpdate(jobName),
    'background_updates.feedback.start_success',
    'background_updates.feedback.start_failed'
  )
}

function handleCancel(jobName: string) {
  void runAction(
    `cancel:${jobName}`,
    () => adminService.backgroundUpdates.cancelUpdate(jobName),
    'background_updates.feedback.cancel_success',
    'background_updates.feedback.cancel_failed'
  )
}

function handleComplete(jobName: string) {
  void runAction(
    `complete:${jobName}`,
    () => adminService.backgroundUpdates.completeUpdate(jobName),
    'background_updates.feedback.complete_success',
    'background_updates.feedback.complete_failed'
  )
}

function handleDelete(jobName: string) {
  void runAction(
    `delete:${jobName}`,
    () => adminService.backgroundUpdates.deleteUpdate(jobName),
    'background_updates.feedback.delete_success',
    'background_updates.feedback.delete_failed'
  )
}

function openFailDialog(jobName: string) {
  failForm.value = { jobName, message: '' }
  failDialogVisible.value = true
}

async function confirmFail() {
  if (!failForm.value.message?.trim()) return
  const jobName = failForm.value.jobName
  const message = failForm.value.message
  failDialogVisible.value = false
  await runAction(
    `fail:${jobName}`,
    () => adminService.backgroundUpdates.failUpdate(jobName, message),
    'background_updates.feedback.fail_success',
    'background_updates.feedback.fail_failed'
  )
}

async function handleRetryFailed() {
  await runAction(
    'retry',
    async () => {
      const result = await adminService.backgroundUpdates.retryFailed()
      showFeedback(t('background_updates.feedback.retry_success', { count: result.retried_count }), 'success')
    },
    'background_updates.feedback.retry_success',
    'background_updates.feedback.retry_failed'
  )
}

async function handleCleanupLocks() {
  await runAction(
    'cleanup',
    async () => {
      const result = await adminService.backgroundUpdates.cleanupLocks()
      showFeedback(t('background_updates.feedback.cleanup_success', { count: result.cleaned_count }), 'success')
    },
    'background_updates.feedback.cleanup_success',
    'background_updates.feedback.cleanup_failed'
  )
}

onMounted(() => {
  void loadAll()
})
</script>

<style scoped>
.admin-background-updates {
  padding: 16px 24px;
}

.table-loading {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.updates-table {
  display: flex;
  flex-direction: column;
  font-size: 12px;
}

.table-row {
  display: grid;
  grid-template-columns: 1.5fr 1fr 0.8fr 1fr 1.2fr 1.2fr 1.5fr 0.6fr 2.5fr;
  gap: 8px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--tjg-border-layout-divider);
  align-items: center;
}

.table-row:last-child {
  border-bottom: none;
}

.table-header {
  font-weight: 600;
  color: var(--tjg-text-secondary);
  border-bottom: 2px solid var(--tjg-border-layout-divider);
}

.table-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
</style>
