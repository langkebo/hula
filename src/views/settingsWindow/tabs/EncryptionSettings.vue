<template>
  <div class="encryption-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.encryption.key_section') }}</h3>
      <div class="key-status" :class="encryptionEnabled ? 'key-status-active' : 'key-status-inactive'">
        <Icon :icon="encryptionEnabled ? 'mdi:key-variant' : 'mdi:key-outline'" :width="32" />
        <div class="key-info">
          <div class="key-name">{{ t('setting.encryption.key_status_title') }}</div>
          <div class="key-desc">{{ keyStatus }}</div>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.encryption.backup_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.encryption.backup_enable_label') }}</span>
          <span class="setting-desc">{{ t('setting.encryption.backup_enable_desc') }}</span>
        </div>
        <n-switch v-model:value="backupEnabled" :disabled="!encryptionEnabled" @update:value="handleBackupToggle" />
      </div>
      <div v-if="backupEnabled && encryptionEnabled" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.encryption.backup_version_label') }}</span>
          <span class="setting-desc">
            {{ t('setting.encryption.backup_version_desc', { version: backupVersion }) }}
          </span>
        </div>
        <n-button size="small" :loading="createBackupLoading" @click="handleCreateBackup">
          {{ t('setting.encryption.create_backup') }}
        </n-button>
      </div>
      <div v-if="backupEnabled && encryptionEnabled" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.encryption.restore_key_label') }}</span>
          <span class="setting-desc">{{ t('setting.encryption.restore_key_desc') }}</span>
        </div>
        <n-button size="small" @click="handleRestoreBackup">{{ t('setting.encryption.restore') }}</n-button>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.encryption.cross_signing_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.encryption.cross_signing_status_label') }}</span>
          <span class="setting-desc">
            {{ crossSigningSetup ? t('setting.encryption.setup_complete') : t('setting.encryption.setup_incomplete') }}
          </span>
        </div>
        <n-button size="small" @click="showCrossSigningDialog = true">
          {{ crossSigningSetup ? t('setting.encryption.manage') : t('setting.encryption.setup_action') }}
        </n-button>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.encryption.rotation_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.encryption.rotation_status_label') }}</span>
          <span class="setting-desc">
            {{ needsRotation ? t('setting.encryption.rotation_needed') : t('setting.encryption.rotation_up_to_date') }}
          </span>
        </div>
        <n-button size="small" @click="showKeyRotationDialog = true">{{ t('setting.encryption.manage') }}</n-button>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.encryption.device_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.encryption.verify_status_label') }}</span>
          <span class="setting-desc">
            {{
              deviceVerified
                ? t('setting.encryption.this_device_verified')
                : t('setting.encryption.this_device_unverified')
            }}
          </span>
        </div>
        <n-button v-if="!deviceVerified" size="small" type="primary" @click="handleVerifyDevice">
          {{ t('setting.encryption.verify_device_action') }}
        </n-button>
        <n-tag v-else type="success">{{ t('setting.encryption.verified') }}</n-tag>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.encryption.device_key_label') }}</span>
          <span class="setting-desc">{{ t('setting.encryption.device_key_desc') }}</span>
        </div>
        <n-button size="small" @click="handleShowDeviceKey">{{ t('setting.encryption.view') }}</n-button>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.encryption.info_section') }}</h3>
      <div class="encryption-info">
        <div class="info-item">
          <span class="info-label">{{ t('setting.encryption.algorithm_label') }}</span>
          <span class="info-value">{{ encryptionAlgorithm }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('setting.encryption.verified_devices_label') }}</span>
          <span class="info-value">
            {{ t('setting.encryption.device_count', { count: String(verifiedDevicesCount) }) }}
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">{{ t('setting.encryption.unverified_devices_label') }}</span>
          <span class="info-value">
            {{ t('setting.encryption.device_count', { count: String(unverifiedDevicesCount) }) }}
          </span>
        </div>
      </div>
    </div>

    <KeyBackupSetupDialog v-model:show="showBackupDialog" @success="handleBackupCreated" />

    <KeyBackupRestoreDialog v-model:show="showRestoreDialog" @success="handleRestoreSuccess" />

    <DeviceVerifyDialog v-model:show="showVerifyDialog" @success="handleVerifySuccess" />

    <CrossSigningDialog v-model:show="showCrossSigningDialog" />

    <KeyRotationDialog v-model:show="showKeyRotationDialog" @updated="loadRotationStatus" />

    <n-modal
      v-model:show="deviceKeyVisible"
      preset="card"
      :title="t('setting.encryption.device_key_fingerprint_title')"
      style="width: 400px">
      <div class="device-key-display">
        <div class="fingerprint">{{ deviceFingerprint }}</div>
        <n-button size="small" @click="copyFingerprint">{{ t('setting.encryption.copy') }}</n-button>
      </div>
      <div class="fingerprint-hint">{{ t('setting.encryption.fingerprint_hint') }}</div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NDivider, NModal, NSwitch, NTag } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CrossSigningDialog from '@/components/encryption/CrossSigningDialog.vue'
import DeviceVerifyDialog from '@/components/encryption/DeviceVerifyDialog.vue'
import KeyBackupRestoreDialog from '@/components/encryption/KeyBackupRestoreDialog.vue'
import KeyBackupSetupDialog from '@/components/encryption/KeyBackupSetupDialog.vue'
import KeyRotationDialog from '@/components/encryption/KeyRotationDialog.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixEncryptionContextService } from '@/services/matrix/crypto/MatrixEncryptionContextService'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
import { matrixVerificationService } from '@/services/matrix/crypto/MatrixVerificationService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('EncryptionSettings')

defineOptions({
  name: 'EncryptionSettings'
})

const { showFeedback } = useActionFeedback()
const { t } = useI18n()

const backupEnabled = ref(false)
const backupVersion = ref('v1')
const deviceVerified = ref(false)
const deviceKeyVisible = ref(false)
const deviceFingerprint = ref('')
const showBackupDialog = ref(false)
const showRestoreDialog = ref(false)
const showVerifyDialog = ref(false)
const showCrossSigningDialog = ref(false)
const showKeyRotationDialog = ref(false)
const createBackupLoading = ref(false)
const crossSigningSetup = ref(false)
const needsRotation = ref(false)
const encryptionEnabled = ref(false)

const keyStatus = computed(() => {
  if (!encryptionEnabled.value) {
    return t('setting.encryption.key_status_disabled')
  }
  return backupEnabled.value ? t('setting.encryption.key_status_backed_up') : t('setting.encryption.key_status_ready')
})

const encryptionAlgorithm = computed(() => {
  return encryptionEnabled.value ? 'Megolm (AES-256)' : t('setting.encryption.disabled')
})

const verifiedDevicesCount = ref(0)
const unverifiedDevicesCount = ref(1)

onMounted(async () => {
  await loadEncryptionInfo()
})

async function loadEncryptionInfo() {
  const { userId, deviceId, isCryptoEnabled } = matrixEncryptionContextService.getCurrentSessionContext()
  encryptionEnabled.value = isCryptoEnabled

  if (!isCryptoEnabled) {
    return
  }

  try {
    const fingerprint = await matrixEncryptionContextService.getCurrentDeviceFingerprint()
    if (fingerprint) {
      deviceFingerprint.value = formatFingerprint(fingerprint)
    }

    if (userId && deviceId) {
      deviceVerified.value = await matrixVerificationService.isDeviceVerified(userId, deviceId)
    }

    const backupInfo = await matrixEncryptionService.getKeyBackupInfo()
    if (backupInfo) {
      backupEnabled.value = true
      backupVersion.value = `v${backupInfo.version || 1}`
    }

    const savedBackup = localStorage.getItem('hula-backup-enabled')
    if (savedBackup !== null) {
      backupEnabled.value = savedBackup === 'true'
    }

    const crossSigningInfo = await matrixEncryptionService.getCrossSigningInfo()
    crossSigningSetup.value = crossSigningInfo.isSetup

    await loadRotationStatus()
  } catch (error) {
    logger.error('Failed to load encryption details', error)
  }
}

async function loadRotationStatus() {
  const rotationStatus = await matrixEncryptionService.getKeyRotationStatus()
  needsRotation.value = rotationStatus.needsRotation
}

function formatFingerprint(key: string): string {
  return key.match(/.{1,4}/g)?.join(' ') || key
}

function handleBackupToggle(value: boolean) {
  if (!encryptionEnabled.value) {
    showFeedback(t('setting.encryption.enable_required'), 'warning')
    backupEnabled.value = false
    return
  }

  localStorage.setItem('hula-backup-enabled', value.toString())
  if (value) {
    showBackupDialog.value = true
  } else {
    showFeedback(t('setting.encryption.backup_disabled_feedback'), 'warning')
  }
}

function handleCreateBackup() {
  showBackupDialog.value = true
}

function handleBackupCreated() {
  backupEnabled.value = true
  backupVersion.value = `v${Date.now()}`
  showFeedback(t('setting.encryption.backup_created'), 'success')
}

function handleRestoreBackup() {
  showRestoreDialog.value = true
}

function handleRestoreSuccess() {
  showFeedback(t('setting.encryption.restore_success'), 'success')
}

function handleVerifyDevice() {
  showVerifyDialog.value = true
}

function handleVerifySuccess() {
  deviceVerified.value = true
  showFeedback(t('setting.encryption.verify_success'), 'success')
}

function handleShowDeviceKey() {
  if (!deviceFingerprint.value) {
    deviceFingerprint.value = 'XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX XXXX'
  }
  deviceKeyVisible.value = true
}

function copyFingerprint() {
  navigator.clipboard.writeText(deviceFingerprint.value.replace(/\s/g, ''))
  showFeedback(t('setting.encryption.copied'), 'success')
}
</script>

<style scoped>
.encryption-settings {
  padding: 0 var(--hula-space-2);
}

.settings-section {
  margin-bottom: var(--hula-space-4);
}

.section-title {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-medium);
  margin-bottom: var(--hula-space-4);
  color: var(--hula-text-primary);
}

.key-status {
  display: flex;
  align-items: center;
  gap: var(--hula-space-3);
  padding: var(--hula-space-4);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
}

.key-status-active {
  background-color: var(--hula-color-success-100);
}

.key-status-inactive {
  background-color: var(--hula-color-warning-100);
}

.key-info {
  display: flex;
  flex-direction: column;
}

.key-name {
  font-size: var(--hula-font-size-base);
  font-weight: var(--hula-font-weight-medium);
  color: var(--hula-text-primary);
}

.key-desc {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: var(--hula-space-1);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-space-3) 0;
  border-bottom: 1px solid var(--hula-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
}

.setting-desc {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: var(--hula-space-1);
}

.encryption-info {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-3);
  padding: var(--hula-space-4);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-secondary);
}

.info-value {
  font-size: var(--hula-font-size-base);
  font-weight: var(--hula-font-weight-medium);
  color: var(--hula-text-primary);
}

.device-key-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--hula-space-4);
}

.fingerprint {
  font-family: monospace;
  font-size: var(--hula-font-size-lg);
  letter-spacing: 2px;
  padding: var(--hula-space-4);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
  word-break: break-all;
  text-align: center;
}

.fingerprint-hint {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  text-align: center;
  margin-top: var(--hula-space-2);
}
</style>
