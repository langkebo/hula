<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('encryption.bootstrap.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="false"
    style="width: 580px; max-width: 90vw">
    <n-steps :current="currentStepIndex" class="bootstrap-steps">
      <n-step :title="t('encryption.bootstrap.step_intro')" />
      <n-step :title="t('encryption.bootstrap.step_cross_signing')" />
      <n-step :title="t('encryption.bootstrap.step_key_backup')" />
      <n-step :title="t('encryption.bootstrap.step_secure_backup')" />
      <n-step :title="t('encryption.bootstrap.step_verification')" />
    </n-steps>

    <div class="step-content">
      <!-- Step 1: Introduction -->
      <div v-if="currentStep === 0" class="intro-step">
        <div class="intro-icon">
          <Icon icon="mdi:shield-lock" :width="56" />
        </div>
        <div class="intro-text">
          <h3>{{ t('encryption.bootstrap.intro_title') }}</h3>
          <p>{{ t('encryption.bootstrap.intro_desc') }}</p>
        </div>
        <div class="intro-steps">
          <div class="intro-step-item">
            <Icon icon="mdi:shield-key" :width="20" />
            <div class="intro-step-text">
              <span class="intro-step-label">{{ t('encryption.bootstrap.intro_cross_signing') }}</span>
              <span class="intro-step-desc">{{ t('encryption.bootstrap.intro_cross_signing_desc') }}</span>
            </div>
          </div>
          <div class="intro-step-item">
            <Icon icon="mdi:cloud-upload" :width="20" />
            <div class="intro-step-text">
              <span class="intro-step-label">{{ t('encryption.bootstrap.intro_key_backup') }}</span>
              <span class="intro-step-desc">{{ t('encryption.bootstrap.intro_key_backup_desc') }}</span>
            </div>
          </div>
          <div class="intro-step-item">
            <Icon icon="mdi:lock-check" :width="20" />
            <div class="intro-step-text">
              <span class="intro-step-label">{{ t('encryption.bootstrap.intro_secure_backup') }}</span>
              <span class="intro-step-desc">{{ t('encryption.bootstrap.intro_secure_backup_desc') }}</span>
            </div>
          </div>
          <div class="intro-step-item">
            <Icon icon="mdi:check-decagram" :width="20" />
            <div class="intro-step-text">
              <span class="intro-step-label">{{ t('encryption.bootstrap.intro_verification') }}</span>
              <span class="intro-step-desc">{{ t('encryption.bootstrap.intro_verification_desc') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Cross Signing Setup -->
      <div v-else-if="currentStep === 1" class="setup-step">
        <div v-if="stepLoading" class="progress-text">
          <Icon icon="mdi:loading" :width="24" class="spin-icon" />
          <span>{{ t('encryption.bootstrap.cross_signing_setting_up') }}</span>
        </div>
        <div v-else-if="stepResult === 'success'" class="result-block">
          <n-result status="success" :title="t('encryption.bootstrap.cross_signing_success')" />
        </div>
        <div v-else-if="stepResult === 'error'" class="result-block">
          <n-result status="error" :title="t('encryption.bootstrap.cross_signing_failed')" :description="stepError" />
          <n-button size="small" @click="retryStep">{{ t('encryption.bootstrap.retry') }}</n-button>
        </div>
        <template v-else>
          <n-alert type="info" :show-icon="true" class="step-alert">
            {{ t('encryption.bootstrap.cross_signing_info') }}
          </n-alert>
          <div class="password-field">
            <div class="password-label">{{ t('setting.account.current_password') }}</div>
            <n-input
              v-model:value="currentPassword"
              type="password"
              show-password-on="click"
              :placeholder="t('setting.account.current_password_placeholder')" />
          </div>
        </template>
      </div>

      <!-- Step 3: Key Backup Setup -->
      <div v-else-if="currentStep === 2" class="setup-step">
        <div v-if="stepLoading" class="progress-text">
          <Icon icon="mdi:loading" :width="24" class="spin-icon" />
          <span>{{ t('encryption.bootstrap.key_backup_setting_up') }}</span>
        </div>
        <div v-else-if="stepResult === 'success'" class="result-block">
          <n-result status="success" :title="t('encryption.bootstrap.key_backup_success')" />
        </div>
        <div v-else-if="stepResult === 'error'" class="result-block">
          <n-result status="error" :title="t('encryption.bootstrap.key_backup_failed')" :description="stepError" />
          <n-button size="small" @click="retryStep">{{ t('encryption.bootstrap.retry') }}</n-button>
        </div>
        <template v-else>
          <n-alert type="info" :show-icon="true" class="step-alert">
            {{ t('encryption.bootstrap.key_backup_info') }}
          </n-alert>
        </template>
      </div>

      <!-- Step 4: Secure Backup Setup -->
      <div v-else-if="currentStep === 3" class="setup-step">
        <div v-if="stepLoading" class="progress-text">
          <Icon icon="mdi:loading" :width="24" class="spin-icon" />
          <span>{{ t('encryption.bootstrap.secure_backup_setting_up') }}</span>
        </div>
        <div v-else-if="stepResult === 'success'" class="result-block">
          <n-result status="success" :title="t('encryption.bootstrap.secure_backup_success')" />
        </div>
        <div v-else-if="stepResult === 'error'" class="result-block">
          <n-result status="error" :title="t('encryption.bootstrap.secure_backup_failed')" :description="stepError" />
          <n-button size="small" @click="retryStep">{{ t('encryption.bootstrap.retry') }}</n-button>
        </div>
        <template v-else>
          <n-alert type="info" :show-icon="true" class="step-alert">
            {{ t('encryption.bootstrap.secure_backup_info') }}
          </n-alert>
        </template>
      </div>

      <!-- Step 5: Verification -->
      <div v-else-if="currentStep === 4" class="setup-step">
        <div v-if="stepLoading" class="progress-text">
          <Icon icon="mdi:loading" :width="24" class="spin-icon" />
          <span>{{ t('encryption.bootstrap.verifying') }}</span>
        </div>
        <div v-else-if="stepResult === 'success'" class="result-block">
          <n-result status="success" :title="t('encryption.bootstrap.verification_success')">
            <template #footer>
              <div class="verification-summary">
                <n-descriptions label-placement="left" :column="1" size="small" bordered>
                  <n-descriptions-item :label="t('encryption.bootstrap.cross_signing_label')">
                    <n-tag type="success" size="small">{{ t('encryption.bootstrap.status_ready') }}</n-tag>
                  </n-descriptions-item>
                  <n-descriptions-item :label="t('encryption.bootstrap.key_backup_label')">
                    <n-tag type="success" size="small">{{ t('encryption.bootstrap.status_ready') }}</n-tag>
                  </n-descriptions-item>
                  <n-descriptions-item :label="t('encryption.bootstrap.secure_backup_label')">
                    <n-tag type="success" size="small">{{ t('encryption.bootstrap.status_ready') }}</n-tag>
                  </n-descriptions-item>
                </n-descriptions>
              </div>
            </template>
          </n-result>
        </div>
        <div v-else-if="stepResult === 'error'" class="result-block">
          <n-result status="warning" :title="t('encryption.bootstrap.verification_partial')" :description="stepError" />
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <n-button v-if="currentStep > 0 && stepResult !== 'success'" @click="handleBack">
          {{ t('common.back') }}
        </n-button>
        <n-button v-if="currentStep === 0" @click="handleSkip">
          {{ t('encryption.bootstrap.skip') }}
        </n-button>
        <n-button v-if="canProceed" type="primary" @click="handleNext">
          {{ getNextButtonLabel }}
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
  NDescriptions,
  NDescriptionsItem,
  NInput,
  NModal,
  NResult,
  NStep,
  NSteps,
  NTag
} from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { cryptoSDKAdapter } from '@/services/matrix/crypto/CryptoSDKAdapter'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { matrixE2EEBootstrapService } from '@/services/matrix/crypto/MatrixE2EEBootstrapService'
import type { GeneratedSecretStorageKey } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('E2EEBootstrapWizard')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'complete'): void
  (e: 'skip'): void
}>()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

const currentStep = ref(0)
const currentStepIndex = computed(() => currentStep.value + 1)
const stepLoading = ref(false)
const stepResult = ref<'idle' | 'success' | 'error'>('idle')
const stepError = ref('')
const currentPassword = ref('')
const generatedRecoveryKey = ref<GeneratedSecretStorageKey | null>(null)

const canProceed = computed(() => {
  if (currentStep.value === 0) return true
  if (stepResult.value === 'success') return true
  if (currentStep.value === 1 && stepResult.value === 'idle' && currentPassword.value.trim()) return true
  if (currentStep.value === 2 && stepResult.value === 'idle') return true
  if (currentStep.value === 3 && stepResult.value === 'idle') return true
  return false
})

const getNextButtonLabel = computed(() => {
  if (currentStep.value === 0) return t('encryption.bootstrap.start')
  if (stepResult.value === 'success' && currentStep.value === 4) return t('encryption.bootstrap.complete')
  if (stepResult.value === 'success') return t('encryption.bootstrap.next')
  if (currentStep.value === 1) return t('encryption.bootstrap.setup_cross_signing')
  if (currentStep.value === 2) return t('encryption.bootstrap.setup_key_backup')
  if (currentStep.value === 3) return t('encryption.bootstrap.setup_secure_backup')
  return t('encryption.bootstrap.next')
})

function resetState() {
  currentStep.value = 0
  stepLoading.value = false
  stepResult.value = 'idle'
  stepError.value = ''
  currentPassword.value = ''
  generatedRecoveryKey.value = null
}

function resetStepState() {
  stepLoading.value = false
  stepResult.value = 'idle'
  stepError.value = ''
}

function handleSkip() {
  visible.value = false
  resetState()
  emit('skip')
}

function handleBack() {
  if (currentStep.value > 0) {
    currentStep.value--
    resetStepState()
  }
}

async function handleNext() {
  if (currentStep.value === 0) {
    currentStep.value = 1
    resetStepState()
    return
  }

  if (stepResult.value === 'success') {
    if (currentStep.value === 4) {
      visible.value = false
      resetState()
      emit('complete')
      return
    }
    currentStep.value++
    resetStepState()
    if (currentStep.value === 4) {
      await runVerification()
    }
    return
  }

  // Execute current step action
  if (currentStep.value === 1) {
    await runCrossSigningSetup()
  } else if (currentStep.value === 2) {
    await runKeyBackupSetup()
  } else if (currentStep.value === 3) {
    await runSecureBackupSetup()
  }
}

async function retryStep() {
  resetStepState()
  if (currentStep.value === 1) {
    await runCrossSigningSetup()
  } else if (currentStep.value === 2) {
    await runKeyBackupSetup()
  } else if (currentStep.value === 3) {
    await runSecureBackupSetup()
  } else if (currentStep.value === 4) {
    await runVerification()
  }
}

async function runCrossSigningSetup() {
  stepLoading.value = true
  stepResult.value = 'idle'
  stepError.value = ''
  try {
    await cryptoSDKAdapter.setupCrossSigning({ password: currentPassword.value.trim() })
    stepResult.value = 'success'
    showFeedback(t('encryption.bootstrap.cross_signing_success'), 'success')
  } catch (err: unknown) {
    logger.error('Cross signing setup failed:', err)
    stepError.value = err instanceof Error ? err.message : String(err)
    stepResult.value = 'error'
    showFeedback(t('encryption.bootstrap.cross_signing_failed'), 'error')
  } finally {
    stepLoading.value = false
  }
}

async function runKeyBackupSetup() {
  stepLoading.value = true
  stepResult.value = 'idle'
  stepError.value = ''
  try {
    // Generate recovery key for key backup
    const recoveryKeyResult = await matrixCryptoService.createRecoveryKeyFromPassphrase()
    if (recoveryKeyResult) {
      generatedRecoveryKey.value = recoveryKeyResult
    }
    await cryptoSDKAdapter.setupKeyBackupWithOptions({
      password: currentPassword.value.trim(),
      generatedKey: generatedRecoveryKey.value
    })
    stepResult.value = 'success'
    showFeedback(t('encryption.bootstrap.key_backup_success'), 'success')
  } catch (err: unknown) {
    logger.error('Key backup setup failed:', err)
    stepError.value = err instanceof Error ? err.message : String(err)
    stepResult.value = 'error'
    showFeedback(t('encryption.bootstrap.key_backup_failed'), 'error')
  } finally {
    stepLoading.value = false
  }
}

async function runSecureBackupSetup() {
  stepLoading.value = true
  stepResult.value = 'idle'
  stepError.value = ''
  try {
    await matrixCryptoService.createSecureBackup(currentPassword.value.trim())
    stepResult.value = 'success'
    showFeedback(t('encryption.bootstrap.secure_backup_success'), 'success')
  } catch (err: unknown) {
    logger.error('Secure backup setup failed:', err)
    stepError.value = err instanceof Error ? err.message : String(err)
    stepResult.value = 'error'
    showFeedback(t('encryption.bootstrap.secure_backup_failed'), 'error')
  } finally {
    stepLoading.value = false
  }
}

async function runVerification() {
  stepLoading.value = true
  stepResult.value = 'idle'
  stepError.value = ''
  try {
    const status = await matrixE2EEBootstrapService.getE2EESettingsStatus()
    if (status.isCrossSigningReady && status.isKeyBackupEnabled) {
      stepResult.value = 'success'
    } else {
      const missing: string[] = []
      if (!status.isCrossSigningReady) missing.push(t('encryption.bootstrap.cross_signing_label'))
      if (!status.isKeyBackupEnabled) missing.push(t('encryption.bootstrap.key_backup_label'))
      stepError.value = t('encryption.bootstrap.verification_missing', { items: missing.join(', ') })
      stepResult.value = 'error'
    }
  } catch (err: unknown) {
    logger.error('Verification failed:', err)
    stepError.value = err instanceof Error ? err.message : String(err)
    stepResult.value = 'error'
  } finally {
    stepLoading.value = false
  }
}

watch(
  () => props.show,
  (val) => {
    if (!val) {
      resetState()
    }
  }
)
</script>

<style scoped lang="scss">
.bootstrap-steps {
  margin-bottom: 24px;
}

.step-content {
  min-height: 200px;
}

.intro-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.intro-icon {
  color: var(--color-primary);
}

.intro-text {
  text-align: center;

  h3 {
    margin: 0 0 8px 0;
    font-size: 18px;
    font-weight: 500;
  }

  p {
    margin: 0;
    color: var(--hula-text-secondary);
    font-size: 14px;
    line-height: 1.6;
  }
}

.intro-steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.intro-step-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: var(--hula-surface-panel-muted);
  border-radius: 8px;
}

.intro-step-text {
  display: flex;
  flex-direction: column;
}

.intro-step-label {
  font-size: 14px;
  font-weight: 500;
}

.intro-step-desc {
  font-size: 12px;
  color: var(--hula-text-secondary);
  margin-top: 2px;
}

.setup-step {
  padding: 8px 0;
}

.step-alert {
  margin-bottom: 16px;
}

.password-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.password-label {
  font-size: 14px;
  font-weight: 500;
}

.progress-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 0;
  font-size: 14px;
  color: var(--hula-text-secondary);
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.result-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.verification-summary {
  width: 100%;
  max-width: 360px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
