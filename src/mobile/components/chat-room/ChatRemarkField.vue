<template>
  <div class="w-full flex flex-col gap-15px rounded-10px">
    <div class="ps-15px text-14px">
      <span class="dark:text-white">{{ t('mobile_chat_setting.remark') }}</span>
      <span class="text-[--tjg-text-secondary] ml-1">
        {{ t('mobile_chat_setting.remar_kprivate_visible') }}
      </span>
    </div>
    <van-field
      :model-value="modelValue"
      :placeholder="t('mobile_chat_setting.input.remark')"
      class="rounded-10px"
      @update:model-value="$emit('update:modelValue', String($event))"
      @blur="$emit('blur')" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * 移动端「备注」输入块。
 *
 * 从 `ChatSetting.vue` 抽出：该文件已超 800 行红线且 `check:file-size` 对基线内文件
 * 零容忍增长 —— 新增功能必须以「搬走等量代码」为代价。
 *
 * ⚠️ 与紧邻的「对方看到的我」方向相反：备注是**我**给对方起的名（仅自己可见）。
 */
defineOptions({ name: 'ChatRemarkField' })

defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [string]; blur: [] }>()

const { t } = useI18n()
</script>
