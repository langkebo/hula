<template>
  <van-popup
    :show="visible"
    position="bottom"
    round
    closeable
    close-icon-position="top-left"
    :style="{ maxHeight: '85%' }"
    class="mobile-device-verify-dialog"
    @update:show="onUpdateVisible">
    <van-nav-bar :title="t('verification.title')" />

    <div
      class="flex flex-col px-16px py-16px gap-16px overflow-y-auto bg-[--center-bg-color] text-[--text-color] pb-[env(safe-area-inset-bottom)]">
      <!-- Loading overlay -->
      <div v-if="loading" class="flex justify-center items-center py-40px">
        <van-loading size="24px">{{ t('verification.sas.waiting') }}</van-loading>
      </div>

      <template v-else>
        <!-- Step: Intro -->
        <div v-if="step === 'intro'" class="flex flex-col items-center text-center">
          <div
            class="w-64px h-64px rounded-full flex items-center justify-center mb-12px bg-[--hula-color-primary-50] dark:bg-[--hula-color-primary-900]">
            <van-icon name="shield-o" size="32" color="var(--hula-color-primary-500)" />
          </div>
          <h3 class="text-16px font-medium mb-8px">{{ t('verification.intro.title') }}</h3>
          <p class="text-14px text-[--hula-text-secondary] mb-16px">{{ t('verification.intro.desc') }}</p>

          <!-- Pending requests -->
          <div v-if="pendingRequests.length > 0" class="w-full mb-16px">
            <div class="text-13px text-[--hula-text-tertiary] mb-8px">
              {{ t('verification.pending_requests.title') }}
            </div>
            <van-cell-group inset>
              <van-cell
                v-for="req in pendingRequests"
                :key="req.transactionId"
                :title="req.userId"
                :label="`${t('verification.pending_requests.device')}: ${req.deviceId}`">
                <template #right-icon>
                  <div class="flex items-center gap-8px">
                    <van-button size="mini" type="danger" plain @click="onDecline(req.transactionId)">
                      {{ t('verification.actions.reject') }}
                    </van-button>
                    <van-button size="mini" type="primary" @click="onAccept(req.transactionId)">
                      {{ t('verification.actions.accept') }}
                    </van-button>
                  </div>
                </template>
              </van-cell>
            </van-cell-group>
          </div>

          <van-empty
            v-else
            :description="t('verification.intro.no_pending')"
            image="search"
            class="w-full mb-8px" />

          <div class="w-full flex flex-col gap-8px">
            <van-button type="primary" block @click="onStartSas">
              {{ t('verification.intro.start_sas') }}
            </van-button>
            <div class="flex gap-8px">
              <van-button class="flex-1" plain @click="onShowQr">
                {{ t('verification.intro.show_qr') }}
              </van-button>
              <van-button class="flex-1" plain @click="onScanQr">
                {{ t('verification.intro.start_qr') }}
              </van-button>
            </div>
          </div>
        </div>

        <!-- Step: Pending -->
        <div v-else-if="step === 'pending'" class="flex flex-col items-center text-center py-40px">
          <van-loading size="32px" type="spinner" />
          <p class="mt-12px text-14px text-[--hula-text-secondary]">{{ t('verification.sas.waiting') }}</p>
        </div>

        <!-- Step: Show Key (SAS emojis) -->
        <div v-else-if="step === 'showKey'" class="flex flex-col items-center text-center">
          <p class="text-14px text-[--hula-text-secondary] mb-16px">{{ t('verification.sas.desc') }}</p>

          <div
            v-if="emojis.length > 0"
            class="w-full flex flex-wrap justify-center gap-12px mb-24px p-16px rounded-12px bg-[--hula-surface-panel] dark:bg-[--hula-surface-dark]">
            <div
              v-for="(item, index) in emojis"
              :key="index"
              class="flex flex-col items-center w-64px">
              <span class="text-32px">{{ item.emoji }}</span>
              <span class="text-11px text-[--hula-text-tertiary] mt-4px break-all text-center">
                {{ item.description }}
              </span>
            </div>
          </div>

          <div v-else class="w-full mb-16px py-24px text-14px text-[--hula-text-tertiary]">
            {{ t('verification.sas.waiting') }}
          </div>

          <div class="w-full flex gap-12px">
            <van-button class="flex-1" type="danger" plain @click="onMismatch">
              {{ t('verification.sas.mismatch') }}
            </van-button>
            <van-button class="flex-1" type="primary" @click="onMatch">
              {{ t('verification.sas.match') }}
            </van-button>
          </div>
        </div>

        <!-- Step: Show QR (placeholder) -->
        <div v-else-if="step === 'showQr'" class="flex flex-col items-center text-center">
          <div
            class="w-200px h-200px rounded-12px mb-16px flex items-center justify-center bg-[--hula-surface-panel] dark:bg-[--hula-surface-dark]">
            <van-icon name="qr" size="120" color="var(--hula-text-primary)" />
          </div>
          <p class="text-14px text-[--hula-text-secondary] mb-16px">{{ t('verification.qr.show_desc') }}</p>
          <van-button block plain @click="onCancel">{{ t('verification.actions.cancel') }}</van-button>
        </div>

        <!-- Step: Scan QR (placeholder) -->
        <div v-else-if="step === 'scanQr'" class="flex flex-col items-center text-center">
          <div
            class="w-200px h-200px rounded-12px mb-16px flex items-center justify-center bg-[--hula-surface-panel] dark:bg-[--hula-surface-dark] border border-dashed border-[--line-color]">
            <van-icon name="scan" size="80" color="var(--hula-text-secondary)" />
          </div>
          <p class="text-14px text-[--hula-text-secondary] mb-16px">{{ t('verification.qr.scan_desc') }}</p>
          <van-button block plain @click="onCancel">{{ t('verification.actions.cancel') }}</van-button>
        </div>

        <!-- Step: Success -->
        <div v-else-if="step === 'success'" class="flex flex-col items-center text-center py-24px">
          <van-icon name="success" size="64" color="var(--hula-color-success-500)" />
          <h3 class="text-16px font-medium mt-12px mb-8px">
            {{ t('verification.result.success_title') }}
          </h3>
          <p class="text-14px text-[--hula-text-secondary] mb-24px">
            {{ t('verification.result.success_desc') }}
          </p>
          <van-button type="primary" block @click="onClose">{{ t('verification.actions.close') }}</van-button>
        </div>

        <!-- Step: Rejected -->
        <div v-else-if="step === 'rejected'" class="flex flex-col items-center text-center py-24px">
          <van-icon name="warning-o" size="64" color="var(--hula-color-danger-500)" />
          <h3 class="text-16px font-medium mt-12px mb-8px">
            {{ t('verification.result.rejected_title') }}
          </h3>
          <p class="text-14px text-[--hula-text-secondary] mb-24px">
            {{ t('verification.result.rejected_desc') }}
          </p>
          <van-button type="primary" block @click="onClose">{{ t('verification.actions.close') }}</van-button>
        </div>

        <!-- Step: Cancelled -->
        <div v-else-if="step === 'cancelled'" class="flex flex-col items-center text-center py-24px">
          <van-icon name="close" size="64" color="var(--hula-text-tertiary)" />
          <h3 class="text-16px font-medium mt-12px mb-8px">
            {{ t('verification.result.cancelled_title') }}
          </h3>
          <p class="text-14px text-[--hula-text-secondary] mb-24px">
            {{ t('verification.result.cancelled_desc') }}
          </p>
          <van-button type="primary" block @click="onClose">{{ t('verification.actions.close') }}</van-button>
        </div>

        <!-- Step: Failed -->
        <div v-else-if="step === 'failed'" class="flex flex-col items-center text-center py-24px">
          <van-icon name="warning-o" size="64" color="var(--hula-color-danger-500)" />
          <h3 class="text-16px font-medium mt-12px mb-8px">
            {{ t('verification.result.failed_title') }}
          </h3>
          <p class="text-14px text-[--hula-text-secondary] mb-8px">
            {{ t('verification.result.failed_desc') }}
          </p>
          <p v-if="errorMessage" class="text-12px text-[--hula-color-danger-500] mb-24px break-all px-12px">
            {{ errorMessage }}
          </p>
          <van-button type="primary" block @click="onClose">{{ t('verification.actions.close') }}</van-button>
        </div>
      </template>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDeviceVerifyFlow, type VerificationStep } from '@/composables/encryption/useDeviceVerifyFlow'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileDeviceVerifyDialog')
const { t } = useI18n()

defineOptions({
  name: 'MobileDeviceVerifyDialog'
})

const props = defineProps<{
  visible: boolean
  userId?: string
  deviceId?: string
  transactionId?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'verified'): void
  (e: 'cancelled'): void
}>()

const flow = useDeviceVerifyFlow({
  userId: props.userId,
  deviceId: props.deviceId,
  transactionId: props.transactionId
})

const { step, loading, emojis, pendingRequests, errorMessage } = flow

// Watch step changes to emit terminal events (verified / cancelled).
watch(step, (newStep) => {
  if (newStep === 'success') {
    emit('verified')
  } else if (newStep === 'cancelled' || newStep === 'rejected') {
    emit('cancelled')
  }
})

// When the dialog opens, reset flow state and refresh pending requests.
watch(
  () => props.visible,
  (open) => {
    if (open) {
      flow.reset()
      flow.refreshPendingRequests().catch((err) => {
        logger.warn('refreshPendingRequests failed', err)
      })
    }
  },
  { immediate: true }
)

function onUpdateVisible(value: boolean) {
  emit('update:visible', value)
}

function onClose() {
  emit('update:visible', false)
}

async function onStartSas() {
  await flow.startSas(props.userId, props.deviceId)
}

async function onAccept(transactionId: string) {
  await flow.acceptVerification(transactionId)
}

async function onDecline(transactionId: string) {
  // Decline = cancel the inbound request with reason "declined"
  flow.currentTransactionId.value = transactionId
  await flow.cancelVerification('declined')
  await flow.refreshPendingRequests().catch((err) => {
    logger.warn('refreshPendingRequests failed', err)
  })
}

async function onMatch() {
  await flow.confirmSas(true)
}

async function onMismatch() {
  await flow.confirmSas(false)
}

async function onCancel() {
  await flow.cancelVerification('user_cancelled')
}

function onShowQr() {
  // Simplified: jump to show QR placeholder step via composable state.
  // The composable does not expose a dedicated showQr transition, so set step directly.
  step.value = 'showQr' as VerificationStep
}

function onScanQr() {
  step.value = 'scanQr' as VerificationStep
}
</script>

<style scoped>
.mobile-device-verify-dialog {
  background-color: var(--center-bg-color);
  color: var(--text-color);
}
</style>
