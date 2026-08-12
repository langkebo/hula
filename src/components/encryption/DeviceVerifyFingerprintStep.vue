<template>
  <div class="flex flex-col items-center text-center">
    <div
      class="w-full bg-[var(--tjg-surface-panel)] border border-[var(--tjg-border-default)] rounded-8px p-24px mb-24px">
      <div class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)] mb-16px">
        {{ t('setting.device_verify_dialog.fingerprint_label') }}
      </div>
      <div
        class="flex flex-wrap justify-center gap-8px font-mono text-[var(--text-lg)] font-bold tracking-wider color-[var(--tjg-text-primary)]">
        <div
          v-for="(chunk, index) in fingerprintChunks"
          :key="index"
          class="bg-[var(--tjg-surface-search)] px-8px py-4px rounded-6px">
          {{ chunk }}
        </div>
      </div>
      <div
        class="mt-16px flex items-center justify-center gap-4px text-[var(--text-xs)] color-[var(--tjg-color-warning-500)] bg-[var(--tjg-color-warning-100)] py-8px px-12px rounded-6px">
        <Icon icon="mdi:information" :width="16" />
        <span>{{ t('setting.device_verify_dialog.fingerprint_hint') }}</span>
      </div>
    </div>
    <div class="text-[var(--text-sm)] color-[var(--tjg-text-secondary)] mb-24px">
      <p>{{ t('setting.device_verify_dialog.match_question') }}</p>
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
      <n-button v-if="!showCancelReason" type="error" @click="emit('reject')" ghost>
        {{ t('setting.device_verify_dialog.mismatch') }}
      </n-button>
      <n-button v-if="!showCancelReason" type="primary" @click="emit('confirm')">
        {{ t('setting.device_verify_dialog.confirm_match') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NInput } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'DeviceVerifyFingerprintStep' })

defineProps<{
  fingerprintChunks: string[]
  showCancelReason: boolean
  cancelReason: string
}>()

const emit = defineEmits<{
  (e: 'update:showCancelReason', value: boolean): void
  (e: 'update:cancelReason', value: string): void
  (e: 'hide-cancel-reason'): void
  (e: 'cancel-with-reason'): void
  (e: 'reject'): void
  (e: 'confirm'): void
}>()

const { t } = useI18n()
</script>
