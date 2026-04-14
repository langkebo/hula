<script setup lang="ts">
/**
 * 设置开关组件
 * 用于布尔值类型的设置项
 */
import { computed } from 'vue'
import { NSwitch } from 'naive-ui'
import SettingsItem from './SettingsItem.vue'

interface Props {
  title: string
  description?: string
  modelValue: boolean
  disabled?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  disabled: false,
  loading: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [value: boolean]
}>()

const value = computed({
  get: () => props.modelValue,
  set: (val: boolean) => {
    emit('update:modelValue', val)
    emit('change', val)
  }
})
</script>

<template>
  <SettingsItem
    :title="title"
    :description="description"
    :disabled="disabled"
  >
    <template #action>
      <n-switch
        v-model:value="value"
        :disabled="disabled"
        :loading="loading"
      />
    </template>
  </SettingsItem>
</template>
