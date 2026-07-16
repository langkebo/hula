<template>
  <van-dialog
    v-model:show="visible"
    :title="dialogTitle"
    :show-cancel-button="false"
    :show-confirm-button="false"
    :close-on-click-overlay="!loading"
    @closed="handleClosed">
    <div class="px-4 py-4">
      <!-- SETUP: intro/create - passphrase input -->
      <div
        v-if="isSetup && (step === 'intro' || step === 'create')"
        class="flex flex-col gap-3"
        data-test="setup-passphrase">
        <van-field
          v-model="passphraseInput"
          type="password"
          :label="t('encryption.security_key.passphrase_input_label')"
          :placeholder="t('encryption.security_key.passphrase_input_placeholder')" />
        <van-button block type="primary" :loading="loading" @click="handleGenerate">
          {{ t('encryption.security_key.start_setup') }}
        </van-button>
      </div>

      <!-- SETUP: showKey - display recovery key -->
      <div v-else-if="isSetup && step === 'showKey'" class="flex flex-col gap-3" data-test="setup-showkey">
        <van-notice-bar type="warning" :text="t('encryption.backup.recovery_key_desc')" />
        <div
          class="recovery-key-box bg-[--van-gray-1] dark:bg-[rgba(255,255,255,0.06)] p-3 rounded font-mono text-sm break-all">
          {{ recoveryKey || t('encryption.backup.recovery_key_title') }}
        </div>
        <van-button block size="small" plain @click="copyKey">
          {{ t('encryption.backup.copy_key') }}
        </van-button>
        <van-button block type="primary" :loading="loading" @click="handleConfirmKeySaved">
          {{ t('encryption.backup.key_saved_confirm') }}
        </van-button>
      </div>

      <!-- SETUP: verify - auto-verifying -->
      <div
        v-else-if="isSetup && step === 'verify'"
        class="flex flex-col items-center gap-3 py-4"
        data-test="setup-verify">
        <van-loading />
        <span>{{ t('encryption.backup.verify_backup') }}</span>
      </div>

      <!-- RESTORE: recovery key input -->
      <div v-else-if="!isSetup" class="flex flex-col gap-3" data-test="restore-input">
        <van-field
          v-model="recoveryKeyInput"
          type="textarea"
          rows="3"
          :label="t('encryption.backup.enter_key')"
          :placeholder="t('encryption.backup.key_placeholder')" />
        <van-button block type="primary" :loading="loading" @click="handleRestore">
          {{ t('encryption.backup.confirm_restore') }}
        </van-button>
      </div>

      <!-- SUCCESS -->
      <div v-else-if="step === 'success'" class="flex flex-col items-center gap-3 py-4" data-test="success">
        <van-icon name="success" size="48" :color="successColor" />
        <span>{{ successMessage }}</span>
        <van-button block @click="visible = false">{{ t('common.done') }}</van-button>
      </div>

      <!-- ERROR -->
      <div v-else-if="step === 'error'" class="flex flex-col items-center gap-3 py-4" data-test="error">
        <van-icon name="warning" size="48" :color="dangerColor" />
        <span class="text-center">{{ errorMessage || t('encryption.backup.failed_desc') }}</span>
        <van-button block @click="visible = false">{{ t('common.close') }}</van-button>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useKeyBackupFlow } from '@/composables/encryption/useKeyBackupFlow'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  mode: 'setup' | 'restore'
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'complete'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const passphraseInput = ref('')
const recoveryKeyInput = ref('')

const {
  step,
  recoveryKey,
  loading,
  errorMessage,
  passphrase,
  isFinished,
  createBackup,
  confirmKeySaved,
  verifyBackup,
  importFromRecoveryKey,
  reset
} = useKeyBackupFlow({ mode: props.mode })

const successColor = 'var(--success-color, #22c55e)'
const dangerColor = 'var(--danger-color, #ef4444)'

const isSetup = computed(() => props.mode === 'setup')

const dialogTitle = computed(() => {
  if (props.mode === 'setup') return t('encryption.keyBackup.setupTitle')
  return t('encryption.keyBackup.restoreTitle')
})

const successMessage = computed(() => {
  if (props.mode === 'setup') return t('encryption.keyBackup.setupComplete')
  return t('encryption.keyBackup.restoreComplete')
})

// When dialog opens, reset finished state and set restore step
watch(visible, (newVal) => {
  if (newVal) {
    if (isFinished.value) {
      reset()
    }
    if (!isSetup.value) {
      step.value = 'restore'
    }
  }
})

async function handleGenerate() {
  passphrase.value = passphraseInput.value
  await createBackup()
}

async function handleConfirmKeySaved() {
  await confirmKeySaved()
  await verifyBackup()
  if (step.value === 'success') {
    emit('complete')
  }
}

async function handleRestore() {
  const input = recoveryKeyInput.value.trim()
  if (!input) {
    showToast(t('setting.encryption.recovery_key_required'))
    return
  }
  await importFromRecoveryKey(input)
  if (step.value === 'success') {
    emit('complete')
  }
}

async function copyKey() {
  if (recoveryKey.value) {
    try {
      await navigator.clipboard.writeText(recoveryKey.value)
      showToast(t('encryption.backup.copy_success'))
    } catch {
      showToast(t('encryption.backup.copy_failed'))
    }
  }
}

function handleClosed() {
  if (!isFinished.value) {
    reset()
  }
}
</script>
