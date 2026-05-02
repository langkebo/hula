<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('encryption.device_verify_dialog.title')"
    style="width: 450px"
    :mask-closable="false">
    <n-spin :show="loading">
      <div v-if="step === 'intro'" class="step-content">
        <div class="intro-icon">
          <Icon icon="mdi:shield-check" :width="64" />
        </div>
        <div class="intro-text">
          <p>{{ t('encryption.device_verify_dialog.intro_primary') }}</p>
          <p>{{ t('encryption.device_verify_dialog.intro_secondary') }}</p>
        </div>
        <div class="device-info-card">
          <div class="info-row">
            <span class="info-label">{{ t('encryption.device_verify_dialog.device_id') }}</span>
            <span class="info-value">{{ deviceId }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">{{ t('encryption.device_verify_dialog.device_name') }}</span>
            <span class="info-value">{{ deviceName || t('encryption.device_verify_dialog.unnamed_device') }}</span>
          </div>
        </div>
        <div class="step-actions">
          <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" @click="startVerification">
            {{ t('encryption.device_verify_dialog.start_verification') }}
          </n-button>
        </div>
      </div>

      <div v-else-if="step === 'showKey'" class="step-content">
        <div class="key-display">
          <div class="key-label">{{ t('encryption.device_verify_dialog.fingerprint_label') }}</div>
          <div class="fingerprint-display">
            <div v-for="(chunk, index) in fingerprintChunks" :key="index" class="fingerprint-chunk">
              {{ chunk }}
            </div>
          </div>
          <div class="key-hint">
            <Icon icon="mdi:information" :width="16" />
            <span>{{ t('encryption.device_verify_dialog.fingerprint_hint') }}</span>
          </div>
        </div>
        <div class="verification-question">
          <p>{{ t('encryption.device_verify_dialog.match_question') }}</p>
        </div>
        <div class="step-actions">
          <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
          <n-button type="error" @click="handleReject">
            {{ t('encryption.device_verify_dialog.mismatch') }}
          </n-button>
          <n-button type="primary" @click="handleConfirm">
            {{ t('encryption.device_verify_dialog.confirm_match') }}
          </n-button>
        </div>
      </div>

      <div v-else-if="step === 'success'" class="step-content">
        <div class="success-icon">
          <Icon icon="mdi:check-circle" :width="64" class="success-color" />
        </div>
        <div class="success-text">
          <h3>{{ t('encryption.device_verify_dialog.success_title') }}</h3>
          <p>{{ t('encryption.device_verify_dialog.success_desc') }}</p>
        </div>
        <div class="step-actions">
          <n-button type="primary" @click="handleClose">{{ t('common.close') }}</n-button>
        </div>
      </div>

      <div v-else-if="step === 'rejected'" class="step-content">
        <div class="error-icon">
          <Icon icon="mdi:alert-circle" :width="64" class="error-color" />
        </div>
        <div class="error-text">
          <h3>{{ t('encryption.device_verify_dialog.rejected_title') }}</h3>
          <p>{{ t('encryption.device_verify_dialog.rejected_desc') }}</p>
          <p class="warning-text">{{ t('encryption.device_verify_dialog.rejected_hint') }}</p>
        </div>
        <div class="step-actions">
          <n-button @click="handleClose">{{ t('common.close') }}</n-button>
        </div>
      </div>
    </n-spin>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NModal, NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixEncryptionContextService } from '@/services/matrix/crypto/MatrixEncryptionContextService'
import { matrixEncryptionService } from '@/services/matrix/crypto/MatrixEncryptionService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DeviceVerify')
const { t } = useI18n()

defineOptions({
  name: 'DeviceVerifyDialog'
})

const props = defineProps<{
  show: boolean
  deviceId?: string
  deviceName?: string
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

type Step = 'intro' | 'showKey' | 'success' | 'rejected'
const step = ref<Step>('intro')
const loading = ref(false)
const fingerprint = ref('')
const userId = ref('')

const fingerprintChunks = computed(() => {
  if (!fingerprint.value) return []
  return fingerprint.value.match(/.{1,4}/g) || []
})

onMounted(async () => {
  userId.value = matrixEncryptionContextService.getCurrentSessionContext().userId ?? ''
})

function handleCancel() {
  visible.value = false
  resetState()
}

function handleClose() {
  visible.value = false
  resetState()
}

function resetState() {
  step.value = 'intro'
  fingerprint.value = ''
  loading.value = false
}

async function startVerification() {
  loading.value = true

  try {
    const sessionContext = matrixEncryptionContextService.getCurrentSessionContext()
    const targetUserId = sessionContext.userId
    const targetDeviceId = props.deviceId || sessionContext.deviceId

    if (!targetUserId || !targetDeviceId) {
      throw new Error('Device context unavailable')
    }

    userId.value = targetUserId
    fingerprint.value =
      (await matrixEncryptionContextService.getDeviceFingerprint(targetUserId, targetDeviceId)) ||
      t('encryption.device_verify_dialog.fingerprint_unavailable')
    step.value = 'showKey'
  } catch (error) {
    logger.error('Failed to load device fingerprint:', error)
    message.error(t('encryption.device_verify_dialog.load_fingerprint_failed'))
  } finally {
    loading.value = false
  }
}

async function handleConfirm() {
  loading.value = true

  try {
    const sessionContext = matrixEncryptionContextService.getCurrentSessionContext()
    const targetUserId = userId.value || sessionContext.userId
    const targetDeviceId = props.deviceId || sessionContext.deviceId

    if (!targetUserId || !targetDeviceId) {
      throw new Error('Device context unavailable')
    }

    await matrixEncryptionService.trustDevice(targetUserId, targetDeviceId)

    step.value = 'success'
    message.success(t('encryption.verify_success'))
  } catch (error) {
    logger.error('Device verification failed:', error)
    message.error(t('encryption.device_verify_dialog.verify_failed'))
  } finally {
    loading.value = false
  }
}

function handleReject() {
  step.value = 'rejected'
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

.device-info-card {
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

:deep(.dark) .device-info-card {
  background-color: rgba(255, 255, 255, 0.05);
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.info-row:not(:last-child) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.dark) .info-row:not(:last-child) {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.info-label {
  color: var(--color-text-quaternary);
  font-size: 14px;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
}

.key-display {
  text-align: center;
  margin-bottom: 24px;
}

.key-label {
  font-size: 14px;
  color: var(--color-text-quaternary);
  margin-bottom: 12px;
}

.fingerprint-display {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

.fingerprint-chunk {
  font-family: monospace;
  font-size: 18px;
  font-weight: 500;
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

:deep(.dark) .fingerprint-chunk {
  background-color: rgba(255, 255, 255, 0.05);
}

.key-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--color-text-quaternary);
}

.verification-question {
  text-align: center;
  margin-bottom: 16px;
}

.verification-question p {
  margin: 0;
  font-weight: 500;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.success-icon,
.error-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.success-color {
  color: var(--color-success);
}

.error-color {
  color: var(--color-danger);
}

.success-text,
.error-text {
  text-align: center;
}

.success-text h3,
.error-text h3 {
  margin: 0 0 8px 0;
}

.success-text p,
.error-text p {
  margin: 0;
  color: var(--color-text-quaternary);
}

.warning-text {
  color: var(--color-warning) !important;
  margin-top: 8px !important;
}
</style>
