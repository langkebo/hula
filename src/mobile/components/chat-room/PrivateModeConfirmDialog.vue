<template>
  <van-dialog
    v-model:show="visible"
    :title="t('private_mode.confirm_title')"
    show-cancel-button
    :confirm-button-text="t('private_mode.confirm')"
    :cancel-button-text="t('private_mode.cancel')"
    @confirm="handleConfirm"
    @cancel="handleCancel">
    <div class="px-16px py-12px">
      <div v-for="feature in privateModeFeatures" :key="feature.title" class="flex items-start gap-8px py-6px">
        <svg class="w-20px h-20px flex-shrink-0" :class="feature.iconClass">
          <use :href="feature.icon"></use>
        </svg>
        <div>
          <div class="text-14px font-medium text-[--tjg-text-primary]">{{ feature.title }}</div>
          <div class="text-12px text-[--tjg-text-tertiary]">{{ feature.description }}</div>
        </div>
      </div>
    </div>
  </van-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePrivateMode } from '@/composables/chat/usePrivateMode'

const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ 'update:show': [val: boolean]; confirm: []; cancel: [] }>()

const { t } = useI18n()
const { privateModeFeatures, confirmPrivateMode, cancelPrivateMode } = usePrivateMode()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

const handleConfirm = () => {
  confirmPrivateMode()
  emit('confirm')
}

const handleCancel = () => {
  cancelPrivateMode()
  emit('cancel')
}
</script>
