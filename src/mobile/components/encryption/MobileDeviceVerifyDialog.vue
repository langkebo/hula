<template>
  <van-dialog
    v-model:show="visible"
    :title="dialogTitle"
    :show-cancel-button="false"
    :show-confirm-button="false"
    close-on-click-overlay
    @closed="handleClose">
    <div class="px-4 py-4">
      <!-- intro: Select verification mode -->
      <div v-if="step === 'intro'" class="flex flex-col gap-3">
        <van-button block @click="startSas">
          {{ $t('encryption.verify.sas') }}
        </van-button>
        <van-button block plain @click="showQr">
          {{ $t('encryption.verify.qrShow') }}
        </van-button>
        <van-button block plain @click="scanQr">
          {{ $t('encryption.verify.qrScan') }}
        </van-button>
      </div>

      <!-- pending: Loading spinner -->
      <div v-else-if="step === 'pending'" class="flex flex-col items-center gap-3">
        <van-loading />
        <span>{{ $t('encryption.verify.waiting') }}</span>
      </div>

      <!-- showKey: SAS emoji display -->
      <div v-else-if="step === 'showKey'" class="flex flex-col items-center gap-4">
        <div class="grid grid-cols-4 gap-2">
          <div v-for="(emoji, i) in emojis" :key="i" class="text-center">
            <span class="text-2xl">{{ emoji.emoji }}</span>
            <p class="text-xs text-[--text-secondary]">{{ emoji.description }}</p>
          </div>
        </div>
        <div class="flex gap-3">
          <van-button type="danger" @click="mismatch">{{ $t('encryption.verify.mismatch') }}</van-button>
          <van-button type="primary" @click="match">{{ $t('encryption.verify.match') }}</van-button>
        </div>
      </div>

      <!-- showQr: Display QR code placeholder -->
      <div v-else-if="step === 'showQr'" class="flex flex-col items-center gap-3">
        <div class="w-48 h-48 bg-[var(--hula-surface-panel)] flex items-center justify-center rounded-lg">
          <van-icon name="qr" size="64" color="var(--van-gray-5)" />
        </div>
        <span class="text-sm text-[--text-secondary]">{{ $t('encryption.verify.qrShowHint') }}</span>
      </div>

      <!-- scanQr: Scanner placeholder -->
      <div v-else-if="step === 'scanQr'" class="flex flex-col items-center gap-3">
        <div class="w-full h-48 bg-black flex items-center justify-center rounded-lg">
          <van-icon name="scan" size="48" color="var(--van-gray-5)" />
        </div>
        <span class="text-sm text-[--text-secondary]">{{ $t('encryption.verify.qrScanHint') }}</span>
      </div>

      <!-- success -->
      <div v-else-if="step === 'success'" class="flex flex-col items-center gap-3 py-8">
        <van-icon name="success" size="48" :color="successColor" />
        <span>{{ $t('encryption.verify.complete') }}</span>
      </div>

      <!-- failed / rejected / cancelled -->
      <div
        v-else-if="step === 'failed' || step === 'rejected' || step === 'cancelled'"
        class="flex flex-col items-center gap-3 py-8">
        <van-icon name="warning" size="48" :color="dangerColor" />
        <span>{{ errorMessage || $t('encryption.verify.error') }}</span>
      </div>

      <!-- Pending requests list -->
      <div v-if="pendingRequests.length > 0" class="mt-4 border-t pt-3">
        <p class="text-sm font-medium mb-2">{{ $t('encryption.verify.pendingRequests') }}</p>
        <div v-for="req in pendingRequests" :key="req.transactionId" class="flex items-center justify-between py-1">
          <span class="text-sm truncate flex-1 mr-2">{{ req.userId }}</span>
          <div class="flex gap-2 flex-shrink-0">
            <van-button size="small" type="danger" @click="rejectRequest(req.transactionId)">
              {{ $t('common.reject') }}
            </van-button>
            <van-button size="small" type="primary" @click="acceptRequest(req.transactionId)">
              {{ $t('common.accept') }}
            </van-button>
          </div>
        </div>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDeviceVerifyFlow } from '@/composables/encryption/useDeviceVerifyFlow'
import { matrixVerificationService } from '@/services/matrix/crypto/MatrixVerificationService'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
  userId: string
  deviceId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'verified'): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const successColor = 'var(--success-color, #22c55e)'
const dangerColor = 'var(--danger-color, #ef4444)'

const {
  step,
  loading,
  emojis,
  pendingRequests,
  errorMessage,
  startSas,
  confirmSas,
  cancelVerification,
  acceptVerification,
  refreshPendingRequests,
  reset
} = useDeviceVerifyFlow({ userId: props.userId, deviceId: props.deviceId })

const dialogTitle = computed(() => {
  switch (step.value) {
    case 'intro':
      return t('encryption.verify.title')
    case 'showKey':
      return t('encryption.verify.sasTitle')
    case 'showQr':
      return t('encryption.verify.qrShowTitle')
    case 'scanQr':
      return t('encryption.verify.qrScanTitle')
    case 'success':
      return t('encryption.verify.completeTitle')
    default:
      return t('encryption.verify.title')
  }
})

async function startSasVerification() {
  await startSas(props.userId, props.deviceId)
}

function showQr() {
  // QR show mode — platform-specific rendering would go here
  step.value = 'showQr'
}

function scanQr() {
  // QR scan mode — camera binding would go here
  step.value = 'scanQr'
}

async function match() {
  await confirmSas(true)
  emit('verified')
  visible.value = false
}

async function mismatch() {
  await confirmSas(false)
}

function handleClose() {
  if (step.value !== 'success' && step.value !== 'cancelled') {
    cancelVerification('user_cancelled')
  }
}

async function acceptRequest(transactionId: string) {
  await acceptVerification(transactionId)
  await refreshPendingRequests()
}

async function rejectRequest(transactionId: string) {
  try {
    await matrixVerificationService.cancelVerification(transactionId, 'declined')
    await refreshPendingRequests()
  } catch (err) {
    // rejection errors are non-critical, swallow
  }
}
</script>
