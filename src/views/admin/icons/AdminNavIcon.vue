<template>
  <svg
    :class="sizeClass"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    aria-hidden="true"
    focusable="false">
    <path :d="path" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { type AdminNavIconName, adminNavIcons } from './adminNavIcons'

const props = withDefaults(
  defineProps<{
    /** 图标名称，对应 adminNavIcons 的 key */
    name: AdminNavIconName
    /** 尺寸，对应 UnoCSS size 工具类，默认 18px */
    size?: '16px' | '18px' | '20px' | '24px'
  }>(),
  {
    size: '18px'
  }
)

const path = computed(() => adminNavIcons[props.name])
const sizeClass = computed(() => `size-${props.size}`)
</script>
