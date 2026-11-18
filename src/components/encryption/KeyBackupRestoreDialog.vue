<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('encryption.backup_restore_dialog.title')"
    class="w-[560px]"
    :mask-closable="false">
    <n-spin :show="loading">
      <div class="restore-content">
        <div class="intro-text">
          <p>{{ t('encryption.backup_restore_dialog.intro_primary') }}</p>
          <p class="hint-text">{{ t('encryption.backup_restore_dialog.intro_hint') }}</p>
        </div>

        <!-- 备份信息读取失败：显式提示与重试入口，不静默退化为无版本可选 -->
        <n-alert v-if="backupInfoError" type="warning" class="mb-12px" data-test="backup-info-error">
          <div class="flex items-center justify-between gap-8px">
            <span>{{ t('encryption.backup_restore_dialog.backup_info_unavailable') }}</span>
            <n-button text size="tiny" type="primary" data-test="backup-info-retry" @click="loadBackupVersions">
              {{ t('common.retry') }}
            </n-button>
          </div>
        </n-alert>

        <!-- Version selection -->
        <div v-if="backupVersions.length > 1" class="version-section">
          <n-form-item :label="t('encryption.backup_restore_dialog.version_label')">
            <n-select
              v-model:value="selectedVersion"
              :options="versionOptions"
              :placeholder="t('encryption.backup_restore_dialog.version_placeholder')"
              :disabled="loading" />
          </n-form-item>
        </div>

        <!-- Recovery method tabs -->
        <n-tabs v-model:value="activeTab" type="line" animated>
          <!-- Recovery Key tab (existing) -->
          <n-tab-pane name="recoveryKey" :tab="t('encryption.backup_restore_dialog.tab_recovery_key')">
            <n-form ref="formRef" :model="formData" label-placement="top">
              <n-form-item :label="t('encryption.backup_restore_dialog.recovery_key_label')" path="recoveryKey">
                <n-input
                  v-model:value="formData.recoveryKey"
                  type="textarea"
                  :placeholder="t('setting.encryption.recovery_key_placeholder')"
                  :rows="4"
                  :disabled="loading" />
              </n-form-item>
            </n-form>
          </n-tab-pane>

          <!-- Key File tab -->
          <n-tab-pane name="keyFile" :tab="t('encryption.backup_restore_dialog.tab_key_file')">
            <div class="file-upload-section">
              <n-upload :max="1" accept=".json,.txt" :show-file-list="false" :custom-request="handleFileUpload">
                <n-button :disabled="loading">
                  <template #icon>
                    <Icon icon="mdi:file-upload-outline" :width="18" />
                  </template>
                  {{ t('encryption.backup_restore_dialog.select_file') }}
                </n-button>
              </n-upload>
              <div v-if="fileName" class="file-info">
                <Icon icon="mdi:file-check-outline" :width="18" class="file-icon" />
                <span class="file-name">{{ fileName }}</span>
                <n-button text size="tiny" :aria-label="t('common.remove')" @click="clearFile">
                  <template #icon>
                    <Icon icon="mdi:close" :width="16" />
                  </template>
                </n-button>
              </div>
              <p class="hint-text">{{ t('encryption.backup_restore_dialog.file_hint') }}</p>
            </div>
          </n-tab-pane>

          <!-- Passphrase tab -->
          <n-tab-pane name="passphrase" :tab="t('encryption.backup_restore_dialog.tab_passphrase')">
            <n-form :model="passphraseData" label-placement="top">
              <n-form-item :label="t('encryption.backup_restore_dialog.passphrase_label')">
                <n-input
                  v-model:value="passphraseData.passphrase"
                  type="password"
                  show-password-on="click"
                  :placeholder="t('encryption.backup_restore_dialog.passphrase_placeholder')"
                  :disabled="loading" />
              </n-form-item>
            </n-form>
          </n-tab-pane>
        </n-tabs>

        <!-- Progress -->
        <div v-if="restoreProgress !== null" class="progress-section">
          <n-progress type="line" :percentage="restoreProgress" :indicator-placement="'inside'" processing />
          <div class="progress-text">
            {{ t('encryption.backup_restore_dialog.restoring_progress', { progress: restoreProgress }) }}
          </div>
        </div>

        <!-- Result -->
        <div v-if="restoreResult" class="result-section" :class="restoreResult.success ? 'success' : 'error'">
          <Icon :icon="restoreResult.success ? 'mdi:check-circle' : 'mdi:alert-circle'" :width="24" />
          <span>{{ restoreResult.message }}</span>
        </div>

        <!-- Advanced options -->
        <n-collapse class="advanced-section">
          <n-collapse-item :title="t('encryption.backup_restore_dialog.advanced_title')" name="advanced">
            <n-form label-placement="top" size="small">
              <n-form-item :label="t('encryption.backup_restore_dialog.room_id_label')">
                <n-input
                  v-model:value="advancedData.roomId"
                  :placeholder="t('encryption.backup_restore_dialog.room_id_placeholder')"
                  :disabled="loading" />
              </n-form-item>
              <n-form-item :label="t('encryption.backup_restore_dialog.session_id_label')">
                <n-input
                  v-model:value="advancedData.sessionId"
                  :placeholder="t('encryption.backup_restore_dialog.session_id_placeholder')"
                  :disabled="loading" />
              </n-form-item>
              <div class="advanced-actions">
                <n-button size="small" :disabled="!advancedData.roomId || loading" @click="handleRoomRecover">
                  <template #icon>
                    <Icon icon="mdi:key-outline" :width="16" />
                  </template>
                  {{ t('encryption.backup_restore_dialog.recover_room') }}
                </n-button>
                <n-button
                  size="small"
                  :disabled="!advancedData.roomId || !advancedData.sessionId || loading"
                  @click="handleSessionRecover">
                  <template #icon>
                    <Icon icon="mdi:key-variant" :width="16" />
                  </template>
                  {{ t('encryption.backup_restore_dialog.recover_session') }}
                </n-button>
              </div>
            </n-form>
          </n-collapse-item>
        </n-collapse>
      </div>
    </n-spin>

    <template #action>
      <div class="dialog-footer">
        <n-button @click="handleCancel" :disabled="loading">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="loading" :disabled="!canRestore" @click="handleRestore">
          {{ t('setting.encryption.restore') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  NAlert,
  NButton,
  NCollapse,
  NCollapseItem,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NProgress,
  NSelect,
  NSpin,
  NTabPane,
  NTabs,
  NUpload
} from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useKeyBackupRestore } from './useKeyBackupRestore'

const { t } = useI18n()

defineOptions({
  name: 'KeyBackupRestoreDialog'
})

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}>()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

const {
  loading,
  restoreProgress,
  restoreResult,
  activeTab,
  backupVersions,
  selectedVersion,
  backupInfoError,
  versionOptions,
  formData,
  fileName,
  passphraseData,
  advancedData,
  canRestore,
  loadBackupVersions,
  handleFileUpload,
  clearFile,
  handleCancel,
  handleRestore,
  handleRoomRecover,
  handleSessionRecover
} = useKeyBackupRestore({
  close: () => {
    visible.value = false
  },
  notifySuccess: () => emit('success')
})
</script>

<style scoped>
.restore-content {
  padding: 8px 0;
}

.intro-text {
  margin-bottom: 20px;
}

.intro-text p {
  margin: 4px 0;
}

.hint-text {
  color: var(--tjg-text-tertiary);
  font-size: 13px;
}

.version-section {
  margin-bottom: 16px;
}

.file-upload-section {
  padding: 8px 0;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 10px;
  background-color: var(--tjg-surface-subtle);
  border-radius: 6px;
  font-size: 13px;
}

:deep(.dark) .file-info {
  background-color: var(--tjg-surface-inverse-subtle);
}

.file-icon {
  color: var(--tjg-color-success-500);
  flex-shrink: 0;
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-section {
  margin-top: 16px;
  padding: 12px;
  background-color: var(--tjg-encryption-surface-subtle);
  border-radius: 8px;
}

:deep(.dark) .progress-section {
  background-color: var(--tjg-encryption-surface-dark);
}

.progress-text {
  text-align: center;
  margin-top: 8px;
  font-size: 13px;
  color: var(--tjg-text-tertiary);
}

.result-section {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
}

.result-section.success {
  background-color: var(--tjg-color-success-400);
  color: var(--tjg-color-success-500);
}

.result-section.error {
  background-color: var(--tjg-color-danger-200);
  color: var(--tjg-color-danger-500);
}

.advanced-section {
  margin-top: 16px;
}

.advanced-actions {
  display: flex;
  gap: 8px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
