<template>
  <div class="tab-content">
    <div v-if="statusLoading" class="loading-placeholder">
      <n-spin size="small" />
      <span>{{ t('encryption.secure_backup.loading_status') }}</span>
    </div>
    <div v-else-if="statusLoadFailed" class="status-error" data-testid="secure-backup-status-error">
      <div class="status-error-icon">
        <Icon icon="mdi:shield-alert-outline" :width="48" />
      </div>
      <p>{{ t('encryption.secure_backup.status_load_failed') }}</p>
      <n-button size="small" data-testid="secure-backup-status-retry" @click="emit('retry')">
        {{ t('common.retry') }}
      </n-button>
    </div>
    <template v-else>
      <div v-if="backupExists" class="backup-status">
        <n-descriptions bordered :column="1" label-placement="left" size="small">
          <n-descriptions-item :label="t('encryption.secure_backup.status_label')">
            <n-tag type="success" size="small">{{ t('encryption.secure_backup.active') }}</n-tag>
          </n-descriptions-item>
          <n-descriptions-item :label="t('encryption.secure_backup.algorithm_label')">
            {{ backupData.algorithm || '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('encryption.secure_backup.key_count_label')">
            {{ backupData.keyCount ?? '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('encryption.secure_backup.backup_id_label')">
            <span class="mono-text">{{ backupData.id || '-' }}</span>
          </n-descriptions-item>
        </n-descriptions>

        <div class="action-group">
          <n-button size="small" @click="emit('restore')">
            <template #icon><Icon icon="mdi:restore" :width="16" /></template>
            {{ t('encryption.secure_backup.restore_action') }}
          </n-button>
          <n-button size="small" @click="emit('verify')">
            <template #icon><Icon icon="mdi:shield-check" :width="16" /></template>
            {{ t('encryption.secure_backup.verify_action') }}
          </n-button>
          <n-button size="small" @click="emit('add-keys')">
            <template #icon><Icon icon="mdi:key-plus" :width="16" /></template>
            {{ t('encryption.secure_backup.add_keys_action') }}
          </n-button>
        </div>

        <n-divider class="my-12px" />

        <div class="danger-zone">
          <div class="danger-title">
            <Icon icon="mdi:alert-octagon" :width="18" />
            <span>{{ t('encryption.secure_backup.danger_zone') }}</span>
          </div>
          <n-popconfirm @positive-click="emit('delete')">
            <template #trigger>
              <n-button size="small" type="error">
                <template #icon><Icon icon="mdi:delete" :width="16" /></template>
                {{ t('encryption.secure_backup.delete_action') }}
              </n-button>
            </template>
            {{ t('encryption.secure_backup.delete_confirm') }}
          </n-popconfirm>
        </div>
      </div>

      <div v-else class="no-backup">
        <div class="no-backup-icon">
          <Icon icon="mdi:shield-off-outline" :width="48" />
        </div>
        <p>{{ t('encryption.secure_backup.no_backup_desc') }}</p>
        <n-button type="primary" @click="emit('create')">
          <template #icon><Icon icon="mdi:shield-plus" :width="16" /></template>
          {{ t('encryption.secure_backup.create_action') }}
        </n-button>
      </div>
    </template>

    <!-- Verify result -->
    <n-alert
      v-if="verifyResult"
      :type="verifyResult.valid ? 'success' : 'warning'"
      :title="
        verifyResult.valid ? t('encryption.secure_backup.verify_valid') : t('encryption.secure_backup.verify_invalid')
      "
      closable
      @close="emit('clear-verify')"
      class="mt-12px">
      <template v-if="verifyResult.valid">
        {{ t('encryption.secure_backup.verify_valid_desc', { keyCount: verifyResult.key_count }) }}
      </template>
      <template v-else>
        {{ t('encryption.secure_backup.verify_invalid_desc') }}
      </template>
    </n-alert>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NAlert, NButton, NDescriptions, NDescriptionsItem, NDivider, NPopconfirm, NSpin, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { VerifyResult } from '@/services/matrix/crypto/MatrixKeyBackupService'

defineProps<{
  statusLoading: boolean
  statusLoadFailed: boolean
  backupExists: boolean
  backupData: { id: string; algorithm: string; keyCount: number | null }
  verifyResult: VerifyResult | null
}>()

const emit = defineEmits<{
  (e: 'retry'): void
  (e: 'create'): void
  (e: 'restore'): void
  (e: 'verify'): void
  (e: 'add-keys'): void
  (e: 'delete'): void
  (e: 'clear-verify'): void
}>()

const { t } = useI18n()

defineOptions({
  name: 'SecureBackupStatusTab'
})
</script>

<style scoped>
.tab-content {
  padding: 8px 0;
}

.loading-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 0;
  color: var(--tjg-text-quaternary);
}

.backup-status {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mono-text {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}

.action-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.danger-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.danger-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tjg-color-error);
  font-size: 14px;
  font-weight: 500;
}

.no-backup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 0;
  text-align: center;
}

.status-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 0;
  text-align: center;
}

.status-error-icon {
  color: var(--tjg-text-quaternary);
}

.status-error p {
  margin: 0;
  color: var(--tjg-text-secondary);
}

.no-backup-icon {
  color: var(--tjg-text-quaternary);
}

.no-backup p {
  color: var(--tjg-text-quaternary);
  margin: 0;
}
</style>
