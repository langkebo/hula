<script setup lang="ts">
/**
 * 设置输入组件
 * 用于文本类型的设置项
 */
import { computed, ref } from 'vue'
import { NInput, NInputGroup, NButton, NIcon } from 'naive-ui'
import { Icon } from '@iconify/vue'
import SettingsItem from './SettingsItem.vue'

interface Props {
  title: string
  description?: string
  modelValue: string
  type?: 'text' | 'password' | 'textarea'
  placeholder?: string
  disabled?: boolean
  showSave?: boolean
  maxLength?: number
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  type: 'text',
  placeholder: '',
  disabled: false,
  showSave: true,
  maxLength: undefined
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
  save: [value: string]
}>()

const localValue = ref(props.modelValue)
const isEditing = ref(false)
const showPassword = ref(false)

const inputType = computed(() => {
  if (props.type === 'password') {
    return showPassword.value ? 'text' : 'password'
  }
  return props.type
})

const onInput = (val: string) => {
  localValue.value = val
  isEditing.value = val !== props.modelValue
  emit('update:modelValue', val)
}

const onSave = () => {
  emit('save', localValue.value)
  isEditing.value = false
}

const onCancel = () => {
  localValue.value = props.modelValue
  isEditing.value = false
}
</script>

<template>
  <SettingsItem
    :title="title"
    :description="description"
    :disabled="disabled"
  >
    <template #action>
      <n-input-group>
        <n-input
          v-model:value="localValue"
          :type="inputType"
          :placeholder="placeholder"
          :disabled="disabled"
          :maxlength="maxLength"
          @update:value="onInput"
        />
        <n-button
          v-if="type === 'password'"
          quaternary
          @click="showPassword = !showPassword"
        >
          <template #icon>
            <Icon :icon="showPassword ? 'mdi:eye-off' : 'mdi:eye'" />
          </template>
        </n-button>
        <template v-if="showSave && isEditing">
          <n-button type="primary" @click="onSave">
            保存
          </n-button>
          <n-button @click="onCancel">
            取消
          </n-button>
        </template>
      </n-input-group>
    </template>
  </SettingsItem>
</template>
