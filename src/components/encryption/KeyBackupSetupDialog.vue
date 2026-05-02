<template>
  <n-modal v-model:show="visible" preset="card" :title="dialogTitle" style="width: 500px" :mask-closable="false">
    <n-spin :show="loading">
      <div v-if="step === 'intro'" class="step-content">
        <div class="intro-icon">
          <Icon icon="mdi:shield-key" :width="64" />
        </div>
        <div class="intro-text">
          <p>{{ t('encryption.backup_setup_dialog.intro_primary') }}</p>
          <p class="warning-text">{{ t('encryption.backup_setup_dialog.intro_warning') }}</p>
        </div>
        <div class="intro-actions">
          <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="startSetup">
            {{ t('encryption.backup_setup_dialog.start_setup') }}
          </n-button>
        </div>
      </div>

      <div v-else-if="step === 'create'" class="step-content">
        <div class="create-info">
          <Icon icon="mdi:key-chain" :width="48" />
          <p>{{ t('encryption.backup_setup_dialog.creating') }}</p>
        </div>
      </div>

      <div v-else-if="step === 'showKey'" class="step-content">
        <div class="key-display">
          <div class="key-label">{{ t('encryption.backup_setup_dialog.your_recovery_key') }}</div>
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
          <span>{{ t('encryption.backup_setup_dialog.key_warning') }}</span>
        </div>
        <n-checkbox v-model:checked="keySaved" class="key-checkbox">
          {{ t('encryption.backup_setup_dialog.key_saved_confirm') }}
        </n-checkbox>
        <div class="step-actions">
          <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :disabled="!keySaved" @click="confirmSetup">
            {{ t('encryption.backup_setup_dialog.confirm_complete') }}
          </n-button>
        </div>
      </div>

      <div v-else-if="step === 'verify'" class="step-content">
        <div class="verify-info">
          <p>{{ t('encryption.backup_setup_dialog.verify_prompt') }}</p>
        </div>
        <n-input
          v-model:value="verifyKey"
          type="textarea"
          :placeholder="t('encryption.backup.key_placeholder')"
          :rows="3"
          class="verify-input" />
        <div class="step-actions">
          <n-button @click="step = 'showKey'">{{ t('common.back') }}</n-button>
          <n-button type="primary" :disabled="!verifyKey.trim()" @click="verifyKeyInput">
            {{ t('encryption.backup_setup_dialog.verify_key') }}
          </n-button>
        </div>
      </div>

      <div v-else-if="step === 'success'" class="step-content">
        <div class="success-icon">
          <Icon icon="mdi:check-circle" :width="64" class="success-color" />
        </div>
        <div class="success-text">
          <h3>{{ t('encryption.backup_setup_dialog.success_title') }}</h3>
          <p>{{ t('encryption.backup_setup_dialog.success_desc') }}</p>
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
import { NButton, NCheckbox, NInput, NModal, NSpin, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('KeyBackupSetup')
const { t } = useI18n()

defineOptions({
  name: 'KeyBackupSetupDialog'
})

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}>()

const message = useMessage()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

type Step = 'intro' | 'create' | 'showKey' | 'verify' | 'success'
const step = ref<Step>('intro')
const loading = ref(false)
const recoveryKey = ref('')
const keySaved = ref(false)
const verifyKey = ref('')

const dialogTitle = computed(() => {
  switch (step.value) {
    case 'intro':
      return t('encryption.backup_setup_dialog.dialog_title_intro')
    case 'create':
      return t('encryption.backup_setup_dialog.dialog_title_create')
    case 'showKey':
      return t('encryption.backup_setup_dialog.dialog_title_show_key')
    case 'verify':
      return t('encryption.backup_setup_dialog.dialog_title_verify')
    case 'success':
      return t('encryption.backup_setup_dialog.dialog_title_success')
    default:
      return t('encryption.backup_setup_dialog.dialog_title_default')
  }
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
  recoveryKey.value = ''
  keySaved.value = false
  verifyKey.value = ''
  loading.value = false
}

async function startSetup() {
  loading.value = true
  step.value = 'create'

  try {
    const key = await matrixEncryptionService.setupKeyBackup()
    recoveryKey.value = key
    step.value = 'showKey'
  } catch (error) {
    logger.error('Failed to create secure backup:', error)
    message.error(t('encryption.backup_setup_dialog.create_failed'))
    step.value = 'intro'
  } finally {
    loading.value = false
  }
}

function copyKey() {
  navigator.clipboard
    .writeText(recoveryKey.value)
    .then(() => message.success(t('encryption.backup.copy_success')))
    .catch(() => message.error(t('encryption.backup_setup_dialog.copy_manual')))
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
  message.success(t('encryption.backup.download_success'))
}

function confirmSetup() {
  step.value = 'verify'
}

async function verifyKeyInput() {
  if (verifyKey.value.trim() !== recoveryKey.value) {
    message.error(t('encryption.backup_setup_dialog.key_mismatch'))
    return
  }

  loading.value = true
  try {
    const backupInfo = await matrixEncryptionService.getKeyBackupInfo()
    if (backupInfo) {
      step.value = 'success'
      message.success(t('encryption.backup_setup_dialog.verify_success'))
    } else {
      message.error(t('encryption.backup_setup_dialog.verify_failed'))
    }
  } catch (error) {
    logger.error('Failed to verify backup setup:', error)
    message.error(t('encryption.backup_setup_dialog.verify_failed'))
  } finally {
    loading.value = false
  }
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
  color: var(--primary-color, #1890ff);
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

.intro-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.create-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 0;
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

.success-text p {
  margin: 0;
  color: var(--color-text-quaternary);
}
</style>
