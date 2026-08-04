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
      <div v-if="!e2eeFullySetup && encryptionEnabled" class="e2ee-onboarding-hint">
        <Icon icon="mdi:shield-alert" :width="18" />
        <span>{{ t('setting.encryption.e2ee_incomplete_hint') }}</span>
        <n-button size="small" type="primary" @click="showOnboardingDialog = true">
          {{ t('setting.encryption.quick_setup') }}
        </n-button>
      </div>
      <div v-if="!e2eeFullySetup && encryptionEnabled" class="e2ee-bootstrap-action">
        <n-button type="primary" @click="showE2EEBootstrapWizard = true">
          <template #icon><Icon icon="mdi:shield-lock" :width="16" /></template>
          {{ t('setting.encryption.complete_e2ee_setup') }}
        </n-button>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.encryption.security_key_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.encryption.security_key_label') }}</span>
          <span class="setting-desc">
            {{
              securityKeySetup
                ? t('setting.encryption.security_key_configured')
                : t('setting.encryption.security_key_not_configured')
            }}
          </span>
        </div>
        <n-button size="small" @click="showSecurityKeyDialog = true">
          {{ securityKeySetup ? t('setting.encryption.manage') : t('setting.encryption.setup_action') }}
        </n-button>
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
      <h3 class="section-title">{{ t('setting.encryption.secure_backup_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.encryption.secure_backup_label') }}</span>
          <span class="setting-desc">{{ t('setting.encryption.secure_backup_desc') }}</span>
        </div>
        <n-button size="small" @click="showSecureBackupDialog = true">
          {{ t('setting.encryption.manage') }}
        </n-button>
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
      <h3 class="section-title">{{ t('setting.encryption.dehydrated_device_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.encryption.dehydrated_device_label') }}</span>
          <span class="setting-desc">{{ t('setting.encryption.dehydrated_device_desc') }}</span>
        </div>
        <n-button size="small" @click="showDehydratedDeviceManager = true">
          {{ t('setting.encryption.manage') }}
        </n-button>
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
          <span class="setting-label">{{ t('setting.encryption.qr_verify_label') }}</span>
          <span class="setting-desc">{{ t('setting.encryption.qr_verify_desc') }}</span>
        </div>
        <div class="flex gap-8px">
          <n-button size="small" @click="openVerifyDialog('qr_show')">
            {{ t('setting.device_verify_dialog.show_qr') }}
          </n-button>
          <n-button size="small" @click="openVerifyDialog('qr_scan')">
            {{ t('setting.device_verify_dialog.scan_qr') }}
          </n-button>
        </div>
      </div>
      <div v-if="pendingVerifications.length" class="pending-verifications">
        <div class="pending-title">{{ t('setting.encryption.pending_verifications_label') }}</div>
        <div v-for="request in pendingVerifications" :key="request.transactionId" class="pending-item">
          <div>
            <div class="pending-device">{{ request.deviceId }}</div>
            <div class="pending-user">{{ request.userId }}</div>
          </div>
          <div class="flex gap-8px">
            <n-button size="small" type="primary" @click="handleAcceptPendingVerification(request)">
              {{ t('setting.device_verify_dialog.accept_request') }}
            </n-button>
            <n-button size="small" @click="handleCancelPendingVerification(request)">
              {{ t('common.cancel') }}
            </n-button>
          </div>
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.encryption.device_key_label') }}</span>
          <span class="setting-desc">{{ t('setting.encryption.device_key_desc') }}</span>
        </div>
        <n-button size="small" @click="handleShowDeviceKey">{{ t('setting.encryption.view') }}</n-button>
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.encryption.device_trust_label') }}</span>
          <span class="setting-desc">{{ t('setting.encryption.device_trust_desc') }}</span>
        </div>
        <n-button size="small" @click="showDeviceTrustManager = true">
          {{ t('setting.encryption.manage') }}
        </n-button>
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

    <SecureBackupDialog v-model:show="showSecureBackupDialog" @success="handleSecureBackupSuccess" />

    <KeyBackupSetupDialog v-model:show="showBackupDialog" @success="handleBackupCreated" />

    <KeyBackupRestoreDialog v-model:show="showRestoreDialog" @success="handleRestoreSuccess" />

    <DeviceVerifyDialog
      :show="showVerifyDialog"
      :device-id="selectedVerificationRequest?.deviceId"
      :device-name="selectedVerificationRequest?.deviceId"
      :inbound-request="selectedVerificationRequest"
      :initial-mode="verifyDialogMode"
      @update:show="handleVerifyDialogVisibilityChange"
      @success="handleVerifySuccess" />

    <CrossSigningDialog v-model:show="showCrossSigningDialog" />

    <KeyRotationDialog v-model:show="showKeyRotationDialog" @updated="loadRotationStatus" />

    <SecurityKeySetupDialog v-model:show="showSecurityKeyDialog" @success="handleSecurityKeyCreated" />

    <E2EEOnboardingDialog
      v-model:show="showOnboardingDialog"
      @complete="handleOnboardingComplete"
      @skip="handleOnboardingSkip" />

    <DeviceTrustManager v-model:show="showDeviceTrustManager" />

    <DehydratedDeviceManager v-model:show="showDehydratedDeviceManager" />

    <E2EEBootstrapWizard
      v-model:show="showE2EEBootstrapWizard"
      @complete="handleE2EEBootstrapComplete"
      @skip="handleE2EEBootstrapSkip" />

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
import DehydratedDeviceManager from '@/components/encryption/DehydratedDeviceManager.vue'
import DeviceTrustManager from '@/components/encryption/DeviceTrustManager.vue'
import DeviceVerifyDialog from '@/components/encryption/DeviceVerifyDialog.vue'
import E2EEBootstrapWizard from '@/components/encryption/E2EEBootstrapWizard.vue'
import E2EEOnboardingDialog from '@/components/encryption/E2EEOnboardingDialog.vue'
import KeyBackupRestoreDialog from '@/components/encryption/KeyBackupRestoreDialog.vue'
import KeyBackupSetupDialog from '@/components/encryption/KeyBackupSetupDialog.vue'
import KeyRotationDialog from '@/components/encryption/KeyRotationDialog.vue'
import SecureBackupDialog from '@/components/encryption/SecureBackupDialog.vue'
import SecurityKeySetupDialog from '@/components/encryption/SecurityKeySetupDialog.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixEncryptionContextService } from '@/services/matrix/crypto/MatrixEncryptionContextService'
import { matrixVerificationService, type VerificationRequest } from '@/services/matrix/crypto/MatrixVerificationService'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('EncryptionSettings')

defineOptions({
  name: 'EncryptionSettings'
})

const { showFeedback } = useActionFeedback()
const { t } = useI18n()
const encryptionStore = useEncryptionStore()

const deviceKeyVisible = ref(false)
const deviceFingerprint = ref('')
const showBackupDialog = ref(false)
const showRestoreDialog = ref(false)
const showVerifyDialog = ref(false)
const showCrossSigningDialog = ref(false)
const showKeyRotationDialog = ref(false)
const showSecurityKeyDialog = ref(false)
const showSecureBackupDialog = ref(false)
const showOnboardingDialog = ref(false)
const showDeviceTrustManager = ref(false)
const showDehydratedDeviceManager = ref(false)
const showE2EEBootstrapWizard = ref(false)
const createBackupLoading = ref(false)
const pendingVerifications = ref<VerificationRequest[]>([])
const selectedVerificationRequest = ref<VerificationRequest | null>(null)
const verifyDialogMode = ref<'sas' | 'qr_show' | 'qr_scan'>('sas')

const encryptionEnabled = computed(() => encryptionStore.encryptionEnabled)
const securityKeySetup = computed(() => encryptionStore.securityKeyConfigured)
const crossSigningSetup = computed(() => encryptionStore.crossSigningSetup)
const backupEnabled = computed(() => encryptionStore.backupEnabled)
const backupVersion = computed(() => encryptionStore.backupVersion)
const needsRotation = computed(() => encryptionStore.needsRotation)
const deviceVerified = computed(() => encryptionStore.deviceVerified)
const e2eeFullySetup = computed(() => encryptionStore.e2eeFullySetup)

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
  await encryptionStore.loadEncryptionStatus()

  if (!encryptionEnabled.value) {
    return
  }

  try {
    const fingerprint = await matrixEncryptionContextService.getCurrentDeviceFingerprint()
    if (fingerprint) {
      deviceFingerprint.value = formatFingerprint(fingerprint)
    }

    await encryptionStore.loadDeviceVerification()
    pendingVerifications.value = await matrixVerificationService.getPendingVerifications()
  } catch (error) {
    logger.error('Failed to load encryption details', error)
  }
}

async function loadRotationStatus() {
  await encryptionStore.loadRotationStatus()
}

function formatFingerprint(key: string): string {
  return key.match(/.{1,4}/g)?.join(' ') || key
}

function handleBackupToggle(value: boolean) {
  if (!encryptionEnabled.value) {
    showFeedback(t('setting.encryption.enable_required'), 'warning')
    return
  }

  localStorage.setItem('tjg-backup-enabled', value.toString())
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
  encryptionStore.markBackupEnabled(String(Date.now()))
  showFeedback(t('setting.encryption.backup_created'), 'success')
}

function handleRestoreBackup() {
  showRestoreDialog.value = true
}

function handleRestoreSuccess() {
  showFeedback(t('setting.encryption.restore_success'), 'success')
}

function handleVerifyDevice() {
  openVerifyDialog('sas')
}

function openVerifyDialog(mode: 'sas' | 'qr_show' | 'qr_scan') {
  verifyDialogMode.value = mode
  selectedVerificationRequest.value = null
  showVerifyDialog.value = true
}

function handleVerifyDialogVisibilityChange(value: boolean) {
  showVerifyDialog.value = value
  if (!value) {
    selectedVerificationRequest.value = null
    verifyDialogMode.value = 'sas'
    void loadEncryptionInfo()
  }
}

function handleVerifySuccess() {
  encryptionStore.markDeviceVerified()
  showFeedback(t('setting.encryption.verify_success'), 'success')
  showVerifyDialog.value = false
  void loadEncryptionInfo()
}

function handleAcceptPendingVerification(request: VerificationRequest) {
  verifyDialogMode.value = 'sas'
  selectedVerificationRequest.value = request
  showVerifyDialog.value = true
}

async function handleCancelPendingVerification(request: VerificationRequest) {
  try {
    await matrixVerificationService.cancelVerification(request.transactionId, 'User cancelled verification')
    showFeedback(t('setting.encryption.pending_verification_cancelled'), 'success')
    pendingVerifications.value = pendingVerifications.value.filter(
      (item) => item.transactionId !== request.transactionId
    )
  } catch (error) {
    logger.error('Failed to cancel pending verification', error)
    showFeedback(t('setting.encryption.pending_verification_cancel_failed'), 'error')
  }
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

function handleSecurityKeyCreated() {
  encryptionStore.markSecurityKeyConfigured()
  showFeedback(t('setting.encryption.security_key_created'), 'success')
}

function handleOnboardingComplete() {
  loadEncryptionInfo()
  showFeedback(t('setting.encryption.onboarding_complete'), 'success')
}

function handleOnboardingSkip() {
  showFeedback(t('setting.encryption.onboarding_skip'), 'warning')
}

function handleSecureBackupSuccess() {
  showFeedback(t('setting.encryption.secure_backup_success'), 'success')
}

function handleE2EEBootstrapComplete() {
  loadEncryptionInfo()
  showFeedback(t('setting.encryption.onboarding_complete'), 'success')
}

function handleE2EEBootstrapSkip() {
  showFeedback(t('setting.encryption.onboarding_skip'), 'warning')
}
</script>

<style scoped>
.encryption-settings {
  padding: 0 var(--tjg-space-2);
}

.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.key-status {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-4);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.key-status-active {
  background-color: var(--tjg-color-success-100);
}

.key-status-inactive {
  background-color: var(--tjg-color-warning-100);
}

.key-info {
  display: flex;
  flex-direction: column;
}

.key-name {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.key-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.setting-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}

.encryption-info {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-4);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-secondary);
}

.info-value {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.device-key-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--tjg-space-4);
}

.fingerprint {
  font-family: monospace;
  font-size: var(--tjg-font-size-lg);
  letter-spacing: 2px;
  padding: var(--tjg-space-4);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
  word-break: break-all;
  text-align: center;
}

.fingerprint-hint {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  text-align: center;
  margin-top: var(--tjg-space-2);
}

.e2ee-onboarding-hint {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  margin-top: var(--tjg-space-3);
  padding: var(--tjg-space-3);
  background-color: var(--tjg-color-warning-100);
  border-radius: var(--tjg-radius-sm);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
}

.e2ee-bootstrap-action {
  margin-top: var(--tjg-space-3);
  display: flex;
  justify-content: center;
}

.pending-verifications {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
  padding: var(--tjg-space-3) 0;
}

.pending-title {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
}

.pending-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-3);
  border: 1px solid var(--tjg-settings-divider);
  border-radius: var(--tjg-radius-sm);
}

.pending-device {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.pending-user {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}
</style>
