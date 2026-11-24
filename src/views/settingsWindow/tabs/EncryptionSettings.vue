<template>
  <!-- 本地 crypto 未初始化时整页只读：提示 + inert 阻断所有交互 -->
  <div class="encryption-settings" :inert="isReadOnly ? true : undefined">
    <div v-if="isReadOnly" class="e2ee-onboarding-hint" data-testid="e2ee-unsupported">
      <Icon icon="mdi:shield-off" :width="18" />
      <span>{{ t('setting.encryption.crypto_unavailable') }}</span>
    </div>

    <div v-if="loadError" class="setting-load-error" role="alert">
      <Icon icon="mdi:alert-circle-outline" :width="18" />
      <span>{{ t('setting.encryption.load_failed') }}</span>
      <n-button size="small" :loading="devicesLoading" @click="loadEncryptionInfo">{{ t('common.retry') }}</n-button>
    </div>

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

    <KeyBackupSection />

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

    <CrossSigningSection @manage="showCrossSigningDialog = true" @needs-setup="showSecurityKeyDialog = true" />

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

    <DehydratedDeviceSection />

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
      <div v-if="pendingVerifications.length" class="pending-verifications">
        <div class="pending-title">{{ t('setting.encryption.pending_verifications_label') }}</div>
        <div v-for="request in pendingVerifications" :key="request.transactionId" class="pending-item">
          <div>
            <div class="pending-device">{{ request.deviceId }}</div>
            <div class="pending-user">{{ request.userId }}</div>
          </div>
          <div class="flex gap-8px">
            <n-button size="small" type="primary" @click="handleAcceptPendingVerification(request)">
              {{ t('setting.encryption.device_verify_dialog.accept_request') }}
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

    <!-- R-1：严格模式（默认关闭，保留与 Element 等客户端的互操作） -->
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.encryption.strict_section') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.encryption.strict_label') }}</span>
          <span class="setting-desc">{{ t('setting.encryption.strict_desc') }}</span>
        </div>
        <n-switch
          data-testid="strict-unverified-switch"
          :value="strictModeEnabled"
          :disabled="!encryptionEnabled"
          @update:value="handleStrictModeToggle" />
      </div>
    </div>

    <n-divider />

    <EncryptionInfoSection
      :algorithm="encryptionAlgorithm"
      :verified-count="verifiedDevicesCount"
      :unverified-count="unverifiedDevicesCount" />

    <SecureBackupDialog v-model:show="showSecureBackupDialog" @success="handleSecureBackupSuccess" />

    <DeviceVerifyDialog
      :show="showVerifyDialog"
      :device-id="selectedVerificationTransaction?.deviceId"
      :device-name="selectedVerificationTransaction?.deviceId"
      :inbound-request="selectedVerificationTransaction"
      :initial-mode="verifyDialogMode"
      @update:show="handleVerifyDialogVisibilityChange"
      @success="handleVerifySuccess" />

    <CrossSigningDialog v-model:show="showCrossSigningDialog" />

    <KeyRotationDialog v-model:show="showKeyRotationDialog" @updated="refreshRotationStatus" />

    <SecurityKeySetupDialog v-model:show="showSecurityKeyDialog" @success="handleSecurityKeyCreated" />

    <E2EEOnboardingDialog
      v-model:show="showOnboardingDialog"
      @complete="handleOnboardingComplete"
      @skip="handleOnboardingSkip" />

    <DeviceTrustManager v-model:show="showDeviceTrustManager" @setup-cross-signing="handleSetupCrossSigning" />

    <E2EEBootstrapWizard
      v-model:show="showE2EEBootstrapWizard"
      @complete="handleE2EEBootstrapComplete"
      @skip="handleE2EEBootstrapSkip" />

    <n-modal
      v-model:show="deviceKeyVisible"
      preset="card"
      :title="t('setting.encryption.device_key_fingerprint_title')"
      class="modal-width-400">
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
import DeviceTrustManager from '@/components/encryption/DeviceTrustManager.vue'
import DeviceVerifyDialog from '@/components/encryption/DeviceVerifyDialog.vue'
import E2EEBootstrapWizard from '@/components/encryption/E2EEBootstrapWizard.vue'
import E2EEOnboardingDialog from '@/components/encryption/E2EEOnboardingDialog.vue'
import KeyRotationDialog from '@/components/encryption/KeyRotationDialog.vue'
import SecureBackupDialog from '@/components/encryption/SecureBackupDialog.vue'
import SecurityKeySetupDialog from '@/components/encryption/SecurityKeySetupDialog.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useClipboard } from '@/composables/common/useClipboard'
import type { VerificationTransaction } from '@/composables/encryption/useEncryption'
import { useEncryptionSettings } from '@/composables/encryption/useEncryptionSettings'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'
import { createLogger } from '@/utils/Logger'
import CrossSigningSection from './sections/CrossSigningSection.vue'
import DehydratedDeviceSection from './sections/DehydratedDeviceSection.vue'
import EncryptionInfoSection from './sections/EncryptionInfoSection.vue'
import KeyBackupSection from './sections/KeyBackupSection.vue'

const logger = createLogger('EncryptionSettings')

defineOptions({
  name: 'EncryptionSettings'
})

const { showFeedback } = useActionFeedback()
const { write: writeClipboard } = useClipboard()
const { t } = useI18n()

/**
 * R-1 严格模式：全局偏好 → SDK 可写属性 `crypto.globalBlacklistUnverifiedDevices`。
 *
 * 注意本 fork **没有** `setGlobalBlacklistUnverifiedDevices()` 方法，
 * 且该值随 client 重建归零 ⇒ 除在此即时施加外，登录/crypto 初始化后
 * 还需由 `reapplyPersistedStrictness()` 重放（见该函数注释）。
 * 偏好读写与施加逻辑统一在 `useEncryptionSettings` 中，与移动端设置页共用一份实现。
 */
const deviceKeyVisible = ref(false)
const showVerifyDialog = ref(false)
const showCrossSigningDialog = ref(false)
const showKeyRotationDialog = ref(false)
const showSecurityKeyDialog = ref(false)
const showSecureBackupDialog = ref(false)
const showOnboardingDialog = ref(false)
const showDeviceTrustManager = ref(false)

/**
 * 从未验证设备列表跳去「安全检查」。
 *
 * 先关设备管理器：它是模态框，不关的话用户看不到后面的交叉签名弹窗。
 */
function handleSetupCrossSigning() {
  showDeviceTrustManager.value = false
  showCrossSigningDialog.value = true
}
const showE2EEBootstrapWizard = ref(false)
const loadError = ref(false)
const selectedVerificationTransaction = ref<VerificationTransaction | null>(null)
const verifyDialogMode = ref<'sas'>('sas')

// 加密总览、设备会话、严格模式与刷新编排统一由 useEncryptionSettings 提供（与移动端共用同一份实现）
const {
  encryptionEnabled,
  deviceVerified,
  backupEnabled,
  devicesLoading,
  crossSigningSetup: securityKeySetup,
  needsRotation,
  e2eeFullySetup,
  refreshRotationStatus,
  markSecurityKeyConfigured,
  strictModeEnabled,
  setStrictMode: handleStrictModeToggle,
  deviceFingerprint,
  pendingVerifications,
  verifiedDevicesCount,
  unverifiedDevicesCount,
  refreshEncryptionSettings,
  cancelPendingVerification
} = useEncryptionSettings()

// E2EE 属客户端能力，服务端 /capabilities 不宣告（CAP-08）。
// 只读只认「尝试初始化且失败」（cryptoInitFailed）：仅"还没初始化完"（登录初期 / startClient 在途）
// 不是失败，若据此锁页会把整页 inert 且无法自愈。
const encryptionStore = useEncryptionStore()
const isReadOnly = computed(() => encryptionStore.cryptoInitFailed)

const keyStatus = computed(() => {
  if (!encryptionEnabled.value) {
    return t('setting.encryption.key_status_disabled')
  }
  return backupEnabled.value ? t('setting.encryption.key_status_backed_up') : t('setting.encryption.key_status_ready')
})

const encryptionAlgorithm = computed(() => {
  return encryptionEnabled.value ? 'Megolm (AES-256)' : t('setting.encryption.disabled')
})

onMounted(() => void loadEncryptionInfo())

async function loadEncryptionInfo() {
  loadError.value = false
  try {
    // 总览 → 本机指纹与待处理验证 → 设备列表，统一由共享 composable 编排
    const { devicesLoaded } = await refreshEncryptionSettings({ includeDeviceDetails: true })
    // 设备列表失败时存储层已清空列表，这里显式暴露错误态并提供重试
    loadError.value = !devicesLoaded
  } catch (error) {
    logger.error('Failed to load encryption settings:', error)
    loadError.value = true
  }
}

function handleVerifyDevice() {
  openVerifyDialog('sas')
}

function openVerifyDialog(mode: 'sas') {
  verifyDialogMode.value = mode
  selectedVerificationTransaction.value = null
  showVerifyDialog.value = true
}

function handleVerifyDialogVisibilityChange(value: boolean) {
  showVerifyDialog.value = value
  if (!value) {
    selectedVerificationTransaction.value = null
    verifyDialogMode.value = 'sas'
    void loadEncryptionInfo()
  }
}

function handleVerifySuccess() {
  showFeedback(t('setting.encryption.verify_success'), 'success')
  showVerifyDialog.value = false
  // 验证状态以 SDK 为准：loadEncryptionInfo 内部会重读总览与设备列表
  void loadEncryptionInfo()
}

function handleAcceptPendingVerification(request: VerificationTransaction) {
  verifyDialogMode.value = 'sas'
  selectedVerificationTransaction.value = request
  showVerifyDialog.value = true
}

async function handleCancelPendingVerification(request: VerificationTransaction) {
  try {
    await cancelPendingVerification(request.transactionId)
    showFeedback(t('setting.encryption.pending_verification_cancelled'), 'success')
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

async function copyFingerprint() {
  await writeClipboard(deviceFingerprint.value.replace(/\s/g, '')).catch((err) =>
    logger.error('Failed to copy device fingerprint:', err)
  )
  showFeedback(t('setting.encryption.copied'), 'success')
}

async function handleSecurityKeyCreated() {
  showFeedback(t('setting.encryption.security_key_created'), 'success')
  // 标记已配置 + 重读交叉签名状态由总览 composable 统一完成（与移动端共用同一份收敛逻辑）
  await markSecurityKeyConfigured()
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

.setting-load-error {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  margin-bottom: var(--tjg-space-4);
  padding: var(--tjg-space-3);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
  background: var(--tjg-color-warning-100);
  border: 1px solid color-mix(in srgb, var(--tjg-color-warning-500) 20%, transparent);
  border-radius: var(--tjg-radius-sm);
}

.setting-load-error span {
  flex: 1;
  min-width: 0;
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
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
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

/* R-2 的「私钥存储（4S）」行与其警示样式已抽到 ./sections/CrossSigningSection.vue：
   本文件属 check:file-size 超限文件（baseline 720），棘轮只许缩不许增。 */
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

/* 弹窗宽度 */
.modal-width-400 {
  width: 400px;
}
</style>
