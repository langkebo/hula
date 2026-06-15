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
            <p v-if="props.inboundRequest" class="mt-8px color-[var(--hula-color-warning-500)]">
              {{ t('setting.device_verify_dialog.inbound_request_hint') }}
            </p>
          </div>

          <!-- Inbound request details -->
          <div
            v-if="props.inboundRequest"
            class="w-full bg-[var(--hula-color-warning-100)] border border-[var(--hula-color-warning-500)] rounded-8px p-16px mb-24px text-left">
            <div class="flex items-center gap-8px mb-12px">
              <Icon icon="mdi:account-check" :width="20" class="color-[var(--hula-color-warning-500)]" />
              <span class="text-[var(--text-sm)] font-medium color-[var(--hula-text-primary)]">
                {{ t('setting.device_verify_dialog.inbound_request_hint') }}
              </span>
            </div>
            <div class="flex justify-between mb-8px">
              <span class="text-[var(--text-xs)] color-[var(--hula-text-tertiary)]">
                {{ t('setting.device_verify_dialog.pending_request_from') }}
              </span>
              <span class="text-[var(--text-xs)] font-medium color-[var(--hula-text-primary)]">
                {{ props.inboundRequest.userId }}
              </span>
            </div>
            <div class="flex justify-between mb-8px">
              <span class="text-[var(--text-xs)] color-[var(--hula-text-tertiary)]">
                {{ t('setting.device_verify_dialog.pending_request_device') }}
              </span>
              <span class="text-[var(--text-xs)] font-medium color-[var(--hula-text-primary)]">
                {{ props.inboundRequest.deviceId }}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-[var(--text-xs)] color-[var(--hula-text-tertiary)]">
                {{ t('setting.device_verify_dialog.pending_request_methods') }}
              </span>
              <span class="text-[var(--text-xs)] font-medium color-[var(--hula-text-primary)]">
                {{ props.inboundRequest.methods.join(', ') }}
              </span>
            </div>
          </div>

          <!-- Device info card (shown when no inbound request) -->
          <div
            v-else
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

          <!-- Pending verifications section -->
          <div
            v-if="pendingVerifications.length > 0"
            class="w-full bg-[var(--hula-surface-panel)] border border-[var(--hula-border-default)] rounded-8px p-16px mb-24px text-left">
            <div class="flex items-center gap-8px mb-12px">
              <Icon icon="mdi:clock-outline" :width="18" class="color-[var(--hula-color-primary-500)]" />
              <span class="text-[var(--text-sm)] font-medium color-[var(--hula-text-primary)]">
                {{ t('setting.device_verify_dialog.pending_list_title') }}
              </span>
            </div>
            <n-list size="small" bordered>
              <n-list-item v-for="req in pendingVerifications" :key="req.transactionId">
                <div class="flex items-center justify-between w-full">
                  <div class="flex-1 min-w-0">
                    <div class="text-[var(--text-sm)] color-[var(--hula-text-primary)] truncate">
                      {{ req.userId }}
                    </div>
                    <div class="text-[var(--text-xs)] color-[var(--hula-text-tertiary)]">
                      {{ t('setting.device_verify_dialog.pending_request_device') }}: {{ req.deviceId }}
                    </div>
                  </div>
                  <n-space size="small">
                    <n-button size="small" type="error" ghost @click="declinePendingRequest(req.transactionId)">
                      {{ t('setting.device_verify_dialog.decline_request') }}
                    </n-button>
                    <n-button size="small" type="primary" @click="acceptPendingRequest(req)">
                      {{ t('setting.device_verify_dialog.accept_request') }}
                    </n-button>
                  </n-space>
                </div>
              </n-list-item>
            </n-list>
          </div>

          <div class="w-full flex justify-end gap-12px">
            <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
            <n-button
              v-if="pendingVerifications.length === 0 && !props.inboundRequest"
              tertiary
              @click="openPendingList">
              {{ t('setting.device_verify_dialog.view_pending') }}
            </n-button>
            <n-button tertiary @click="openQrShow">
              {{ t('setting.device_verify_dialog.show_qr') }}
            </n-button>
            <n-button tertiary @click="openQrScan">
              {{ t('setting.device_verify_dialog.scan_qr') }}
            </n-button>
            <n-button v-if="props.inboundRequest" type="error" ghost @click="handleDecline">
              {{ t('setting.device_verify_dialog.decline_request') }}
            </n-button>
            <n-button type="primary" @click="startVerification">
              {{
                props.inboundRequest
                  ? t('setting.device_verify_dialog.accept_request')
                  : t('setting.device_verify_dialog.start_verification')
              }}
            </n-button>
          </div>
        </div>

        <!-- Step: Pending List -->
        <div v-else-if="step === 'pendingList'" class="flex flex-col items-center text-center">
          <div class="mb-16px text-[var(--hula-color-primary-500)] bg-[var(--hula-surface-search)] p-16px rounded-full">
            <Icon icon="mdi:clock-outline" :width="48" />
          </div>
          <h3 class="text-[var(--text-lg)] font-medium color-[var(--hula-text-primary)] mb-8px">
            {{ t('setting.device_verify_dialog.pending_list_title') }}
          </h3>
          <div class="w-full mb-24px">
            <n-alert v-if="pendingVerifications.length === 0" type="info" class="mb-16px">
              {{ t('setting.device_verify_dialog.pending_list_empty') }}
            </n-alert>
            <n-list v-else size="small" bordered>
              <n-list-item v-for="req in pendingVerifications" :key="req.transactionId">
                <div class="flex items-center justify-between w-full">
                  <div class="flex-1 min-w-0">
                    <div class="text-[var(--text-sm)] color-[var(--hula-text-primary)] truncate">
                      {{ req.userId }}
                    </div>
                    <div class="text-[var(--text-xs)] color-[var(--hula-text-tertiary)]">
                      {{ t('setting.device_verify_dialog.pending_request_device') }}: {{ req.deviceId }}
                    </div>
                    <div class="mt-4px">
                      <n-tag v-for="method in req.methods" :key="method" size="small" class="mr-4px">
                        {{ method }}
                      </n-tag>
                    </div>
                  </div>
                  <n-space size="small">
                    <n-button size="small" type="error" ghost @click="declinePendingRequest(req.transactionId)">
                      {{ t('setting.device_verify_dialog.decline_request') }}
                    </n-button>
                    <n-button size="small" type="primary" @click="acceptPendingRequest(req)">
                      {{ t('setting.device_verify_dialog.accept_request') }}
                    </n-button>
                  </n-space>
                </div>
              </n-list-item>
            </n-list>
          </div>
          <div class="w-full flex justify-end gap-12px">
            <n-button @click="step = 'intro'">{{ t('common.back') }}</n-button>
            <n-button type="primary" @click="loadPendingVerifications">
              {{ t('common.refresh') }}
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
          <!-- Cancel with reason -->
          <div
            v-if="showCancelReason"
            class="w-full bg-[var(--hula-surface-panel)] border border-[var(--hula-border-default)] rounded-8px p-16px mb-16px">
            <div class="text-[var(--text-xs)] color-[var(--hula-text-tertiary)] mb-8px">
              {{ t('setting.device_verify_dialog.cancel_reason_label') }}
            </div>
            <n-input
              v-model:value="cancelReason"
              size="small"
              :placeholder="t('setting.device_verify_dialog.cancel_reason_placeholder')" />
          </div>
          <div class="w-full flex justify-end gap-12px">
            <n-button v-if="!showCancelReason" type="default" ghost @click="showCancelReason = true">
              {{ t('setting.device_verify_dialog.cancel_verification') }}
            </n-button>
            <template v-else>
              <n-button @click="hideCancelReason">
                {{ t('common.cancel') }}
              </n-button>
              <n-button type="error" @click="handleCancelWithReason">
                {{ t('setting.device_verify_dialog.cancel_verification') }}
              </n-button>
            </template>
            <n-button v-if="!showCancelReason" type="error" @click="handleReject" ghost>
              {{ t('setting.device_verify_dialog.mismatch') }}
            </n-button>
            <n-button v-if="!showCancelReason" type="primary" @click="handleConfirm">
              {{ t('setting.device_verify_dialog.confirm_match') }}
            </n-button>
          </div>
        </div>

        <!-- Step: Show QR -->
        <div v-else-if="step === 'showQr'" class="flex flex-col items-center text-center">
          <div
            class="w-full bg-[var(--hula-surface-panel)] border border-[var(--hula-border-default)] rounded-8px p-24px mb-24px">
            <div class="text-[var(--text-xs)] color-[var(--hula-text-tertiary)] mb-16px">
              {{ t('setting.device_verify_dialog.qr_code_label') }}
            </div>
            <n-qr-code :value="qrCodeData" :size="220" />
            <div class="mt-16px text-[var(--text-xs)] color-[var(--hula-text-secondary)] break-all">
              {{ qrCodeData }}
            </div>
          </div>
          <div class="text-[var(--text-sm)] color-[var(--hula-text-secondary)] mb-24px">
            <p>{{ t('setting.device_verify_dialog.qr_code_hint') }}</p>
          </div>
          <!-- Cancel with reason -->
          <div
            v-if="showCancelReason"
            class="w-full bg-[var(--hula-surface-panel)] border border-[var(--hula-border-default)] rounded-8px p-16px mb-16px">
            <div class="text-[var(--text-xs)] color-[var(--hula-text-tertiary)] mb-8px">
              {{ t('setting.device_verify_dialog.cancel_reason_label') }}
            </div>
            <n-input
              v-model:value="cancelReason"
              size="small"
              :placeholder="t('setting.device_verify_dialog.cancel_reason_placeholder')" />
          </div>
          <div class="w-full flex justify-end gap-12px">
            <n-button v-if="!showCancelReason" type="default" ghost @click="showCancelReason = true">
              {{ t('setting.device_verify_dialog.cancel_verification') }}
            </n-button>
            <template v-else>
              <n-button @click="hideCancelReason">
                {{ t('common.cancel') }}
              </n-button>
              <n-button type="error" @click="handleCancelWithReason">
                {{ t('setting.device_verify_dialog.cancel_verification') }}
              </n-button>
            </template>
            <n-button v-if="!showCancelReason" @click="handleCancel">{{ t('common.cancel') }}</n-button>
            <n-button v-if="!showCancelReason" type="primary" @click="openQrScan">
              {{ t('setting.device_verify_dialog.scan_qr') }}
            </n-button>
          </div>
        </div>

        <!-- Step: Scan QR -->
        <div v-else-if="step === 'scanQr'" class="flex flex-col items-center text-center">
          <div
            class="w-full bg-[var(--hula-surface-panel)] border border-[var(--hula-border-default)] rounded-8px p-24px mb-24px">
            <div class="text-[var(--text-xs)] color-[var(--hula-text-tertiary)] mb-16px">
              {{ t('setting.device_verify_dialog.scan_qr_label') }}
            </div>
            <textarea
              v-model="qrCodeToScan"
              class="w-full min-h-120px resize-none rounded-8px border border-[var(--hula-border-default)] bg-[var(--hula-surface-panel)] p-12px text-[var(--text-sm)] color-[var(--hula-text-primary)]"
              :placeholder="t('setting.device_verify_dialog.scan_qr_placeholder')" />
          </div>
          <div class="text-[var(--text-sm)] color-[var(--hula-text-secondary)] mb-24px">
            <p>{{ t('setting.device_verify_dialog.scan_qr_hint') }}</p>
          </div>
          <!-- Cancel with reason -->
          <div
            v-if="showCancelReason"
            class="w-full bg-[var(--hula-surface-panel)] border border-[var(--hula-border-default)] rounded-8px p-16px mb-16px">
            <div class="text-[var(--text-xs)] color-[var(--hula-text-tertiary)] mb-8px">
              {{ t('setting.device_verify_dialog.cancel_reason_label') }}
            </div>
            <n-input
              v-model:value="cancelReason"
              size="small"
              :placeholder="t('setting.device_verify_dialog.cancel_reason_placeholder')" />
          </div>
          <div class="w-full flex justify-end gap-12px">
            <n-button v-if="!showCancelReason" type="default" ghost @click="showCancelReason = true">
              {{ t('setting.device_verify_dialog.cancel_verification') }}
            </n-button>
            <template v-else>
              <n-button @click="hideCancelReason">
                {{ t('common.cancel') }}
              </n-button>
              <n-button type="error" @click="handleCancelWithReason">
                {{ t('setting.device_verify_dialog.cancel_verification') }}
              </n-button>
            </template>
            <n-button v-if="!showCancelReason" @click="handleCancel">{{ t('common.cancel') }}</n-button>
            <n-button v-if="!showCancelReason" type="primary" @click="submitQrScan">
              {{ t('setting.device_verify_dialog.submit_qr') }}
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
import { NAlert, NButton, NInput, NList, NListItem, NModal, NQrCode, NSpace, NSpin, NTag } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryption } from '@/composables/encryption'
import type { VerificationRequest } from '@/services/matrix/crypto/MatrixVerificationService'
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
  inboundRequest?: VerificationRequest | null
  initialMode?: 'sas' | 'qr_show' | 'qr_scan'
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}>()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

type Step = 'intro' | 'pendingList' | 'showKey' | 'showQr' | 'scanQr' | 'success' | 'rejected'
const step = ref<Step>('intro')
const loading = ref(false)
const fingerprint = ref('')
const transactionId = ref<string | null>(null)
const targetUserId = ref<string>('')
const targetDeviceId = ref<string>('')
const qrCodeData = ref('')
const qrCodeToScan = ref('')
const cancelReason = ref('')
const showCancelReason = ref(false)
const pendingVerifications = ref<VerificationRequest[]>([])

const currentStepIndex = computed(() => {
  switch (step.value) {
    case 'intro':
    case 'pendingList':
      return 1
    case 'showKey':
    case 'showQr':
    case 'scanQr':
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

function resetState(initialInboundRequest: VerificationRequest | null = null) {
  step.value = 'intro'
  fingerprint.value = ''
  loading.value = false
  qrCodeData.value = ''
  qrCodeToScan.value = ''
  cancelReason.value = ''
  showCancelReason.value = false
  pendingVerifications.value = []

  if (initialInboundRequest) {
    transactionId.value = initialInboundRequest.transactionId
    targetUserId.value = initialInboundRequest.userId
    targetDeviceId.value = initialInboundRequest.deviceId
  } else {
    transactionId.value = null
    targetUserId.value = encryption.getCurrentSessionContext().userId ?? ''
    targetDeviceId.value = props.deviceId || encryption.getCurrentSessionContext().deviceId || ''
  }
}

watch(
  () => props.inboundRequest,
  (newVal) => {
    resetState(newVal)
  },
  { immediate: true }
)

watch(
  () => [props.show, props.initialMode] as const,
  async ([show]) => {
    if (show) {
      resetState(props.inboundRequest || null)
      await loadPendingVerifications()
      if (props.initialMode === 'qr_show') {
        await openQrShow()
      } else if (props.initialMode === 'qr_scan') {
        openQrScan()
      }
    }
  },
  { immediate: true }
)

async function loadPendingVerifications() {
  try {
    pendingVerifications.value = await encryption.getPendingVerifications()
  } catch (err) {
    logger.error('Failed to load pending verifications:', err)
    pendingVerifications.value = []
  }
}

function openPendingList() {
  step.value = 'pendingList'
  loadPendingVerifications()
}

async function acceptPendingRequest(req: VerificationRequest) {
  loading.value = true
  try {
    await encryption.acceptVerification(req.transactionId)
    transactionId.value = req.transactionId
    targetUserId.value = req.userId
    targetDeviceId.value = req.deviceId
    fingerprint.value =
      (await encryption.getDeviceFingerprint(req.userId, req.deviceId)) ||
      t('setting.device_verify_dialog.fingerprint_unavailable')
    step.value = 'showKey'
    showFeedback(t('setting.device_verify_dialog.accepted_success'), 'success')
    await loadPendingVerifications()
  } catch (error) {
    logger.error('Failed to accept verification request:', error)
    showFeedback(t('setting.device_verify_dialog.accepted_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function declinePendingRequest(txId: string) {
  loading.value = true
  try {
    await encryption.cancelVerification(txId, 'declined')
    showFeedback(t('setting.device_verify_dialog.declined_success'), 'success')
    await loadPendingVerifications()
  } catch (error) {
    logger.error('Failed to decline verification request:', error)
    showFeedback(t('setting.device_verify_dialog.declined_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function handleDecline() {
  if (!props.inboundRequest) return
  loading.value = true
  try {
    await encryption.cancelVerification(props.inboundRequest.transactionId, 'declined')
    showFeedback(t('setting.device_verify_dialog.declined_success'), 'success')
    visible.value = false
    resetState()
  } catch (error) {
    logger.error('Failed to decline verification request:', error)
    showFeedback(t('setting.device_verify_dialog.declined_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function cancelActiveVerification(reason: string) {
  if (transactionId.value) {
    try {
      await encryption.cancelVerification(transactionId.value, reason)
    } catch (err) {
      logger.error('Failed to cancel verification:', err)
    }
  }
}

async function handleCancel() {
  await cancelActiveVerification('User cancelled verification')
  visible.value = false
  resetState()
}

async function handleCancelWithReason() {
  const reason = cancelReason.value.trim() || 'User cancelled verification'
  loading.value = true
  try {
    await cancelActiveVerification(reason)
    showFeedback(t('setting.device_verify_dialog.cancel_success'), 'success')
    visible.value = false
    resetState()
  } catch (error) {
    logger.error('Failed to cancel verification:', error)
    showFeedback(t('setting.device_verify_dialog.cancel_failed'), 'error')
  } finally {
    loading.value = false
  }
}

function hideCancelReason() {
  showCancelReason.value = false
  cancelReason.value = ''
}

function handleClose() {
  visible.value = false
  resetState()
}

async function openQrShow() {
  loading.value = true

  try {
    const qrPayload = await encryption.getQrCodeShow()
    if (!qrPayload?.qr_code) {
      throw new Error('QR code unavailable')
    }

    qrCodeData.value = qrPayload.qr_code
    transactionId.value = qrPayload.transaction_id || transactionId.value
    step.value = 'showQr'
  } catch (error) {
    logger.warn('Failed to load QR verification payload:', error)
    showFeedback(t('setting.device_verify_dialog.qr_load_failed'), 'error')
  } finally {
    loading.value = false
  }
}

function openQrScan() {
  step.value = 'scanQr'
}

async function startVerification() {
  loading.value = true

  try {
    const sessionContext = encryption.getCurrentSessionContext()
    const currentUserId = sessionContext.userId
    const currentDeviceId = sessionContext.deviceId

    if (!currentUserId || !currentDeviceId) {
      throw new Error('Device context unavailable')
    }

    // If it's an inbound request, accept it and get the fingerprint
    if (transactionId.value) {
      await encryption.acceptVerification(transactionId.value)
      fingerprint.value =
        (await encryption.getDeviceFingerprint(targetUserId.value, targetDeviceId.value)) ||
        t('setting.device_verify_dialog.fingerprint_unavailable')
      step.value = 'showKey'
    } else {
      const txId = await encryption.startSasVerification(targetUserId.value, targetDeviceId.value)
      transactionId.value = txId
      fingerprint.value =
        (await encryption.getDeviceFingerprint(targetUserId.value, targetDeviceId.value)) ||
        t('setting.device_verify_dialog.fingerprint_unavailable')
      step.value = 'showKey'
    }
  } catch (error) {
    logger.warn('Failed to start/accept verification:', error)
    showFeedback(t('setting.device_verify_dialog.load_fingerprint_failed'), 'error')
    step.value = 'rejected'
  } finally {
    loading.value = false
  }
}

async function submitQrScan() {
  const rawQrCode = qrCodeToScan.value.trim()
  if (!rawQrCode) {
    showFeedback(t('setting.device_verify_dialog.scan_qr_required'), 'warning')
    return
  }

  loading.value = true

  try {
    const success = await encryption.scanQrCode(rawQrCode)
    if (!success) {
      throw new Error('QR scan was not accepted')
    }

    step.value = 'success'
    emit('success')
    showFeedback(t('setting.device_verify_dialog.qr_scan_success'), 'success')
  } catch (error) {
    logger.error('QR verification failed:', error)
    showFeedback(t('setting.device_verify_dialog.qr_scan_failed'), 'error')
    step.value = 'rejected'
  } finally {
    loading.value = false
  }
}

async function handleConfirm() {
  loading.value = true

  try {
    if (!transactionId.value) {
      throw new Error('No active verification transaction to confirm.')
    }

    await encryption.confirmSas(transactionId.value)

    step.value = 'success'
    emit('success')
    showFeedback(t('setting.encryption.verify_success'), 'success')
  } catch (error) {
    logger.error('Device verification failed:', error)
    showFeedback(t('setting.device_verify_dialog.verify_failed'), 'error')
    step.value = 'rejected'
  } finally {
    loading.value = false
  }
}

async function handleReject() {
  await cancelActiveVerification('User rejected verification')
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
  background-color: var(--hula-encryption-surface-subtle);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 24px;
}

:deep(.dark) .device-info-card {
  background-color: var(--hula-encryption-surface-dark);
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.info-row:not(:last-child) {
  border-bottom: 1px solid var(--hula-border-muted);
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
  background-color: var(--hula-encryption-surface-subtle);
  border-radius: 4px;
}

:deep(.dark) .fingerprint-chunk {
  background-color: var(--hula-encryption-surface-dark);
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
