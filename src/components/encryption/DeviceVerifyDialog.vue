<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('setting.device_verify_dialog.title')"
    style="width: 500px"
    :mask-closable="false"
    class="rounded-12px overflow-hidden shadow-lg">
    <n-spin :show="loading">
      <div class="px-24px py-20px">
        <!-- 步骤条引导 -->
        <n-steps :current="currentStepIndex" class="mb-32px" size="small">
          <n-step :title="t('setting.device_verify_dialog.step_intro', '确认设备')" />
          <n-step :title="t('setting.device_verify_dialog.step_verify', '指纹核对')" />
          <n-step :title="t('setting.device_verify_dialog.step_result', '完成')" />
        </n-steps>

        <!-- Step: Intro -->
        <div v-if="step === 'intro'" class="flex flex-col items-center text-center">
          <div class="mb-16px text-[var(--hula-color-primary-500)] bg-[var(--hula-surface-search)] p-16px rounded-full">
            <Icon icon="mdi:shield-check" :width="48" />
          </div>
          <div class="mb-24px text-[var(--text-sm)] color-[var(--hula-text-secondary)]">
            <p class="mb-8px">{{ t('setting.device_verify_dialog.intro_primary') }}</p>
            <p>{{ t('setting.device_verify_dialog.intro_secondary') }}</p>
          </div>
          <div
            class="w-full bg-[var(--hula-surface-panel)] border border-[var(--hula-border-default)] rounded-8px p-16px mb-24px text-left">
            <div class="flex justify-between mb-12px">
              <span class="text-[var(--text-xs)] color-[var(--hula-text-tertiary)]">
                {{ t('setting.device_verify_dialog.device_id') }}
              </span>
              <span class="text-[var(--text-xs)] font-medium color-[var(--hula-text-primary)] break-all ml-16px">
                {{ deviceId }}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-[var(--text-xs)] color-[var(--hula-text-tertiary)]">
                {{ t('setting.device_verify_dialog.device_name') }}
              </span>
              <span class="text-[var(--text-xs)] font-medium color-[var(--hula-text-primary)]">
                {{ deviceName || t('setting.device_verify_dialog.unnamed_device') }}
              </span>
            </div>
          </div>
          <div class="w-full flex justify-end gap-12px">
            <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
            <n-button type="primary" @click="startVerification">
              {{ t('setting.device_verify_dialog.start_verification') }}
            </n-button>
          </div>
        </div>

        <!-- Step: Show Key -->
        <div v-else-if="step === 'showKey'" class="flex flex-col items-center text-center">
          <div
            class="w-full bg-[var(--hula-surface-panel)] border border-[var(--hula-border-default)] rounded-8px p-24px mb-24px">
            <div class="text-[var(--text-xs)] color-[var(--hula-text-tertiary)] mb-16px">
              {{ t('setting.device_verify_dialog.fingerprint_label') }}
            </div>
            <div
              class="flex flex-wrap justify-center gap-8px font-mono text-[var(--text-lg)] font-bold tracking-wider color-[var(--hula-text-primary)]">
              <div
                v-for="(chunk, index) in fingerprintChunks"
                :key="index"
                class="bg-[var(--hula-surface-search)] px-8px py-4px rounded-6px">
                {{ chunk }}
              </div>
            </div>
            <div
              class="mt-16px flex items-center justify-center gap-4px text-[var(--text-xs)] color-[var(--hula-color-warning-500)] bg-[var(--hula-color-warning-100)] py-8px px-12px rounded-6px">
              <Icon icon="mdi:information" :width="16" />
              <span>{{ t('setting.device_verify_dialog.fingerprint_hint') }}</span>
            </div>
          </div>
          <div class="text-[var(--text-sm)] color-[var(--hula-text-secondary)] mb-24px">
            <p>{{ t('setting.device_verify_dialog.match_question') }}</p>
          </div>
          <div class="w-full flex justify-end gap-12px">
            <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
            <n-button type="error" @click="handleReject" ghost>
              {{ t('setting.device_verify_dialog.mismatch') }}
            </n-button>
            <n-button type="primary" @click="handleConfirm">
              {{ t('setting.device_verify_dialog.confirm_match') }}
            </n-button>
          </div>
        </div>

        <!-- Step: Success -->
        <div v-else-if="step === 'success'" class="flex flex-col items-center text-center py-24px">
          <div class="mb-16px text-[var(--hula-color-success-500)]">
            <Icon icon="mdi:check-circle" :width="64" />
          </div>
          <h3 class="text-[var(--text-lg)] font-medium color-[var(--hula-text-primary)] mb-8px">
            {{ t('setting.device_verify_dialog.success_title') }}
          </h3>
          <p class="text-[var(--text-sm)] color-[var(--hula-text-secondary)] mb-24px">
            {{ t('setting.device_verify_dialog.success_desc') }}
          </p>
          <n-button type="primary" @click="handleClose" class="w-120px">{{ t('common.close') }}</n-button>
        </div>

        <!-- Step: Rejected -->
        <div v-else-if="step === 'rejected'" class="flex flex-col items-center text-center py-24px">
          <div class="mb-16px text-[var(--hula-color-danger-500)]">
            <Icon icon="mdi:alert-circle" :width="64" />
          </div>
          <h3 class="text-[var(--text-lg)] font-medium color-[var(--hula-text-primary)] mb-8px">
            {{ t('setting.device_verify_dialog.rejected_title') }}
          </h3>
          <p class="text-[var(--text-sm)] color-[var(--hula-text-secondary)] mb-8px">
            {{ t('setting.device_verify_dialog.rejected_desc') }}
          </p>
          <p class="text-[var(--text-xs)] color-[var(--hula-color-danger-500)] mb-24px">
            {{ t('setting.device_verify_dialog.rejected_hint') }}
          </p>
          <n-button @click="handleClose" class="w-120px">{{ t('common.close') }}</n-button>
        </div>
      </div>
    </n-spin>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NModal, NSpin } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryption } from '@/composables/encryption'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DeviceVerify')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const encryption = useEncryption()

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

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

type Step = 'intro' | 'showKey' | 'success' | 'rejected'
const step = ref<Step>('intro')
const loading = ref(false)
const fingerprint = ref('')
const userId = ref('')

const currentStepIndex = computed(() => {
  switch (step.value) {
    case 'intro':
      return 1
    case 'showKey':
      return 2
    case 'success':
    case 'rejected':
      return 3
    default:
      return 1
  }
})

const fingerprintChunks = computed(() => {
  if (!fingerprint.value) return []
  return fingerprint.value.match(/.{1,4}/g) || []
})

onMounted(async () => {
  userId.value = encryption.getCurrentSessionContext().userId ?? ''
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
    const sessionContext = encryption.getCurrentSessionContext()
    const targetUserId = sessionContext.userId
    const targetDeviceId = props.deviceId || sessionContext.deviceId

    if (!targetUserId || !targetDeviceId) {
      throw new Error('Device context unavailable')
    }

    userId.value = targetUserId
    fingerprint.value =
      (await encryption.getDeviceFingerprint(targetUserId, targetDeviceId)) ||
      t('encryption.device_verify_dialog.fingerprint_unavailable')
    step.value = 'showKey'
  } catch (error) {
    logger.warn('Failed to load device fingerprint:', error)
    showFeedback(t('encryption.device_verify_dialog.load_fingerprint_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function handleConfirm() {
  loading.value = true

  try {
    const sessionContext = encryption.getCurrentSessionContext()
    const targetUserId = userId.value || sessionContext.userId
    const targetDeviceId = props.deviceId || sessionContext.deviceId

    if (!targetUserId || !targetDeviceId) {
      throw new Error('Device context unavailable')
    }

    await encryption.trustDevice(targetUserId, targetDeviceId)

    step.value = 'success'
    showFeedback(t('encryption.verify_success'), 'success')
  } catch (error) {
    logger.error('Device verification failed:', error)
    showFeedback(t('encryption.device_verify_dialog.verify_failed'), 'error')
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
  color: var(--color-primary);
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
