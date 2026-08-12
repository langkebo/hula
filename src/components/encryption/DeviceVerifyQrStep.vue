<template>
  <div class="flex flex-col items-center text-center">
    <!-- Show QR -->
    <div
      v-if="mode === 'show'"
      class="w-full bg-[var(--tjg-surface-panel)] border border-[var(--tjg-border-default)] rounded-8px p-24px mb-24px">
      <div class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)] mb-16px">
        {{ t('setting.device_verify_dialog.qr_code_label') }}
      </div>
      <n-qr-code :value="qrCodeData" :size="220" />
      <div class="mt-16px text-[var(--text-xs)] color-[var(--tjg-text-secondary)] break-all">
        {{ qrCodeData }}
      </div>
    </div>
    <!-- Scan QR -->
    <div
      v-else
      class="w-full bg-[var(--tjg-surface-panel)] border border-[var(--tjg-border-default)] rounded-8px p-24px mb-24px">
      <div class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)] mb-16px">
        {{ t('setting.device_verify_dialog.scan_qr_label') }}
      </div>
      <textarea
        :value="qrCodeToScan"
        class="w-full min-h-120px resize-none rounded-8px border border-[var(--tjg-border-default)] bg-[var(--tjg-surface-panel)] p-12px text-[var(--text-sm)] color-[var(--tjg-text-primary)]"
        :placeholder="t('setting.device_verify_dialog.scan_qr_placeholder')"
        @input="onQrInput" />
    </div>
    <div class="text-[var(--text-sm)] color-[var(--tjg-text-secondary)] mb-24px">
      <p>
        {{
          mode === 'show'
            ? t('setting.device_verify_dialog.qr_code_hint')
            : t('setting.device_verify_dialog.scan_qr_hint')
        }}
      </p>
    </div>
    <!-- Cancel with reason -->
    <div
      v-if="showCancelReason"
      class="w-full bg-[var(--tjg-surface-panel)] border border-[var(--tjg-border-default)] rounded-8px p-16px mb-16px">
      <div class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)] mb-8px">
        {{ t('setting.device_verify_dialog.cancel_reason_label') }}
      </div>
      <n-input
        :value="cancelReason"
        size="small"
        :placeholder="t('setting.device_verify_dialog.cancel_reason_placeholder')"
        @update:value="emit('update:cancelReason', $event)" />
    </div>
    <div class="w-full flex justify-end gap-12px">
      <n-button v-if="!showCancelReason" type="default" ghost @click="emit('update:showCancelReason', true)">
        {{ t('setting.device_verify_dialog.cancel_verification') }}
      </n-button>
      <template v-else>
        <n-button @click="emit('hide-cancel-reason')">
          {{ t('common.cancel') }}
        </n-button>
        <n-button type="error" @click="emit('cancel-with-reason')">
          {{ t('setting.device_verify_dialog.cancel_verification') }}
        </n-button>
      </template>
      <n-button v-if="!showCancelReason" @click="emit('cancel')">{{ t('common.cancel') }}</n-button>
      <n-button v-if="!showCancelReason" type="primary" @click="mode === 'show' ? emit('scan-qr') : emit('submit-qr')">
        {{ mode === 'show' ? t('setting.device_verify_dialog.scan_qr') : t('setting.device_verify_dialog.submit_qr') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInput, NQrCode } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'DeviceVerifyQrStep' })

defineProps<{
  mode: 'show' | 'scan'
  qrCodeData: string
  qrCodeToScan: string
  showCancelReason: boolean
  cancelReason: string
}>()

const emit = defineEmits<{
  (e: 'update:qrCodeToScan', value: string): void
  (e: 'update:showCancelReason', value: boolean): void
  (e: 'update:cancelReason', value: string): void
  (e: 'hide-cancel-reason'): void
  (e: 'cancel-with-reason'): void
  (e: 'cancel'): void
  (e: 'scan-qr'): void
  (e: 'submit-qr'): void
}>()

const { t } = useI18n()

function onQrInput(event: Event) {
  emit('update:qrCodeToScan', (event.target as HTMLTextAreaElement).value)
}
</script>
