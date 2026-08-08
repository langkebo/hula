<template>
  <div class="error-state" :class="{ 'error-state--compact': compact }" role="alert" aria-live="assertive">
    <div class="error-state__icon" :class="{ 'error-state__icon--compact': compact }">
      <!-- generic-error: 警告三角 + 感叹号 -->
      <svg
        v-if="illustration === 'generic-error'"
        data-illustration="generic-error"
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        stroke="var(--tjg-color-danger-500)"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round">
        <path d="M24 6L4 40h40L24 6z" />
        <line x1="24" y1="18" x2="24" y2="30" />
        <circle cx="24" cy="35" r="1" fill="currentColor" stroke="none" />
      </svg>
      <!-- network-error: 断开的连接 / 无信号 -->
      <svg
        v-else-if="illustration === 'network-error'"
        data-illustration="network-error"
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        stroke="var(--tjg-color-danger-500)"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round">
        <path d="M8 30c4-6 10-9 16-9s12 3 16 9" />
        <path d="M14 36c2.5-3 6-5 10-5s7.5 2 10 5" />
        <line x1="6" y1="10" x2="42" y2="42" />
        <circle cx="24" cy="42" r="1.5" fill="currentColor" stroke="none" />
      </svg>
      <!-- server-error: 服务器机架 + 斜杠 -->
      <svg
        v-else
        data-illustration="server-error"
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        stroke="var(--tjg-color-danger-500)"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round">
        <rect x="8" y="10" width="32" height="10" rx="2" />
        <rect x="8" y="28" width="32" height="10" rx="2" />
        <circle cx="14" cy="15" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="14" cy="33" r="1.5" fill="currentColor" stroke="none" />
        <line x1="6" y1="6" x2="42" y2="42" />
      </svg>
    </div>
    <p v-if="title" class="error-state__title">{{ title }}</p>
    <p v-if="message" class="error-state__message">{{ message }}</p>
    <div v-if="retryText || $slots.actions" class="error-state__actions">
      <button
        v-if="retryText"
        type="button"
        class="error-state__retry-btn"
        data-testid="error-retry"
        @click="emit('retry')">
        {{ retryText }}
      </button>
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'ErrorState' })

const emit = defineEmits<{
  /** 点击 retryText 渲染的重试按钮时触发 */
  retry: []
}>()

withDefaults(
  defineProps<{
    /** 错误标题（必填） */
    title: string
    /** 错误描述（可选） */
    message?: string
    /** 重试按钮文案，提供时渲染按钮并在点击时 emit retry */
    retryText?: string
    /** 紧凑模式（默认 false） */
    compact?: boolean
    /** 内联 SVG 错误插图类型 */
    illustration?: 'generic-error' | 'network-error' | 'server-error'
  }>(),
  {
    message: '',
    retryText: '',
    compact: false,
    illustration: 'generic-error'
  }
)
</script>

<style scoped lang="scss">
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 24px;
  text-align: center;
  user-select: none;
  animation: error-fade-in var(--tjg-motion-duration-slow) var(--tjg-motion-ease-enter);
}

.error-state--compact {
  gap: 4px;
  padding: 16px 12px;
}

.error-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 999px;
  color: var(--tjg-color-danger-500);
  background: color-mix(in srgb, var(--tjg-color-danger-500) 10%, transparent);
}

.error-state__icon--compact {
  width: 40px;
  height: 40px;
}

.error-state__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--tjg-text-secondary);
  margin: 0 0 6px;
}

.error-state__message {
  font-size: 13px;
  line-height: 1.5;
  color: var(--tjg-text-tertiary);
  max-width: 280px;
  margin: 0;
}

.error-state__actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}

.error-state__retry-btn {
  appearance: none;
  border: 0;
  border-radius: 8px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 500;
  color: var(--tjg-text-inverse);
  background: var(--tjg-color-primary-500);
  cursor: pointer;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    transform var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-color-primary-600);
  }

  &:active {
    transform: scale(var(--tjg-motion-scale-active));
  }
}

@keyframes error-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .error-state {
    animation: none;
  }

  .error-state__retry-btn {
    transition: none;

    &:active {
      transform: none;
    }
  }
}
</style>
