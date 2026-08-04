<template>
  <n-modal v-model:show="visible" preset="card" :title="dialogTitle" style="width: 500px" :mask-closable="false">
    <n-spin :show="loading">
      <!-- Step: Intro - choose method -->
      <div v-if="step === 'intro'" class="step-content">
        <div class="intro-icon">
          <Icon icon="mdi:shield-lock" :width="64" />
        </div>
        <div class="intro-text">
          <p>{{ t('encryption.security_key.intro_primary') }}</p>
          <p class="warning-text">{{ t('encryption.security_key.intro_warning') }}</p>
        </div>
        <div class="intro-actions">
          <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="startSetup('generate')">
            {{ t('encryption.security_key.start_setup') }}
          </n-button>
          <n-button @click="step = 'passphrase'">
            {{ t('encryption.security_key.use_passphrase') }}
          </n-button>
        </div>
      </div>

      <!-- Step: Passphrase input -->
      <div v-else-if="step === 'passphrase'" class="step-content">
        <div class="passphrase-desc">
          <p>{{ t('encryption.security_key.passphrase_desc') }}</p>
        </div>
        <n-form ref="passphraseFormRef" :model="passphraseForm" :rules="passphraseRules">
          <n-form-item path="passphrase" :label="t('encryption.security_key.passphrase_input_label')">
            <n-input
              v-model:value="passphraseForm.passphrase"
              type="password"
              :placeholder="t('encryption.security_key.passphrase_input_placeholder')"
              show-password-on="click" />
          </n-form-item>
          <n-form-item path="confirmPassphrase" :label="t('encryption.security_key.passphrase_confirm_label')">
            <n-input
              v-model:value="passphraseForm.confirmPassphrase"
              type="password"
              :placeholder="t('encryption.security_key.passphrase_confirm_placeholder')"
              show-password-on="click" />
          </n-form-item>
        </n-form>
        <div class="step-actions">
          <n-button @click="step = 'intro'">{{ t('common.back') }}</n-button>
          <n-button
            type="primary"
            :disabled="!passphraseForm.passphrase || !passphraseForm.confirmPassphrase"
            @click="startSetup('passphrase')">
            {{ t('encryption.security_key.use_passphrase') }}
          </n-button>
        </div>
      </div>

      <!-- Step: Generating -->
      <div v-else-if="step === 'generating'" class="step-content">
        <div class="create-info">
          <Icon icon="mdi:key-chain" :width="48" />
          <p>{{ t('encryption.security_key.generating') }}</p>
        </div>
      </div>

      <!-- Step: Show generated key (only for 'generate' mode) -->
      <div v-else-if="step === 'showKey'" class="step-content">
        <div class="key-display">
          <div class="key-label">{{ t('encryption.security_key.your_recovery_key') }}</div>
          <div class="key-value">{{ formattedRecoveryKey }}</div>
          <div class="key-actions">
            <n-button size="small" @click="copyKey">
              <template #icon><Icon icon="mdi:content-copy" :width="16" /></template>
              {{ t('encryption.security_key.copy_key') }}
            </n-button>
            <n-button size="small" @click="downloadKey">
              <template #icon><Icon icon="mdi:download" :width="16" /></template>
              {{ t('encryption.security_key.download_key') }}
            </n-button>
          </div>
        </div>
        <div class="key-warning">
          <Icon icon="mdi:alert-circle" :width="20" />
          <span>{{ t('encryption.security_key.key_warning') }}</span>
        </div>
        <n-checkbox v-model:checked="keySaved" class="key-checkbox">
          {{ t('encryption.security_key.key_saved_confirm') }}
        </n-checkbox>
        <div class="step-actions">
          <n-button @click="step = 'intro'">{{ t('common.back') }}</n-button>
          <n-button type="primary" :disabled="!keySaved" @click="step = 'verify'">
            {{ t('encryption.security_key.next_step') }}
          </n-button>
        </div>
      </div>

      <!-- Step: Verify -->
      <div v-else-if="step === 'verify'" class="step-content">
        <div class="verify-info">
          <p>
            {{
              isPassphraseMode
                ? t('encryption.security_key.verify_passphrase_prompt')
                : t('encryption.security_key.verify_prompt')
            }}
          </p>
        </div>
        <n-input
          v-model:value="verifyKeyInput"
          :type="isPassphraseMode ? 'password' : 'textarea'"
          :placeholder="
            isPassphraseMode
              ? t('encryption.security_key.passphrase_placeholder')
              : t('encryption.security_key.key_placeholder')
          "
          :rows="isPassphraseMode ? 1 : 3"
          class="verify-input" />
        <div class="step-actions">
          <n-button @click="step = isPassphraseMode ? 'passphrase' : 'showKey'">{{ t('common.back') }}</n-button>
          <n-button type="primary" :disabled="!verifyKeyInput.trim()" @click="verifyKey">
            {{ t('encryption.security_key.verify_key') }}
          </n-button>
        </div>
      </div>

      <!-- Step: Success -->
      <div v-else-if="step === 'success'" class="step-content">
        <div class="success-icon">
          <Icon icon="mdi:check-circle" :width="64" class="success-color" />
        </div>
        <div class="success-text">
          <h3>{{ t('encryption.security_key.success_title') }}</h3>
        </div>
        <div class="step-actions">
          <n-button type="primary" @click="handleClose">{{ t('common.close') }}</n-button>
        </div>
      </div>
    </n-spin>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NCheckbox, NForm, NFormItem, NInput, NModal, NSpin } from 'naive-ui'
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixCryptoService } from '@/services/matrix/crypto/MatrixCryptoService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecurityKeySetup')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

defineOptions({
  name: 'SecurityKeySetupDialog'
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

type Step = 'intro' | 'passphrase' | 'generating' | 'showKey' | 'verify' | 'success'
type SetupMode = 'generate' | 'passphrase'

const step = ref<Step>('intro')
const setupMode = ref<SetupMode>('generate')
const loading = ref(false)
const recoveryKey = ref('')
const keySaved = ref(false)
const verifyKeyInput = ref('')

const passphraseForm = reactive({
  passphrase: '',
  confirmPassphrase: ''
})

const passphraseRules = {
  passphrase: {
    required: true,
    min: 8,
    message: t('encryption.security_key.passphrase_too_short'),
    trigger: 'blur'
  },
  confirmPassphrase: {
    required: true,
    validator: (_rule: unknown, value: string) => {
      if (value !== passphraseForm.passphrase) {
        return new Error(t('encryption.security_key.passphrase_mismatch'))
      }
      return true
    },
    trigger: 'blur'
  }
}

const isPassphraseMode = computed(() => setupMode.value === 'passphrase')

const dialogTitle = computed(() => {
  switch (step.value) {
    case 'intro':
      return t('encryption.security_key.dialog_title_intro')
    case 'passphrase':
      return t('encryption.security_key.use_passphrase')
    case 'generating':
      return t('encryption.security_key.dialog_title_generating')
    case 'showKey':
      return t('encryption.security_key.dialog_title_show_key')
    case 'verify':
      return t('encryption.security_key.dialog_title_verify')
    case 'success':
      return t('encryption.security_key.dialog_title_success')
    default:
      return t('encryption.security_key.dialog_title_intro')
  }
})

const formattedRecoveryKey = computed(() => {
  if (!recoveryKey.value) return ''
  return recoveryKey.value.match(/.{1,4}/g)?.join(' ') ?? recoveryKey.value
})

function handleCancel() {
  visible.value = false
  resetState()
}

function handleClose() {
  visible.value = false
  resetState()
  emit('success')
}

function resetState() {
  step.value = 'intro'
  setupMode.value = 'generate'
  recoveryKey.value = ''
  keySaved.value = false
  verifyKeyInput.value = ''
  passphraseForm.passphrase = ''
  passphraseForm.confirmPassphrase = ''
  loading.value = false
}

async function startSetup(mode: SetupMode) {
  setupMode.value = mode

  // Validate passphrase mode input
  if (mode === 'passphrase') {
    if (passphraseForm.passphrase.length < 8) {
      showFeedback(t('encryption.security_key.passphrase_too_short'), 'error')
      return
    }
    if (passphraseForm.passphrase !== passphraseForm.confirmPassphrase) {
      showFeedback(t('encryption.security_key.passphrase_mismatch'), 'error')
      return
    }
  }

  loading.value = true
  step.value = 'generating'

  try {
    await matrixClientService.waitForClientReady({ timeoutMs: 10000 })

    // Use standard Matrix SSSS: createRecoveryKeyFromPassphrase
    // This handles PBKDF2 key derivation on the client side (spec-compliant)
    const password = mode === 'passphrase' ? passphraseForm.passphrase : undefined
    const recoveryKeyResult = await matrixCryptoService.createRecoveryKeyFromPassphrase(password)

    if (recoveryKeyResult) {
      recoveryKey.value = recoveryKeyResult.encodedPrivateKey
      if (mode === 'passphrase') {
        // For passphrase mode, skip showing the key and go directly to verify
        step.value = 'verify'
      } else {
        step.value = 'showKey'
      }
    } else {
      showFeedback(t('encryption.security_key.create_failed'), 'error')
      step.value = mode === 'passphrase' ? 'passphrase' : 'intro'
    }
  } catch (error) {
    logger.error('Failed to create security key:', error instanceof Error ? error.message : String(error))
    showFeedback(t('encryption.security_key.create_failed'), 'error')
    step.value = mode === 'passphrase' ? 'passphrase' : 'intro'
  } finally {
    loading.value = false
  }
}

function copyKey() {
  navigator.clipboard
    .writeText(recoveryKey.value)
    .then(() => showFeedback(t('encryption.security_key.copy_success'), 'success'))
    .catch(() => showFeedback(t('encryption.security_key.copy_failed'), 'error'))
}

function downloadKey() {
  const blob = new Blob([recoveryKey.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tjg-security-key-${Date.now()}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showFeedback(t('encryption.security_key.download_success'), 'success')
}

async function verifyKey() {
  const normalizedInput = verifyKeyInput.value.replace(/\s/g, '')
  const normalizedOriginal = recoveryKey.value.replace(/\s/g, '')

  if (normalizedInput !== normalizedOriginal) {
    showFeedback(t('encryption.security_key.key_mismatch'), 'error')
    return
  }

  step.value = 'success'
  showFeedback(t('encryption.security_key.verify_success'), 'success')
}
</script>

<style scoped>
.step-content {
  padding: 16px 0;
}

.intro-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  color: var(--tjg-color-primary-500);
}

.intro-text {
  text-align: center;
  margin-bottom: 24px;
}

.intro-text p {
  margin: 8px 0;
  color: var(--tjg-text-primary);
}

.warning-text {
  color: var(--color-warning) !important;
  font-weight: 500;
}

.intro-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.passphrase-desc {
  margin-bottom: 16px;
  color: var(--tjg-text-secondary);
  font-size: 14px;
}

.create-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 0;
}

.key-display {
  background-color: var(--tjg-encryption-surface-subtle);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

:deep(.dark) .key-display {
  background-color: var(--tjg-encryption-surface-dark);
}

.key-label {
  font-size: 14px;
  color: var(--color-text-quaternary);
  margin-bottom: 8px;
}

.key-value {
  font-family: monospace;
  font-size: 16px;
  word-break: break-all;
  line-height: 1.8;
  padding: 12px;
  background-color: var(--tjg-encryption-surface-subtle);
  border-radius: 4px;
  margin-bottom: 12px;
  letter-spacing: 1px;
}

:deep(.dark) .key-value {
  background-color: var(--tjg-encryption-surface-dark);
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

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.verify-info {
  margin-bottom: 16px;
}

.verify-input {
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
</style>
