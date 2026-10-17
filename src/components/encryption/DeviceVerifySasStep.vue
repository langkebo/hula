<template>
  <div class="flex flex-col items-center text-center">
    <!-- 等待对方接受：SAS 未就绪时**不得**展示任何可比对内容，也不允许确认 -->
    <div
      v-if="!sasReady"
      class="w-full bg-[var(--tjg-surface-panel)] border border-[var(--tjg-border-default)] rounded-8px p-24px mb-24px flex flex-col items-center gap-12px">
      <n-spin size="small" />
      <span class="text-[var(--text-sm)] color-[var(--tjg-text-secondary)]">
        {{ t('setting.encryption.device_verify_dialog.sas_waiting') }}
      </span>
    </div>

    <template v-else>
      <div
        class="w-full bg-[var(--tjg-surface-panel)] border border-[var(--tjg-border-default)] rounded-8px p-24px mb-16px">
        <div class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)] mb-16px">
          {{ t('setting.encryption.device_verify_dialog.sas_label') }}
        </div>

        <div v-if="emojis.length > 0" class="grid grid-cols-4 gap-12px">
          <div v-for="(item, index) in emojis" :key="index" class="flex flex-col items-center gap-4px">
            <span class="text-[28px] leading-none">{{ item.emoji }}</span>
            <span class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)]">{{ item.description }}</span>
          </div>
        </div>

        <div v-else class="text-[var(--text-sm)] color-[var(--tjg-color-warning-500)]">
          {{ t('setting.encryption.device_verify_dialog.sas_none') }}
        </div>

        <div v-if="decimal.length > 0" class="mt-16px">
          <div class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)] mb-8px">
            {{ t('setting.encryption.device_verify_dialog.sas_decimal_label') }}
          </div>
          <div class="font-mono text-[var(--text-lg)] font-bold tracking-wider color-[var(--tjg-text-primary)]">
            {{ decimal.join(' ') }}
          </div>
        </div>
      </div>

      <label class="w-full flex items-start gap-8px mb-20px text-left cursor-pointer">
        <input
          type="checkbox"
          class="mt-2px"
          :checked="sasConfirmed"
          data-testid="sas-confirm-checkbox"
          @change="emit('update:sasConfirmed', ($event.target as HTMLInputElement).checked)" />
        <span class="text-[var(--text-sm)] color-[var(--tjg-text-secondary)]">
          {{ t('setting.encryption.device_verify_dialog.sas_confirm_checkbox') }}
        </span>
      </label>
    </template>

    <!-- Cancel with reason -->
    <div
      v-if="showCancelReason"
      class="w-full bg-[var(--tjg-surface-panel)] border border-[var(--tjg-border-default)] rounded-8px p-16px mb-16px">
      <div class="text-[var(--text-xs)] color-[var(--tjg-text-tertiary)] mb-8px">
        {{ t('setting.encryption.device_verify_dialog.cancel_reason_label') }}
      </div>
      <n-input
        :value="cancelReason"
        size="small"
        :placeholder="t('setting.encryption.device_verify_dialog.cancel_reason_placeholder')"
        @update:value="emit('update:cancelReason', $event)" />
    </div>
    <div class="w-full flex justify-end gap-12px">
      <n-button v-if="!showCancelReason" type="default" ghost @click="emit('update:showCancelReason', true)">
        {{ t('setting.encryption.device_verify_dialog.cancel_verification') }}
      </n-button>
      <template v-else>
        <n-button @click="emit('hide-cancel-reason')">
          {{ t('common.cancel') }}
        </n-button>
        <n-button type="error" @click="emit('cancel-with-reason')">
          {{ t('setting.encryption.device_verify_dialog.cancel_verification') }}
        </n-button>
      </template>
      <n-button v-if="!showCancelReason" type="error" @click="emit('reject')" ghost>
        {{ t('setting.encryption.device_verify_dialog.mismatch') }}
      </n-button>
      <!-- 只有「SAS 就绪 + 用户已勾选一致」才允许确认；按钮禁用是安全边界，不只是 UX -->
      <n-button v-if="!showCancelReason" type="primary" :disabled="!canConfirm" @click="emit('confirm')">
        {{ t('setting.encryption.device_verify_dialog.confirm_match') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInput, NSpin } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'DeviceVerifySasStep' })

const props = defineProps<{
  sasReady: boolean
  emojis: Array<{ emoji: string; description: string }>
  decimal: number[]
  sasConfirmed: boolean
  showCancelReason: boolean
  cancelReason: string
}>()

const emit = defineEmits<{
  (e: 'update:sasConfirmed', value: boolean): void
  (e: 'update:showCancelReason', value: boolean): void
  (e: 'update:cancelReason', value: string): void
  (e: 'hide-cancel-reason'): void
  (e: 'cancel-with-reason'): void
  (e: 'reject'): void
  (e: 'confirm'): void
}>()

const { t } = useI18n()

const canConfirm = computed(() => props.sasReady && props.sasConfirmed)
</script>
