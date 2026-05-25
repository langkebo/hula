<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('encryption.onboarding.title')"
    :bordered="false"
    :closable="true"
    :mask-closable="false"
    class="e2ee-onboarding-dialog"
    style="width: 540px; max-width: 90vw">
    <n-spin :show="loading">
      <div v-if="currentStep === 'welcome'" class="step-content">
        <div class="welcome-icon">
          <Icon icon="mdi:shield-check" :width="64" />
        </div>
        <div class="welcome-text">
          <h3>{{ t('encryption.onboarding.welcome_title') }}</h3>
          <p>{{ t('encryption.onboarding.welcome_desc') }}</p>
        </div>
        <div class="step-list">
          <div class="step-item">
            <Icon icon="mdi:key-variant" :width="20" />
            <div class="step-item-text">
              <span class="step-item-label">{{ t('encryption.onboarding.step_security_key') }}</span>
              <span class="step-item-desc">{{ t('encryption.onboarding.step_security_key_desc') }}</span>
            </div>
          </div>
          <div class="step-item">
            <Icon icon="mdi:shield-key" :width="20" />
            <div class="step-item-text">
              <span class="step-item-label">{{ t('encryption.onboarding.step_cross_signing') }}</span>
              <span class="step-item-desc">{{ t('encryption.onboarding.step_cross_signing_desc') }}</span>
            </div>
          </div>
          <div class="step-item">
            <Icon icon="mdi:cloud-upload" :width="20" />
            <div class="step-item-text">
              <span class="step-item-label">{{ t('encryption.onboarding.step_key_backup') }}</span>
              <span class="step-item-desc">{{ t('encryption.onboarding.step_key_backup_desc') }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="currentStep === 'securityKey'" class="step-content">
        <div v-if="!recoveryKey" class="progress-text">
          <Icon icon="mdi:loading" :width="24" class="spin-icon" />
          <span>{{ t('encryption.onboarding.generating_key') }}</span>
        </div>
        <template v-else>
          <div class="key-display">
            <div class="key-label">{{ t('encryption.onboarding.recovery_key') }}</div>
            <div class="key-value">{{ recoveryKey }}</div>
            <div class="key-actions">
              <n-button size="small" @click="copyKey">
                <template #icon><Icon icon="mdi:content-copy" :width="16" /></template>
                {{ t('encryption.onboarding.copy_key') }}
              </n-button>
              <n-button size="small" @click="downloadKey">
                <template #icon><Icon icon="mdi:download" :width="16" /></template>
                {{ t('encryption.onboarding.download_key') }}
              </n-button>
            </div>
          </div>
          <div class="key-warning">
            <Icon icon="mdi:alert-circle" :width="20" />
            <span>{{ t('encryption.onboarding.key_warning') }}</span>
          </div>
          <n-checkbox v-model:checked="keySaved" class="key-checkbox">
            {{ t('encryption.onboarding.key_saved_confirm') }}
          </n-checkbox>
        </template>
      </div>

      <div v-else-if="currentStep === 'crossSigning'" class="step-content">
        <div v-if="crossSigningLoading" class="progress-text">
          <Icon icon="mdi:loading" :width="24" class="spin-icon" />
          <span>{{ t('encryption.onboarding.setting_up_cross_signing') }}</span>
        </div>
        <div v-else-if="crossSigningDone" class="success-icon">
          <Icon icon="mdi:check-circle" :width="48" class="success-color" />
          <span class="progress-text">{{ t('encryption.onboarding.cross_signing_done') }}</span>
        </div>
        <div v-else-if="crossSigningError" class="error-text">
          <Icon icon="mdi:alert-circle" :width="24" class="error-color" />
          <span>{{ crossSigningError }}</span>
        </div>
      </div>

      <div v-else-if="currentStep === 'backup'" class="step-content">
        <div v-if="backupLoading" class="progress-text">
          <Icon icon="mdi:loading" :width="24" class="spin-icon" />
          <span>{{ t('encryption.onboarding.setting_up_backup') }}</span>
        </div>
        <div v-else-if="backupDone" class="success-icon">
          <Icon icon="mdi:check-circle" :width="48" class="success-color" />
          <span class="progress-text">{{ t('encryption.onboarding.backup_done') }}</span>
        </div>
        <div v-else-if="backupError" class="error-text">
          <Icon icon="mdi:alert-circle" :width="24" class="error-color" />
          <span>{{ backupError }}</span>
        </div>
      </div>
    </n-spin>

    <template #footer>
      <div class="dialog-footer">
        <n-button v-if="currentStep === 'welcome'" @click="handleSkip">
          {{ t('encryption.onboarding.skip') }}
        </n-button>
        <n-button v-if="currentStep !== 'welcome'" @click="handleBack">
          {{ t('common.back') }}
        </n-button>
        <n-button v-if="currentStep === 'welcome'" type="primary" @click="handleStart">
          {{ t('encryption.onboarding.start_setup') }}
        </n-button>
        <n-button v-if="currentStep === 'securityKey'" type="primary" :disabled="!keySaved" @click="handleNext">
          {{ t('encryption.onboarding.next') }}
        </n-button>
        <n-button v-if="currentStep === 'crossSigning' && crossSigningDone" type="primary" @click="handleNext">
          {{ t('encryption.onboarding.next') }}
        </n-button>
        <n-button v-if="currentStep === 'backup' && backupDone" type="primary" @click="handleComplete">
          {{ t('encryption.onboarding.complete') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NCheckbox, NModal, NSpin } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('E2EEOnboarding')
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

type Step = 'welcome' | 'securityKey' | 'crossSigning' | 'backup'
const currentStep = ref<Step>('welcome')
const loading = ref(false)
const recoveryKey = ref('')
const keySaved = ref(false)
const crossSigningLoading = ref(false)
const crossSigningDone = ref(false)
const crossSigningError = ref('')
const backupLoading = ref(false)
const backupDone = ref(false)
const backupError = ref('')

function generatePassphrase(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
}

function resetState() {
  currentStep.value = 'welcome'
  recoveryKey.value = ''
  keySaved.value = false
  crossSigningLoading.value = false
  crossSigningDone.value = false
  crossSigningError.value = ''
  backupLoading.value = false
  backupDone.value = false
  backupError.value = ''
  loading.value = false
}

function handleSkip() {
  visible.value = false
  resetState()
  emit('skip')
}

async function handleStart() {
  currentStep.value = 'securityKey'
  loading.value = true
  try {
    await matrixClientService.waitForClientReady({ timeoutMs: 10000 })
    const passphrase = generatePassphrase()
    const result = await matrixCryptoService.createSecureBackup(passphrase)
    if (result) {
      recoveryKey.value = result.version ?? result.backup_id
    }
  } catch (err) {
    logger.error('Failed to create secure backup:', err)
    showFeedback(t('encryption.onboarding.generate_key_failed'), 'error')
    currentStep.value = 'welcome'
  } finally {
    loading.value = false
  }
}

function copyKey() {
  navigator.clipboard
    .writeText(recoveryKey.value)
    .then(() => showFeedback(t('encryption.onboarding.copy_success'), 'success'))
    .catch(() => showFeedback(t('encryption.onboarding.copy_failed'), 'error'))
}

function downloadKey() {
  const blob = new Blob([recoveryKey.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hula-recovery-key-${Date.now()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showFeedback(t('encryption.onboarding.download_success'), 'success')
}

async function handleNext() {
  if (currentStep.value === 'securityKey') {
    currentStep.value = 'crossSigning'
    await setupCrossSigning()
  } else if (currentStep.value === 'crossSigning') {
    currentStep.value = 'backup'
    await setupBackup()
  }
}

function handleBack() {
  if (currentStep.value === 'securityKey') {
    currentStep.value = 'welcome'
    resetState()
  } else if (currentStep.value === 'crossSigning') {
    currentStep.value = 'securityKey'
  } else if (currentStep.value === 'backup') {
    currentStep.value = 'crossSigning'
  }
}

async function setupCrossSigning() {
  crossSigningLoading.value = true
  crossSigningDone.value = false
  crossSigningError.value = ''
  try {
    await matrixEncryptionService.setupCrossSigning()
    crossSigningDone.value = true
  } catch (err: unknown) {
    logger.error('Failed to setup cross-signing:', err)
    const errorMessage = err instanceof Error ? err.message : t('encryption.onboarding.cross_signing_failed')
    crossSigningError.value = errorMessage
    showFeedback(t('encryption.onboarding.cross_signing_failed'), 'error')
  } finally {
    crossSigningLoading.value = false
  }
}

async function setupBackup() {
  backupLoading.value = true
  backupDone.value = false
  backupError.value = ''
  try {
    await matrixEncryptionService.setupKeyBackup()
    backupDone.value = true
  } catch (err: unknown) {
    logger.error('Failed to setup key backup:', err)
    const errorMessage = err instanceof Error ? err.message : t('encryption.onboarding.backup_failed')
    backupError.value = errorMessage
    showFeedback(t('encryption.onboarding.backup_failed'), 'error')
  } finally {
    backupLoading.value = false
  }
}

function handleComplete() {
  visible.value = false
  resetState()
  emit('complete')
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
.e2ee-onboarding-dialog {
  :deep(.n-card-header) {
    padding: 16px 20px;
  }

  :deep(.n-card__content) {
    padding: 16px 20px;
  }

  :deep(.n-card__footer) {
    padding: 12px 20px;
    border-top: 1px solid var(--hula-border-default);
  }
}

.step-content {
  padding: 16px 0;
}

.welcome-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  color: var(--color-primary);
}

.welcome-text {
  text-align: center;
  margin-bottom: 24px;

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

.step-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--hula-surface-panel-muted);
  border-radius: 8px;
}

.step-item-text {
  display: flex;
  flex-direction: column;
}

.step-item-label {
  font-size: 14px;
  font-weight: 500;
}

.step-item-desc {
  font-size: 12px;
  color: var(--hula-text-secondary);
  margin-top: 2px;
}

.key-display {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

:deep(.dark) .key-display {
  background-color: rgba(255, 255, 255, 0.05);
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
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
  margin-bottom: 12px;
}

:deep(.dark) .key-value {
  background-color: rgba(255, 255, 255, 0.05);
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
  font-size: 13px;
}

.key-checkbox {
  margin-bottom: 16px;
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

.success-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 0;
}

.success-color {
  color: var(--color-success);
}

.error-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0;
  font-size: 14px;
  color: var(--color-danger);
}

.error-color {
  color: var(--color-danger);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
