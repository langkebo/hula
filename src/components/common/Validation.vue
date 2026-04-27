<template>
  <n-flex align="center" :size="6">
    <svg class="size-14px" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 48 48">
      <path
        :data-follow-stroke="strokeColor"
        :data-follow-fill="fillColor"
        stroke-linejoin="round"
        stroke-width="4"
        :stroke="strokeColor"
        :fill="fillColor"
        d="M24 44a19.937 19.937 0 0 0 14.142-5.858A19.937 19.937 0 0 0 44 24a19.938 19.938 0 0 0-5.858-14.142A19.937 19.937 0 0 0 24 4 19.938 19.938 0 0 0 9.858 9.858 19.938 19.938 0 0 0 4 24a19.937 19.937 0 0 0 5.858 14.142A19.938 19.938 0 0 0 24 44Z" />
      <path
        :data-follow-stroke="strokeColor"
        stroke-linejoin="round"
        stroke-linecap="round"
        stroke-width="4"
        :stroke="strokeColor"
        d="m16 24 6 6 12-12" />
    </svg>
    <p :class="['text-12px', { 'color-[--hula-text-primary]': isValid, 'color-[--hula-text-tertiary]': !isValid }]">
      {{ message }}
    </p>
  </n-flex>
</template>

<script setup lang="ts">
const props = defineProps<{
  value: string
  message?: string
  validator?: (value: string) => boolean
}>()

const successStrokeColor = 'var(--hula-color-primary-500)'
const neutralStrokeColor = 'var(--hula-text-tertiary)'
const successFillColor = 'var(--hula-color-primary-100)'
const neutralFillColor = 'var(--hula-surface-panel)'

const isValid = computed(() => (props.validator ? props.validator(props.value) : true))
const strokeColor = computed(() => (isValid.value ? successStrokeColor : neutralStrokeColor))
const fillColor = computed(() => (isValid.value ? successFillColor : neutralFillColor))
</script>
