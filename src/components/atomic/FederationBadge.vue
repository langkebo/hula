<template>
  <span
    class="federation-badge inline-flex items-center gap-[--tjg-space-1]"
    :class="[`federation-badge--${size}`, { 'federation-badge--local': isLocal }]"
    :title="title"
    data-testid="federation-badge">
    <svg
      v-if="showIcon"
      class="federation-badge__icon"
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
    <span v-if="showLabel" class="federation-badge__label">
      {{ label || t('room.discovery.federated') }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

/**
 * Matrix 联邦身份徽章组件
 *
 * 用于标识房间或用户是否来自联邦（远端服务器）
 *
 * @example
 * ```vue
 * <FederationBadge size="sm" :is-local="false" />
 * <FederationBadge size="xs" show-label label="跨域" />
 * ```
 */

const props = withDefaults(
  defineProps<{
    /** 大小: xs | sm | md */
    size?: 'xs' | 'sm' | 'md'
    /** 是否本地服务器 */
    isLocal?: boolean
    /** 自定义标签文本 */
    label?: string
    /** 是否显示图标 */
    showIcon?: boolean
    /** 是否显示文字标签 */
    showLabel?: boolean
    /** title 属性 */
    title?: string
  }>(),
  {
    size: 'sm',
    isLocal: false,
    label: undefined,
    showIcon: true,
    showLabel: true,
    title: undefined
  }
)

const label = computed(() => {
  if (props.label) return props.label
  return props.isLocal ? t('room.discovery.local') : t('room.discovery.federated')
})
</script>

<style scoped lang="scss">
/* ==================== 联邦身份徽章 ==================== */
.federation-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--tjg-space-1);
  padding: 1px 6px;
  border-radius: var(--tjg-radius-xs);
  font-size: var(--tjg-font-size-xs);
  line-height: 1.4;
  white-space: nowrap;
  transition: background-color 0.15s ease;

  /* 远端服务器（默认） */
  background: var(--tjg-federation-badge-bg, rgba(24, 144, 255, 0.08));
  color: var(--tjg-federation-badge-text, var(--tjg-color-info-600));
  border: 1px solid var(--tjg-federation-badge-border, rgba(24, 144, 255, 0.2));
}

/* 本地服务器变体 */
.federation-badge--local {
  background: var(--tjg-federation-local-bg, rgba(82, 196, 26, 0.08));
  color: var(--tjg-federation-local-text, var(--tjg-color-success-600));
  border-color: var(--tjg-federation-local-border, rgba(82, 196, 26, 0.2));
}

/* 尺寸变体 */
.federation-badge--xs {
  padding: 0 4px;
  font-size: 10px;
  gap: 3px;
}

.federation-badge--xs .federation-badge__icon {
  width: 10px;
  height: 10px;
}

.federation-badge--sm {
  padding: 1px 6px;
  font-size: var(--tjg-font-size-xs);
}

.federation-badge--md {
  padding: 2px 8px;
  font-size: var(--tjg-font-size-sm);
  gap: 4px;
}
</style>
