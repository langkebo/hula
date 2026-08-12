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
        <DeviceVerifyIntroStep
          v-if="step === 'intro'"
          :inbound-request="props.inboundRequest ?? null"
          :device-id="props.deviceId"
          :device-name="props.deviceName"
          :pending-verifications="pendingVerifications"
          @cancel="handleCancel"
          @view-pending="openPendingList"
          @show-qr="openQrShow"
          @scan-qr="openQrScan"
          @decline="handleDecline"
          @start="startVerification"
          @accept-pending="acceptPendingRequest"
          @decline-pending="declinePendingRequest" />

        <!-- Step: Pending List -->
        <DeviceVerifyPendingStep
          v-else-if="step === 'pendingList'"
          :pending-verifications="pendingVerifications"
          @back="backToIntro"
          @refresh="loadPendingVerifications"
          @accept-pending="acceptPendingRequest"
          @decline-pending="declinePendingRequest" />

        <!-- Step: Show Key (SAS) -->
        <DeviceVerifyFingerprintStep
          v-else-if="step === 'showKey'"
          :fingerprint-chunks="fingerprintChunks"
          v-model:show-cancel-reason="showCancelReason"
          v-model:cancel-reason="cancelReason"
          @hide-cancel-reason="hideCancelReason"
          @cancel-with-reason="handleCancelWithReason"
          @reject="handleReject"
          @confirm="handleConfirm"
          @cancel="handleCancel" />

        <!-- Step: Show QR / Scan QR -->
        <DeviceVerifyQrStep
          v-else-if="step === 'showQr' || step === 'scanQr'"
          :mode="step === 'showQr' ? 'show' : 'scan'"
          :qr-code-data="qrCodeData"
          v-model:qr-code-to-scan="qrCodeToScan"
          v-model:show-cancel-reason="showCancelReason"
          v-model:cancel-reason="cancelReason"
          @hide-cancel-reason="hideCancelReason"
          @cancel-with-reason="handleCancelWithReason"
          @cancel="handleCancel"
          @scan-qr="openQrScan"
          @submit-qr="submitQrScan" />

        <!-- Step: Success / Rejected -->
        <DeviceVerifyResultStep
          v-else-if="step === 'success' || step === 'rejected'"
          :status="step === 'success' ? 'success' : 'rejected'"
          @close="handleClose" />
      </div>
    </n-spin>
  </n-modal>
</template>

<script setup lang="ts">
import { NModal, NSpin } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDeviceVerifyDialog } from '@/composables/encryption/useDeviceVerifyDialog'
import type { VerificationRequest } from '@/services/matrix/crypto/MatrixVerificationService'
import DeviceVerifyFingerprintStep from './DeviceVerifyFingerprintStep.vue'
import DeviceVerifyIntroStep from './DeviceVerifyIntroStep.vue'
import DeviceVerifyPendingStep from './DeviceVerifyPendingStep.vue'
import DeviceVerifyQrStep from './DeviceVerifyQrStep.vue'
import DeviceVerifyResultStep from './DeviceVerifyResultStep.vue'

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

const { t } = useI18n()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

const {
  // state (exposed on vm for tests)
  step,
  loading,
  fingerprint,
  qrCodeData,
  qrCodeToScan,
  cancelReason,
  showCancelReason,
  pendingVerifications,
  // getters
  currentStepIndex,
  fingerprintChunks,
  // actions
  loadPendingVerifications,
  openPendingList,
  backToIntro,
  acceptPendingRequest,
  declinePendingRequest,
  handleDecline,
  handleCancel,
  handleCancelWithReason,
  hideCancelReason,
  handleClose,
  openQrShow,
  openQrScan,
  startVerification,
  submitQrScan,
  handleConfirm,
  handleReject
} = useDeviceVerifyDialog({ props, emit, visible })
</script>
