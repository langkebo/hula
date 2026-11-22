<template>
  <div :class="SHELL_CLASS" :style="{ backgroundColor: resolvedBackground }">
    <!-- 优先用本地 sprite：iconify 的 mdi 图标在未注册离线集合时会运行时联网拉取 -->
    <svg v-if="symbol" class="w-20px h-20px" :style="{ color }" aria-hidden="true">
      <use :href="`#${symbol}`" />
    </svg>
    <Icon v-else :icon="icon ?? ''" :width="20" :color="color" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

/**
 * 设置项左侧的「圆形图标壳」。
 *
 * 移动端设置页有 11 处同样的 40×40 圆底 + 20px 图标，此前每处都抄一份
 * 5 行标记（含 `:style` 底色），改配色要逐处改。抽出来只保留语义：
 * 用哪档底色、什么图标、什么前景色。
 *
 * 底色一律取设计 token 的 100 级（浅底），不接受硬编码色值。
 */
const SHELL_BACKGROUNDS = {
  success: 'var(--tjg-color-success-100)',
  info: 'var(--tjg-color-info-100)',
  warning: 'var(--tjg-color-warning-100)',
  danger: 'var(--tjg-color-danger-100)',
  beta: 'var(--tjg-color-beta-100)'
} as const

const SHELL_CLASS = 'w-40px h-40px rounded-full mr-12px flex items-center justify-center'

const props = defineProps<{
  /** iconify 图标名；与 `symbol` 二选一（`symbol` 优先） */
  icon?: string
  /** 本地 iconpark sprite 的 symbol id（如 `lock`），不联网 */
  symbol?: string
  /** 图标前景色（取 token） */
  color: string
  /** 底色档位；与 `background` 二选一 */
  shell?: keyof typeof SHELL_BACKGROUNDS
  /** 直接指定底色，用于配置驱动的条目（高级设置列表） */
  background?: string
}>()

const resolvedBackground = computed(() => props.background ?? SHELL_BACKGROUNDS[props.shell ?? 'info'])
</script>
