<script setup lang="ts">
/**
 * 统一液态玻璃容器（docs/UI优化方案-v2.4.md §5.2）
 *
 * 约定：
 * - 只负责背景材质、边框与圆角，不参与布局尺寸；
 * - 不包裹滚动容器（滚动区域用纯色面板）；
 * - 颜色一律来自 `--tjg-glass-*` / 语义 token，组件内不出现颜色字面量；
 * - `variant="none"` 输出 `data-glass="off"`，用于紧急回滚与自动化断言。
 */
import { computed } from 'vue'
import { useGlassEffectStore } from '@/stores/domains/settings/glassEffect'

const props = withDefaults(
  defineProps<{
    variant?: 'panel' | 'subtle' | 'row' | 'none'
    engine?: 'auto' | 'off'
    tone?: 'nav' | 'tabbar' | 'input' | 'sheet' | 'row'
    radius?: 'surface' | 'panel' | 'sheet' | 'full'
  }>(),
  { variant: 'panel', engine: 'auto', radius: 'panel' }
)

const glass = useGlassEffectStore()

/** 折射增强三重门由 store 统一裁决，low 档不会渲染增强节点 */
const useEngine = computed(() => props.engine === 'auto' && glass.allowAdvancedRefraction)

const classes = computed(() => [
  'tj-glass',
  `tj-glass--${props.variant}`,
  props.tone ? `tj-glass--tone-${props.tone}` : '',
  `tj-glass--radius-${props.radius}`,
  // 用户关闭玻璃或 low 档时统一摘掉 backdrop-filter（纯色 + 边框兜底）
  glass.allowBackdrop ? '' : 'tj-glass--flat'
])
</script>

<template>
  <div :class="classes" :data-glass="variant === 'none' ? 'off' : 'on'" :data-tier="glass.tier">
    <div v-if="useEngine" class="tj-glass__engine" aria-hidden="true" />
    <slot />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/scss/mixins/liquid-glass' as *;

.tj-glass {
  position: relative;
  overflow: hidden;
  isolation: isolate;

  &--panel {
    @include liquid-glass-panel;
  }

  &--subtle {
    @include liquid-glass-subtle;
  }

  /* 列表行只允许纯色底，不使用 backdrop-filter（§9.2 禁用清单） */
  &--row {
    background: var(--tjg-glass-row-bg);
  }

  &--none {
    background: var(--tjg-surface-panel);
    border: 1px solid var(--tjg-border-layout-divider);
  }

  &--radius-surface {
    border-radius: var(--tjg-radius-surface);
  }

  &--radius-panel {
    border-radius: var(--tjg-radius-panel);
  }

  &--radius-sheet {
    border-radius: var(--tjg-radius-sheet);
  }

  &--radius-full {
    border-radius: var(--tjg-radius-full);
  }

  /* tone 只改底色，不改模糊与降级 */
  &--tone-nav {
    background-color: var(--tjg-glass-nav-bg);
  }

  &--tone-tabbar {
    background-color: var(--tjg-glass-tabbar-bg);
  }

  &--tone-input {
    background-color: var(--tjg-glass-input-bg);
  }

  &--tone-sheet {
    background-color: var(--tjg-glass-sheet-bg);
  }

  &--tone-row {
    background-color: var(--tjg-glass-row-bg);
  }

  /* 用户关闭玻璃 / low 档：保留底色，去掉实时模糊 */
  &--flat {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }

  &__engine {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .tj-glass {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: var(--tjg-surface-panel);
  }
}
</style>
