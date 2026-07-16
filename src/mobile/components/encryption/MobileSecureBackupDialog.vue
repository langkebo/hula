<template>
  <van-dialog
    v-model:show="visible"
    :title="t('mobile_security.secure_backup.title')"
    :show-cancel-button="false"
    :show-confirm-button="false"
    :close-on-click-overlay="!loading"
    @closed="handleClosed">
    <div class="px-4 py-4">
      <!-- MENU: Choose create or restore -->
      <div v-if="phase === 'status' && localStep === 'menu'" class="flex flex-col gap-3">
        <van-button block type="primary" @click="localStep = 'create-input'">
          {{ t('mobile_security.secure_backup.create') }}
        </van-button>
        <van-button block plain @click="localStep = 'restore-input'">
          {{ t('mobile_security.secure_backup.restore') }}
        </van-button>
      </div>

      <!-- CREATE: passphrase input -->
      <div v-else-if="phase === 'status' && localStep === 'create-input'" class="flex flex-col gap-3">
        <van-field
          v-model="passphraseInput"
          type="password"
          :label="t('mobile_security.secure_backup.enter_passphrase')"
          :placeholder="t('mobile_security.secure_backup.passphrase_placeholder')" />
        <van-button block type="primary" :loading="loading" @click="handleCreate">
          {{ t('mobile_security.secure_backup.create') }}
        </van-button>
        <van-button block plain @click="localStep = 'menu'">
          {{ t('common.back') }}
        </van-button>
      </div>

      <!-- CREATING: loading -->
      <div v-else-if="phase === 'create'" class="flex flex-col items-center gap-3 py-4">
        <van-loading />
        <span>{{ t('mobile_security.secure_backup.generating') }}</span>
      </div>

      <!-- RESTORE: recovery key input -->
      <div v-else-if="phase === 'status' && localStep === 'restore-input'" class="flex flex-col gap-3">
        <van-field
          v-model="recoveryKeyInput"
          type="textarea"
          rows="3"
          :label="t('mobile_security.secure_backup.enter_recovery_key')"
          :placeholder="t('mobile_security.secure_backup.recovery_key_placeholder')" />
        <van-button block type="primary" :loading="loading" @click="handleRestore">
          {{ t('mobile_security.secure_backup.restore') }}
        </van-button>
        <van-button block plain @click="localStep = 'menu'">
          {{ t('common.back') }}
        </van-button>
      </div>

      <!-- RESTORE: loading -->
      <div v-else-if="phase === 'restore'" class="flex flex-col items-center gap-3 py-4">
        <van-loading />
        <span>{{ t('mobile_security.secure_backup.restoring') }}</span>
      </div>

      <!-- SUCCESS -->
      <div v-else-if="phase === 'success'" class="flex flex-col items-center gap-3 py-4">
        <van-icon name="success" size="48" color="var(--success-color, #22c55e)" />
        <span>{{ successMessage }}</span>
        <van-button block @click="handleDone">{{ t('common.done') }}</van-button>
      </div>

      <!-- ERROR -->
      <div v-else-if="phase === 'error'" class="flex flex-col items-center gap-3 py-4">
        <van-icon name="warning" size="48" color="var(--danger-color, #ef4444)" />
        <span class="text-center">{{ displayError }}</span>
        <van-button block @click="handleRetry">{{ t('common.retry') }}</van-button>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSecureBackupFlow } from '@/composables/encryption/useSecureBackupFlow'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'complete'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const localStep = ref<'menu' | 'create-input' | 'restore-input'>('menu')
const passphraseInput = ref('')
const recoveryKeyInput = ref('')

const { phase, loading, errorMessage, passphrase, isActive, createSecureBackup, restoreFromSecureBackup, reset } =
  useSecureBackupFlow()

const successMessage = computed(() => {
  if (localStepBeforeAction.value === 'create-input') {
    return t('mobile_security.secure_backup.create_success')
  }
  return t('mobile_security.secure_backup.restore_success', { count: 0 })
})

const displayError = computed(() => {
  return errorMessage.value || t('mobile_security.secure_backup.create_failed')
})

// Track which step was active before the action started, for success message
const localStepBeforeAction = ref<'menu' | 'create-input' | 'restore-input'>('menu')

// Reset state when dialog opens
watch(visible, (newVal) => {
  if (newVal) {
    localStep.value = 'menu'
    passphraseInput.value = ''
    recoveryKeyInput.value = ''
    reset()
  }
})

async function handleCreate() {
  passphrase.value = passphraseInput.value
  localStepBeforeAction.value = 'create-input'
  const ok = await createSecureBackup()
  if (ok) {
    emit('complete')
  }
}

async function handleRestore() {
  localStepBeforeAction.value = 'restore-input'
  const ok = await restoreFromSecureBackup(recoveryKeyInput.value)
  if (ok) {
    emit('complete')
  }
}

function handleDone() {
  visible.value = false
}

function handleRetry() {
  localStep.value = 'menu'
  passphraseInput.value = ''
  recoveryKeyInput.value = ''
  reset()
}

function handleClosed() {
  localStep.value = 'menu'
  passphraseInput.value = ''
  recoveryKeyInput.value = ''
  reset()
}
</script>
