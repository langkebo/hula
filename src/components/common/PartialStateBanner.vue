<template>
  <div
    class="partial-state"
    :class="{ 'partial-state--compact': compact }"
    role="status"
    aria-live="polite"
    data-testid="partial-state">
    <div class="partial-state__icon">
      <!-- partial-warning: 实心三角 + 感叹号，表示主内容可用但局部缺失 -->
      <svg
        data-illustration="partial-warning"
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--tjg-color-warning-700)"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round">
        <path d="M12 3L2 20h20L12 3z" />
        <line x1="12" y1="9" x2="12" y2="14" />
        <circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none" />
      </svg>
    </div>
    <div class="partial-state__body">
      <p class="partial-state__message">{{ message }}</p>
      <p v-if="detail" class="partial-state__detail">{{ detail }}</p>
    </div>
    <div v-if="retryText || $slots.actions" class="partial-state__actions">
      <button
        v-if="retryText"
        type="button"
        class="partial-state__retry-btn"
        data-testid="partial-retry"
        @click="emit('retry')">
        {{ retryText }}
      </button>
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'PartialStateBanner' })

const emit = defineEmits<{
  /** 点击 retryText 渲染的重试按钮时触发 */
  retry: []
}>()

withDefaults(
  defineProps<{
    /** 主提示文案（必填）：说明哪部分数据不可用 */
    message: string
    /** 补充说明（可选），例如具体失败的子资源名 */
    detail?: string
    /** 重试按钮文案，提供时渲染按钮并在点击时 emit retry */
    retryText?: string
    /** 紧凑模式（默认 false） */
    compact?: boolean
  }>(),
  {
    detail: '',
    retryText: '',
    compact: false
  }
)
</script>

<style scoped lang="scss">
.partial-state {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--tjg-color-warning-500) 35%, transparent);
  border-radius: var(--tjg-radius-sm);
  background: color-mix(in srgb, var(--tjg-color-warning-500) 12%, transparent);
  animation: partial-state-fade-in var(--tjg-motion-duration-slow) var(--tjg-motion-ease-enter);
}

.partial-state--compact {
  gap: 8px;
  padding: 6px 10px;
}

.partial-state__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  height: 20px;
}

.partial-state__body {
  flex: 1 1 auto;
  min-width: 0;
}

.partial-state__message {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--tjg-text-secondary);
}

.partial-state__detail {
  margin: 2px 0 0;
  font-size: var(--tjg-font-size-sm);
  line-height: 1.5;
  color: var(--tjg-text-tertiary);
  word-break: break-all;
}

.partial-state__actions {
  display: flex;
  align-items: center;
  flex: none;
  gap: 8px;
}

.partial-state__retry-btn {
  appearance: none;
  border: 0;
  border-radius: var(--tjg-radius-xs);
  padding: 2px 6px;
  font-size: var(--tjg-font-size-sm);
  font-weight: 500;
  color: var(--tjg-color-primary-600);
  background: transparent;
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-color-primary-50);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }
}

@keyframes partial-state-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .partial-state {
    animation: none;
  }

  .partial-state__retry-btn {
    transition: none;
  }
}
</style>
