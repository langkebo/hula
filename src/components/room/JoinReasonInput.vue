<template>
  <div class="join-reason-input flex flex-col gap-[--tjg-space-2]">
    <n-input
      v-model:value="reason"
      type="textarea"
      :autosize="{ minRows: 2, maxRows: 4 }"
      :placeholder="t('room.discovery.reason_placeholder')"
      :disabled="disabled"
      :maxlength="REASON_MAX_LENGTH"
      data-testid="join-reason-textarea" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
  }>(),
  {
    disabled: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const { t } = useI18n()

const REASON_MAX_LENGTH = 255

const reason = computed<string>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})
</script>
