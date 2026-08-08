<template>
  <div class="admin-stat-card">
    <div class="admin-stat-card__icon" :style="iconStyle">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        :stroke-width="1.5"
        aria-hidden="true"
        focusable="false">
        <path :d="icon" />
      </svg>
    </div>
    <div class="admin-stat-card__body">
      <span class="admin-stat-card__value">{{ displayValue }}</span>
      <span class="admin-stat-card__label">{{ label }}</span>
      <div v-if="trend" class="admin-stat-card__trend" :class="trendClass">
        <svg
          class="admin-stat-card__trend-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          :stroke-width="1.5"
          aria-hidden="true"
          focusable="false">
          <path :d="trendArrowPath" />
        </svg>
        <span class="admin-stat-card__trend-value">{{ trend.value }}</span>
        <span v-if="trend.label" class="admin-stat-card__trend-label">{{ trend.label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type TrendDirection = 'up' | 'down' | 'neutral'

interface StatTrend {
  /** 趋势数值文本，如 "12%" */
  value: string | number
  /** 趋势方向 */
  direction: TrendDirection
  /** 附加说明文案 */
  label?: string
}

const props = withDefaults(
  defineProps<{
    /** 统计项标签（已由父组件翻译） */
    label: string
    /** 统计数值 */
    value: string | number
    /** SVG path data，图标线条 */
    icon: string
    /** 图标背景色（CSS 颜色或 var）；默认品牌色 */
    color?: string
    /** 可选趋势信息 */
    trend?: StatTrend
  }>(),
  {
    color: 'var(--tjg-color-primary-500)'
  }
)

const displayValue = computed(() => props.value)

const iconStyle = computed(() => ({
  background: props.color
}))

const trendClass = computed(() => ({
  'admin-stat-card__trend--up': props.trend?.direction === 'up',
  'admin-stat-card__trend--down': props.trend?.direction === 'down'
}))

const trendArrowPath = computed(() => {
  switch (props.trend?.direction) {
    case 'up':
      return 'M5 15l7-7 7 7'
    case 'down':
      return 'M19 9l-7 7-7-7'
    default:
      return 'M5 12h14'
  }
})
</script>

<style scoped lang="scss">
.admin-stat-card {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-4);
  padding: var(--tjg-space-5);
  background: var(--tjg-admin-card-bg);
  border-radius: var(--tjg-radius-lg);
  box-shadow: var(--tjg-admin-card-shadow);
  transition:
    transform var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard),
    box-shadow var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--tjg-admin-card-shadow-hover);
  }
}

.admin-stat-card__icon {
  width: 48px;
  height: 48px;
  border-radius: var(--tjg-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--tjg-text-inverse);

  svg {
    width: 24px;
    height: 24px;
  }
}

.admin-stat-card__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.admin-stat-card__value {
  font-size: var(--tjg-font-size-3xl);
  font-weight: var(--tjg-font-weight-bold);
  color: var(--tjg-admin-stat-value-color);
  line-height: var(--tjg-line-height-tight);
}

.admin-stat-card__label {
  font-size: var(--tjg-font-size-md);
  color: var(--tjg-text-quaternary);
  margin-top: 2px;
}

.admin-stat-card__trend {
  display: inline-flex;
  align-items: center;
  gap: var(--tjg-space-1);
  margin-top: var(--tjg-space-1);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);

  &--up {
    color: var(--tjg-color-success-500);
  }

  &--down {
    color: var(--tjg-color-danger-500);
  }
}

.admin-stat-card__trend-icon {
  width: 14px;
  height: 14px;
}

.admin-stat-card__trend-label {
  color: var(--tjg-text-quaternary);
}

@media (max-width: 640px) {
  .admin-stat-card {
    padding: var(--tjg-space-4);
  }

  .admin-stat-card__value {
    font-size: var(--tjg-font-size-2xl);
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-stat-card {
    transition: none;

    &:hover {
      transform: none;
    }
  }
}
</style>
