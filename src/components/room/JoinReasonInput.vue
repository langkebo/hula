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
    <n-button
      v-if="showSubmit"
      type="primary"
      :disabled="!canSubmit"
      :loading="loading"
      class="join-reason-input__submit self-end"
      data-testid="join-reason-submit"
      @click="handleSubmit">
      {{ t('room.discovery.preview_join') }}
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    loading?: boolean
    /** 是否显示内联提交按钮（嵌入对话框时可设为 false，由对话框底栏统一触发） */
    showSubmit?: boolean
  }>(),
  {
    disabled: false,
    loading: false,
    showSubmit: true
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: [reason: string]
}>()

const { t } = useI18n()

const REASON_MAX_LENGTH = 255

const reason = computed<string>({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const canSubmit = computed(() => reason.value.trim().length > 0 && !props.disabled)

const handleSubmit = () => {
  if (!canSubmit.value) return
  emit('submit', reason.value.trim())
}
</script>
