<template>
  <n-flex align="center" :size="6" :role="isError ? 'alert' : undefined">
    <svg class="size-14px" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 48" aria-hidden="true">
      <path
        :data-follow-stroke="strokeColor"
        :data-follow-fill="fillColor"
        stroke-linejoin="round"
        stroke-width="4"
        :stroke="strokeColor"
        :fill="fillColor"
        d="M24 44a19.937 19.937 0 0 0 14.142-5.858A19.937 19.937 0 0 0 44 24a19.938 19.938 0 0 0-5.858-14.142A19.937 19.937 0 0 0 24 4 19.938 19.938 0 0 0 9.858 9.858 19.938 19.938 0 0 0 4 24a19.937 19.937 0 0 0 5.858 14.142A19.938 19.938 0 0 0 24 44Z" />
      <path
        v-if="!isError"
        :data-follow-stroke="strokeColor"
        stroke-linejoin="round"
        stroke-linecap="round"
        stroke-width="4"
        :stroke="strokeColor"
        d="m16 24 6 6 12-12" />
      <g v-else :data-follow-stroke="strokeColor">
        <path stroke-linecap="round" stroke-width="4" :stroke="strokeColor" d="M24 14v14" />
        <circle cx="24" cy="34" r="2" :fill="strokeColor" />
      </g>
    </svg>
    <p :id="id" :class="['text-12px', textClass]">
      {{ message }}
    </p>
  </n-flex>
</template>

<script setup lang="ts">
const props = defineProps<{
  value: string
  message?: string
  validator?: (value: string) => boolean
  /** 显式语气：error 渲染为行内错误态；success 强制成功态；缺省沿用校验结果 */
  tone?: 'success' | 'error'
  /** 文案节点 id，供表单 aria-describedby 关联 */
  id?: string
}>()

const successStrokeColor = 'var(--tjg-color-primary-500)'
const neutralStrokeColor = 'var(--tjg-text-tertiary)'
const errorStrokeColor = 'var(--tjg-color-danger-500)'
const successFillColor = 'var(--tjg-color-primary-100)'
const neutralFillColor = 'var(--tjg-surface-panel)'
const errorFillColor = 'var(--tjg-color-danger-100)'

const isValid = computed(() => {
  if (props.tone === 'success') return true
  return props.validator ? props.validator(props.value) : true
})
const isError = computed(() => props.tone === 'error')
const strokeColor = computed(() => {
  if (isError.value) return errorStrokeColor
  return isValid.value ? successStrokeColor : neutralStrokeColor
})
const fillColor = computed(() => {
  if (isError.value) return errorFillColor
  return isValid.value ? successFillColor : neutralFillColor
})
const textClass = computed(() => {
  if (isError.value) return 'color-[--tjg-color-danger-600]'
  return isValid.value ? 'color-[--tjg-text-primary]' : 'color-[--tjg-text-tertiary]'
})
</script>
