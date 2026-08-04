<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('encryption.backup_restore_dialog.title')"
    style="width: 560px"
    :mask-closable="false">
    <n-spin :show="loading">
      <div class="restore-content">
        <div class="intro-text">
          <p>{{ t('encryption.backup_restore_dialog.intro_primary') }}</p>
          <p class="hint-text">{{ t('encryption.backup_restore_dialog.intro_hint') }}</p>
        </div>

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
                  :placeholder="t('encryption.recovery_key_placeholder')"
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
                <n-button text size="tiny" @click="clearFile">
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
          {{ t('encryption.restore') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { UploadCustomRequestOptions } from 'naive-ui'
import {
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
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryption } from '@/composables/encryption'
import { matrixKeyBackupService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('KeyBackupRestore')
const timerManager = useTimerManager()
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const encryption = useEncryption()

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

const loading = ref(false)
const restoreProgress = ref<number | null>(null)
const restoreResult = ref<{ success: boolean; message: string } | null>(null)
const activeTab = ref('recoveryKey')

// Version selection
const backupVersions = ref<Array<{ version: string; algorithm: string }>>([])
const selectedVersion = ref<string | null>(null)

const versionOptions = computed(() =>
  backupVersions.value.map((v) => ({
    label: `${t('encryption.backup_restore_dialog.version_label')} ${v.version} (${v.algorithm})`,
    value: v.version
  }))
)

// Recovery key form
const formData = reactive({
  recoveryKey: ''
})

// Key file
const fileName = ref('')
const fileContent = ref('')

// Passphrase form
const passphraseData = reactive({
  passphrase: ''
})

// Advanced options
const advancedData = reactive({
  roomId: '',
  sessionId: ''
})

const canRestore = computed(() => {
  if (loading.value) return false
  if (activeTab.value === 'recoveryKey') return !!formData.recoveryKey.trim()
  if (activeTab.value === 'keyFile') return !!fileContent.value.trim()
  if (activeTab.value === 'passphrase') return !!passphraseData.passphrase.trim()
  return false
})

onMounted(async () => {
  await loadBackupVersions()
})

async function loadBackupVersions() {
  try {
    const info = await encryption.getKeyBackupInfo()
    if (info) {
      // Single version: auto-select and hide selector
      const versionInfo = {
        version: String(info.version ?? '1'),
        algorithm: String(info.algorithm ?? 'unknown')
      }
      backupVersions.value = [versionInfo]
      selectedVersion.value = versionInfo.version
    }
  } catch {
    // No backup info available, continue without version selection
  }
}

function handleFileUpload({ file }: UploadCustomRequestOptions) {
  const rawFile = file.file
  if (!rawFile) return

  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result
    if (typeof content === 'string') {
      fileContent.value = content.trim()
    } else {
      showFeedback(t('encryption.backup_restore_dialog.file_read_failed'), 'error')
    }
  }
  reader.onerror = () => {
    showFeedback(t('encryption.backup_restore_dialog.file_read_failed'), 'error')
  }
  reader.readAsText(rawFile)
}

function clearFile() {
  fileName.value = ''
  fileContent.value = ''
}

function handleCancel() {
  visible.value = false
  resetState()
}

function resetState() {
  formData.recoveryKey = ''
  passphraseData.passphrase = ''
  fileName.value = ''
  fileContent.value = ''
  advancedData.roomId = ''
  advancedData.sessionId = ''
  loading.value = false
  restoreProgress.value = null
  restoreResult.value = null
}

async function handleRestore() {
  if (activeTab.value === 'recoveryKey') {
    const recoveryKey = formData.recoveryKey.trim()
    if (!recoveryKey) {
      showFeedback(t('encryption.recovery_key_required'), 'warning')
      return
    }
    await runRestore(() => encryption.restoreFromBackup(recoveryKey))
  } else if (activeTab.value === 'keyFile') {
    const recoveryKey = fileContent.value.trim()
    if (!recoveryKey) {
      showFeedback(t('encryption.backup_restore_dialog.file_required'), 'warning')
      return
    }
    await runRestore(() => encryption.restoreFromBackup(recoveryKey))
  } else if (activeTab.value === 'passphrase') {
    const passphrase = passphraseData.passphrase.trim()
    if (!passphrase) {
      showFeedback(t('encryption.backup_restore_dialog.passphrase_required'), 'warning')
      return
    }
    await runRestore(() => encryption.restoreFromBackupWithPassphrase(passphrase))
  }
}

async function runRestore(restoreOperation: () => Promise<{ imported: number; total: number }>) {
  loading.value = true
  restoreProgress.value = 0
  restoreResult.value = null
  let progressInterval: number | null = null

  try {
    progressInterval = timerManager.setInterval(() => {
      if (restoreProgress.value !== null && restoreProgress.value < 90) {
        restoreProgress.value += 10
      }
    }, 200)

    const result = await restoreOperation()

    timerManager.clearInterval(progressInterval)
    restoreProgress.value = 100

    restoreResult.value = {
      success: true,
      message: t('encryption.backup_restore_dialog.restore_result_success', { imported: result.imported })
    }

    showFeedback(t('encryption.restore_success'), 'success')

    timerManager.setTimeout(() => {
      visible.value = false
      resetState()
      emit('success')
    }, 1500)
  } catch (error) {
    logger.error('Failed to restore from backup:', error)
    restoreProgress.value = null
    restoreResult.value = {
      success: false,
      message: t('encryption.backup_restore_dialog.restore_result_failed')
    }
    showFeedback(t('encryption.restore_backup_failed'), 'error')
  } finally {
    if (progressInterval !== null) {
      timerManager.clearInterval(progressInterval)
    }
    loading.value = false
  }
}

async function handleRoomRecover() {
  const version = selectedVersion.value
  const roomId = advancedData.roomId.trim()
  if (!version || !roomId) {
    showFeedback(t('encryption.backup_restore_dialog.room_id_required'), 'warning')
    return
  }

  loading.value = true
  restoreResult.value = null
  try {
    await matrixKeyBackupService.recoverRoomKeys(version, roomId)
    restoreResult.value = {
      success: true,
      message: t('encryption.backup_restore_dialog.room_recover_success', { roomId })
    }
    showFeedback(t('encryption.restore_success'), 'success')
  } catch (error) {
    logger.error('Failed to recover room keys:', error)
    restoreResult.value = {
      success: false,
      message: t('encryption.backup_restore_dialog.room_recover_failed')
    }
    showFeedback(t('encryption.restore_backup_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function handleSessionRecover() {
  const version = selectedVersion.value
  const roomId = advancedData.roomId.trim()
  const sessionId = advancedData.sessionId.trim()
  if (!version || !roomId || !sessionId) {
    showFeedback(t('encryption.backup_restore_dialog.session_id_required'), 'warning')
    return
  }

  loading.value = true
  restoreResult.value = null
  try {
    await matrixKeyBackupService.recoverSessionKey(version, roomId, sessionId)
    restoreResult.value = {
      success: true,
      message: t('encryption.backup_restore_dialog.session_recover_success')
    }
    showFeedback(t('encryption.restore_success'), 'success')
  } catch (error) {
    logger.error('Failed to recover session key:', error)
    restoreResult.value = {
      success: false,
      message: t('encryption.backup_restore_dialog.session_recover_failed')
    }
    showFeedback(t('encryption.restore_backup_failed'), 'error')
  } finally {
    loading.value = false
  }
}
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
  background-color: rgba(255, 255, 255, 0.06);
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
