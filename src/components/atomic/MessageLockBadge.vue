<template>
  <span
    class="msg-lock-badge"
    :class="[`msg-lock-badge--${trustLevel}`, { 'msg-lock-badge--ring': trustLevel === 'risk' }]"
    :title="title"
    data-testid="message-lock-badge">
    <!-- 已验证：绿锁 -->
    <svg
      v-if="trustLevel === 'verified'"
      class="msg-lock-badge__icon"
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="currentColor"
      aria-hidden="true">
      <path
        d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7c0-2.757-2.243-5-5-5zm0 2c1.654 0 3 1.346 3 3v3H9V7c0-1.654 1.346-3 3-3zm0 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
    </svg>

    <!-- 未验证：灰锁 -->
    <svg
      v-else-if="trustLevel === 'unverified'"
      class="msg-lock-badge__icon"
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>

    <!-- 风险：红锁 + 外环 -->
    <svg
      v-else-if="trustLevel === 'risk'"
      class="msg-lock-badge__icon"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="var(--tjg-status-encryption-risk-ring)" />
      <rect x="5" y="11" width="14" height="10" rx="2" fill="var(--tjg-status-encryption-risk)" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="var(--tjg-status-encryption-risk)" />
    </svg>

    <span v-if="showLabel && label" class="msg-lock-badge__label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 消息加密信任状态徽章
 *
 * 三态信任模型：
 * - verified: 绿锁 - 端到端加密已验证
 * - unverified: 灰锁 - 未完全验证
 * - risk: 红锁 - 存在风险
 *
 * @example
 * ```vue
 * <MessageLockBadge trust-level="verified" />
 * <MessageLockBadge trust-level="risk" show-label />
 * ```
 */

export type TrustLevel = 'verified' | 'unverified' | 'risk'

const props = withDefaults(
  defineProps<{
    /** 信任等级 */
    trustLevel?: TrustLevel
    /** 是否显示标签 */
    showLabel?: boolean
    /** 自定义标签 */
    label?: string
    /** title 提示 */
    title?: string
  }>(),
  {
    trustLevel: 'unverified',
    showLabel: false,
    label: undefined,
    title: undefined
  }
)

const label = computed(() => {
  if (props.label) return props.label
  const labels = {
    verified: 'E2E 已验证',
    unverified: '未验证',
    risk: '存在风险'
  }
  return labels[props.trustLevel]
})
</script>

<style scoped lang="scss">
/* ==================== 消息锁徽章 ==================== */
.msg-lock-badge {
  // 定位上下文：`.msg-lock-badge--ring::after` 使用 position: absolute，
  // 若根元素不是定位祖先，外环会逃逸到最近的定位祖先（消息气泡 / 视口）上
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: var(--tjg-font-size-xs);
  line-height: 1;

  // 三态配色必须挂在**根元素**的修饰类上，由 svg 的 currentColor 继承。
  // 若挂在 `__icon` 上会编译成复合选择器
  // `.msg-lock-badge__icon.msg-lock-badge--verified` —— 两个类不在同一元素，
  // DOM 中永不共存，配色会静默失效。
  &--verified {
    color: var(--tjg-status-encryption-verified, var(--tjg-color-success-500));
  }

  &--unverified {
    color: var(--tjg-status-encryption-unverified, var(--tjg-text-disabled));
  }

  &--risk {
    color: var(--tjg-status-encryption-risk, var(--tjg-color-danger-500));
  }
}

.msg-lock-badge__icon {
  flex-shrink: 0;
  // 故意不声明 color：svg 通过 currentColor 继承根元素的三态配色，
  // 此处设色会遮蔽三种状态之间的颜色差异
}

.msg-lock-badge__label {
  color: var(--tjg-text-tertiary);
  white-space: nowrap;
}

/* 风险状态外环 */
.msg-lock-badge--ring::after {
  content: '';
  position: absolute;
  inset: -2px;
  border: 1px solid var(--tjg-status-encryption-risk-ring, rgba(255, 77, 79, 0.35));
  border-radius: var(--tjg-radius-full);
  pointer-events: none;
}
</style>
