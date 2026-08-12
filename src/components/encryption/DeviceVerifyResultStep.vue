<template>
  <div class="flex flex-col items-center text-center py-24px">
    <template v-if="status === 'success'">
      <div class="mb-16px text-[var(--tjg-color-success-500)]">
        <Icon icon="mdi:check-circle" :width="64" />
      </div>
      <h3 class="text-[var(--text-lg)] font-medium color-[var(--tjg-text-primary)] mb-8px">
        {{ t('setting.device_verify_dialog.success_title') }}
      </h3>
      <p class="text-[var(--text-sm)] color-[var(--tjg-text-secondary)] mb-24px">
        {{ t('setting.device_verify_dialog.success_desc') }}
      </p>
    </template>
    <template v-else>
      <div class="mb-16px text-[var(--tjg-color-danger-500)]">
        <Icon icon="mdi:alert-circle" :width="64" />
      </div>
      <h3 class="text-[var(--text-lg)] font-medium color-[var(--tjg-text-primary)] mb-8px">
        {{ t('setting.device_verify_dialog.rejected_title') }}
      </h3>
      <p class="text-[var(--text-sm)] color-[var(--tjg-text-secondary)] mb-8px">
        {{ t('setting.device_verify_dialog.rejected_desc') }}
      </p>
      <p class="text-[var(--text-xs)] color-[var(--tjg-color-danger-500)] mb-24px">
        {{ t('setting.device_verify_dialog.rejected_hint') }}
      </p>
    </template>
    <n-button :type="status === 'success' ? 'primary' : 'default'" class="w-120px" @click="emit('close')">
      {{ t('common.close') }}
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'DeviceVerifyResultStep' })

defineProps<{
  status: 'success' | 'rejected'
}>()

const emit = defineEmits<(e: 'close') => void>()

const { t } = useI18n()
</script>
