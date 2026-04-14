<script setup lang="ts">
/**
 * 设置下拉选择组件
 * 用于枚举类型的设置项
 */
import { computed } from 'vue'
import { NSelect, type SelectOption } from 'naive-ui'
import SettingsItem from './SettingsItem.vue'

interface Props {
  title: string
  description?: string
  modelValue: string | number | null
  options: SelectOption[]
  disabled?: boolean
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  disabled: false,
  placeholder: '请选择'
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number | null]
  change: [value: string | number | null]
}>()

const value = computed({
  get: () => props.modelValue,
  set: (val: string | number | null) => {
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
      <n-select
        v-model:value="value"
        :options="options"
        :disabled="disabled"
        :placeholder="placeholder"
        style="min-width: 150px"
      />
    </template>
  </SettingsItem>
</template>
