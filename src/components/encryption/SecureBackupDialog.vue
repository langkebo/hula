<template>
  <n-modal v-model:show="visible" preset="card" :title="dialogTitle" style="width: 560px" :mask-closable="false">
    <n-spin :show="loading">
      <!-- Status Section -->
      <div v-if="activeTab === 'status'" class="tab-content">
        <div v-if="statusLoading" class="loading-placeholder">
          <n-spin size="small" />
          <span>{{ t('encryption.secure_backup.loading_status') }}</span>
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
              <n-button size="small" @click="activeTab = 'restore'">
                <template #icon><Icon icon="mdi:restore" :width="16" /></template>
                {{ t('encryption.secure_backup.restore_action') }}
              </n-button>
              <n-button size="small" @click="handleVerify">
                <template #icon><Icon icon="mdi:shield-check" :width="16" /></template>
                {{ t('encryption.secure_backup.verify_action') }}
              </n-button>
              <n-button size="small" @click="handleAddKeys">
                <template #icon><Icon icon="mdi:key-plus" :width="16" /></template>
                {{ t('encryption.secure_backup.add_keys_action') }}
              </n-button>
            </div>

            <n-divider style="margin: 12px 0" />

            <div class="danger-zone">
              <div class="danger-title">
                <Icon icon="mdi:alert-octagon" :width="18" />
                <span>{{ t('encryption.secure_backup.danger_zone') }}</span>
              </div>
              <n-popconfirm @positive-click="handleDelete">
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
            <n-button type="primary" @click="activeTab = 'create'">
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
            verifyResult.valid
              ? t('encryption.secure_backup.verify_valid')
              : t('encryption.secure_backup.verify_invalid')
          "
          closable
          @close="verifyResult = null"
          style="margin-top: 12px">
          <template v-if="verifyResult.valid">
            {{ t('encryption.secure_backup.verify_valid_desc', { keyCount: verifyResult.key_count }) }}
          </template>
          <template v-else>
            {{ t('encryption.secure_backup.verify_invalid_desc') }}
          </template>
        </n-alert>
      </div>

      <!-- Create Backup Flow -->
      <div v-else-if="activeTab === 'create'" class="tab-content">
        <!-- Step 1: Intro -->
        <div v-if="createStep === 0" class="step-content">
          <div class="intro-icon">
            <Icon icon="mdi:shield-key" :width="64" />
          </div>
          <div class="intro-text">
            <p>{{ t('encryption.secure_backup.create_intro_primary') }}</p>
            <p class="warning-text">{{ t('encryption.secure_backup.create_intro_warning') }}</p>
          </div>
          <div class="step-actions">
            <n-button @click="handleBackToStatus">{{ t('common.cancel') }}</n-button>
            <n-button type="primary" @click="createStep = 1">
              {{ t('encryption.secure_backup.create_next') }}
            </n-button>
          </div>
        </div>

        <!-- Step 2: Show Recovery Key -->
        <div v-else-if="createStep === 1" class="step-content">
          <div class="key-display">
            <div class="key-label">{{ t('encryption.secure_backup.recovery_key_label') }}</div>
            <div class="key-value">{{ recoveryKey }}</div>
            <div class="key-actions">
              <n-button size="small" @click="copyKey">
                <template #icon><Icon icon="mdi:content-copy" :width="16" /></template>
                {{ t('encryption.backup.copy_key') }}
              </n-button>
              <n-button size="small" @click="downloadKey">
                <template #icon><Icon icon="mdi:download" :width="16" /></template>
                {{ t('encryption.backup.download_key') }}
              </n-button>
            </div>
          </div>
          <div class="key-warning">
            <Icon icon="mdi:alert-circle" :width="20" />
            <span>{{ t('encryption.secure_backup.key_warning') }}</span>
          </div>
          <n-checkbox v-model:checked="keySaved" class="key-checkbox">
            {{ t('encryption.secure_backup.key_saved_confirm') }}
          </n-checkbox>
          <div class="password-field" style="margin-top: 16px; margin-bottom: 16px">
            <div class="password-label" style="font-size: 14px; margin-bottom: 8px">
              {{ t('setting.account.current_password') }}
            </div>
            <n-input
              v-model:value="currentPassword"
              type="password"
              show-password-on="click"
              :placeholder="t('setting.account.current_password_placeholder')" />
          </div>

          <div class="step-actions">
            <n-button @click="createStep = 0">{{ t('common.back') }}</n-button>
            <n-button type="primary" :disabled="!keySaved || !currentPassword.trim()" @click="handleCreateBackup">
              {{ t('encryption.secure_backup.create_confirm') }}
            </n-button>
          </div>
        </div>

        <!-- Step 3: Success -->
        <div v-else-if="createStep === 2" class="step-content">
          <div class="success-icon">
            <Icon icon="mdi:check-circle" :width="64" class="success-color" />
          </div>
          <div class="success-text">
            <h3>{{ t('encryption.secure_backup.create_success_title') }}</h3>
            <p>{{ t('encryption.secure_backup.create_success_desc') }}</p>
          </div>
          <div class="step-actions">
            <n-button type="primary" @click="handleCreateDone">
              {{ t('common.close') }}
            </n-button>
          </div>
        </div>
      </div>

      <!-- Restore from Backup -->
      <div v-else-if="activeTab === 'restore'" class="tab-content">
        <div class="intro-text">
          <p>{{ t('encryption.secure_backup.restore_intro') }}</p>
        </div>
        <n-input
          v-model:value="restoreRecoveryKey"
          type="textarea"
          :placeholder="t('encryption.recovery_key_placeholder')"
          :rows="4"
          :disabled="restoreLoading" />

        <!-- Restore result -->
        <n-alert
          v-if="restoreResult"
          :type="restoreResult.success ? 'success' : 'error'"
          :title="
            restoreResult.success
              ? t('encryption.secure_backup.restore_success')
              : t('encryption.secure_backup.restore_failed')
          "
          closable
          @close="restoreResult = null"
          style="margin-top: 12px">
          <template v-if="restoreResult.success">
            {{ t('encryption.secure_backup.restore_success_desc', { imported: restoreResult.imported }) }}
          </template>
          <template v-else>
            {{ t('encryption.secure_backup.restore_failed_desc') }}
          </template>
        </n-alert>

        <div class="step-actions" style="margin-top: 16px">
          <n-button @click="activeTab = 'status'">{{ t('common.back') }}</n-button>
          <n-button
            type="primary"
            :loading="restoreLoading"
            :disabled="!restoreRecoveryKey.trim()"
            @click="handleRestore">
            {{ t('encryption.restore') }}
          </n-button>
        </div>
      </div>
    </n-spin>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  NAlert,
  NButton,
  NCheckbox,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NInput,
  NModal,
  NPopconfirm,
  NSpin,
  NTag
} from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryption } from '@/composables/encryption'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import type { VerifyResult } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { matrixKeyBackupService } from '@/services/matrix/crypto/MatrixKeyBackupService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import type { GeneratedSecretStorageKey } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecureBackupDialog')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const encryption = useEncryption()

defineOptions({
  name: 'SecureBackupDialog'
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

// Tab management: 'status' | 'create' | 'restore'
type TabName = 'status' | 'create' | 'restore'
const activeTab = ref<TabName>('status')

// Loading states
const loading = ref(false)
const statusLoading = ref(false)
const restoreLoading = ref(false)

// Backup status data
const backupExists = ref(false)
const backupData = ref<{
  id: string
  algorithm: string
  keyCount: number | null
}>({ id: '', algorithm: '', keyCount: null })

// Create flow
const createStep = ref(0)
const recoveryKey = ref('')
const keySaved = ref(false)
const currentPassword = ref('')
const generatedRecoveryKey = ref<GeneratedSecretStorageKey | null>(null)

// Restore flow
const restoreRecoveryKey = ref('')
const restoreResult = ref<{ success: boolean; imported: number } | null>(null)

// Verify result
const verifyResult = ref<VerifyResult | null>(null)

const dialogTitle = computed(() => {
  switch (activeTab.value) {
    case 'create':
      return t('encryption.secure_backup.create_title')
    case 'restore':
      return t('encryption.secure_backup.restore_title')
    default:
      return t('encryption.secure_backup.dialog_title')
  }
})

// Load backup status when dialog opens
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      loadBackupStatus()
    } else {
      resetState()
    }
  },
  { immediate: true }
)

async function loadBackupStatus() {
  statusLoading.value = true
  try {
    const info = await encryption.getKeyBackupInfo()
    if (info?.version) {
      backupExists.value = true
      backupData.value = {
        id: info.version,
        algorithm: info.algorithm || '',
        keyCount: info.count !== undefined ? info.count : null
      }
    } else {
      backupExists.value = false
    }
  } catch {
    backupExists.value = false
  } finally {
    statusLoading.value = false
  }
}

function resetState() {
  activeTab.value = 'status'
  createStep.value = 0
  recoveryKey.value = ''
  keySaved.value = false
  currentPassword.value = ''
  generatedRecoveryKey.value = null
  restoreRecoveryKey.value = ''
  restoreResult.value = null
  verifyResult.value = null
  loading.value = false
  restoreLoading.value = false
}

function handleBackToStatus() {
  activeTab.value = 'status'
  createStep.value = 0
  recoveryKey.value = ''
  keySaved.value = false
  currentPassword.value = ''
  generatedRecoveryKey.value = null
}

async function handleCreateBackup() {
  if (!currentPassword.value.trim()) {
    showFeedback(t('setting.account.current_password_required'), 'warning')
    return
  }

  loading.value = true
  try {
    await matrixClientService.waitForClientReady({ timeoutMs: 10000 })

    // Check if we need to generate key here instead of in watch (better error handling)
    if (!generatedRecoveryKey.value) {
      const generatedKey = await matrixCryptoService.createRecoveryKeyFromPassphrase()
      if (!generatedKey?.encodedPrivateKey) {
        throw new Error('Failed to generate recovery key')
      }
      generatedRecoveryKey.value = generatedKey
      recoveryKey.value = generatedKey.encodedPrivateKey
    }

    await encryption.setupKeyBackup({
      password: currentPassword.value.trim(),
      generatedKey: generatedRecoveryKey.value
    })

    await loadBackupStatus()
    createStep.value = 2
    showFeedback(t('encryption.secure_backup.create_success'), 'success')
  } catch (err) {
    logger.error('Failed to create secure backup:', err)
    showFeedback(t('encryption.secure_backup.create_failed'), 'error')
  } finally {
    loading.value = false
  }
}

function handleCreateDone() {
  visible.value = false
  resetState()
  emit('success')
}

// When user enters create flow step 1, generate a recovery key to display
watch(createStep, async (newStep) => {
  if (activeTab.value === 'create' && newStep === 1 && !recoveryKey.value) {
    try {
      loading.value = true
      const generatedKey = await matrixCryptoService.createRecoveryKeyFromPassphrase()
      if (generatedKey?.encodedPrivateKey) {
        generatedRecoveryKey.value = generatedKey
        recoveryKey.value = generatedKey.encodedPrivateKey
      }
    } catch (e) {
      logger.error('Failed to generate key', e)
      showFeedback(t('encryption.secure_backup.create_failed'), 'error')
    } finally {
      loading.value = false
    }
  }
})

function copyKey() {
  navigator.clipboard
    .writeText(recoveryKey.value)
    .then(() => showFeedback(t('encryption.backup.copy_success'), 'success'))
    .catch(() => showFeedback(t('encryption.secure_backup.copy_failed'), 'error'))
}

function downloadKey() {
  const blob = new Blob([recoveryKey.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hula-secure-backup-key-${Date.now()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showFeedback(t('encryption.backup.download_success'), 'success')
}

async function handleRestore() {
  const key = restoreRecoveryKey.value.trim()
  if (!key) {
    showFeedback(t('encryption.recovery_key_required'), 'warning')
    return
  }

  restoreLoading.value = true
  restoreResult.value = null
  try {
    const result = await encryption.restoreFromBackup(key)
    restoreResult.value = { success: true, imported: result.imported ?? 0 }
    showFeedback(t('encryption.secure_backup.restore_success'), 'success')
  } catch (err) {
    logger.error('Failed to restore from secure backup:', err)
    restoreResult.value = { success: false, imported: 0 }
    showFeedback(t('encryption.secure_backup.restore_failed'), 'error')
  } finally {
    restoreLoading.value = false
  }
}

async function handleVerify() {
  if (!backupData.value.id) {
    showFeedback(t('encryption.secure_backup.no_backup_id'), 'warning')
    return
  }

  loading.value = true
  try {
    const result = await matrixKeyBackupService.verifyBackup(backupData.value.id)
    verifyResult.value = {
      valid: result.valid,
      algorithm: result.algorithm || backupData.value.algorithm,
      auth_data: result.auth_data || {},
      key_count: backupData.value.keyCount ?? 0,
      signatures: result.signatures || {}
    }
    if (result.valid) {
      showFeedback(t('encryption.secure_backup.verify_valid'), 'success')
    } else {
      showFeedback(t('encryption.secure_backup.verify_invalid'), 'warning')
    }
  } catch (err) {
    logger.error('Failed to verify secure backup:', err)
    showFeedback(t('encryption.secure_backup.verify_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function handleAddKeys() {
  showFeedback(t('encryption.secure_backup.add_keys_failed'), 'warning')
  // We no longer manually add keys to secure backup in the new rust-crypto high level API
  // It's handled automatically by the Rust Crypto machine
}

async function handleDelete() {
  if (!backupData.value.id) {
    showFeedback(t('encryption.secure_backup.no_backup_id'), 'warning')
    return
  }

  loading.value = true
  try {
    await encryption.deleteKeyBackup()
    backupExists.value = false
    backupData.value = { id: '', algorithm: '', keyCount: null }
    verifyResult.value = null
    showFeedback(t('encryption.secure_backup.delete_success'), 'success')
    await loadBackupStatus()
  } catch (err) {
    logger.error('Failed to delete secure backup:', err)
    showFeedback(t('encryption.secure_backup.delete_failed'), 'error')
  } finally {
    loading.value = false
  }
}
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
  color: var(--hula-text-quaternary);
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
  color: var(--hula-color-error);
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

.no-backup-icon {
  color: var(--hula-text-quaternary);
}

.no-backup p {
  color: var(--hula-text-quaternary);
  margin: 0;
}

.step-content {
  padding: 16px 0;
}

.intro-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  color: var(--hula-color-primary-500);
}

.intro-text {
  text-align: center;
  margin-bottom: 24px;
}

.intro-text p {
  margin: 8px 0;
  color: var(--hula-text-primary);
}

.warning-text {
  color: var(--color-warning) !important;
  font-weight: 500;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.key-display {
  background-color: var(--hula-encryption-surface-subtle);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

:deep(.dark) .key-display {
  background-color: var(--hula-encryption-surface-dark);
}

.key-label {
  font-size: 14px;
  color: var(--color-text-quaternary);
  margin-bottom: 8px;
}

.key-value {
  font-family: monospace;
  font-size: 14px;
  word-break: break-all;
  line-height: 1.6;
  padding: 12px;
  background-color: var(--hula-encryption-surface-subtle);
  border-radius: 4px;
  margin-bottom: 12px;
}

:deep(.dark) .key-value {
  background-color: var(--hula-encryption-surface-dark);
}

.key-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.key-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background-color: var(--color-warning-light);
  border-radius: 8px;
  margin-bottom: 16px;
  color: var(--color-warning);
}

.key-checkbox {
  margin-bottom: 16px;
}

.success-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.success-color {
  color: var(--color-success);
}

.success-text {
  text-align: center;
}

.success-text h3 {
  margin: 0 0 8px 0;
}

.success-text p {
  margin: 0;
  color: var(--color-text-quaternary);
}
</style>
