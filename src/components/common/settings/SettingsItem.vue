<script setup lang="ts">
/**
 * 设置项组件
 * 用于显示单个设置项，支持标题、描述和操作区域
 */
import { NListItem, NThing, NSpace } from 'naive-ui'

interface Props {
  title: string
  description?: string
  disabled?: boolean
}

defineProps<Props>()
</script>

<template>
  <n-list-item :class="{ 'settings-item-disabled': disabled }">
    <n-thing>
      <template #header>
        <span class="settings-item-title">{{ title }}</span>
      </template>
      <template #description>
        <span v-if="description" class="settings-item-description">{{ description }}</span>
      </template>
      <template #action>
        <n-space align="center">
          <slot name="action"></slot>
        </n-space>
      </template>
      <template v-if="$slots.default" #default>
        <slot></slot>
      </template>
    </n-thing>
  </n-list-item>
</template>

<style scoped>
.settings-item-title {
  font-size: 14px;
  font-weight: 500;
}

.settings-item-description {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.settings-item-disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
