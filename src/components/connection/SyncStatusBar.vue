<template>
  <Transition name="sync-status-fade">
    <div v-if="shouldShow" class="sync-status-bar" role="status" :aria-label="ariaLabel" :data-testid="dataTestId">
      <!-- 连接状态图标 -->
      <div class="sync-status-bar__icon" :class="`status-icon--${connectionState.toLowerCase()}`">
        <svg v-if="connectionState === CS.CONNECTING" class="size-14px animate-spin">
          <use href="#spinner"></use>
        </svg>
        <svg v-else-if="connectionState === CS.CATCHUP" class="size-14px">
          <use href="#sync"></use>
        </svg>
        <svg v-else-if="connectionState === CS.RECONNECTING" class="size-14px animate-pulse">
          <use href="#refresh-cw"></use>
        </svg>
        <svg v-else-if="connectionState === CS.ERROR" class="size-14px">
          <use href="#alert-circle"></use>
        </svg>
        <svg v-else-if="connectionState === CS.CONNECTED" class="size-14px">
          <use href="#check-circle"></use>
        </svg>
      </div>

      <!-- 状态文本 -->
      <div class="sync-status-bar__text">
        <span class="sync-status-bar__label">{{ statusLabel }}</span>
        <span v-if="reconnectCount > 0 && connectionState === CS.RECONNECTING" class="sync-status-bar__detail">
          （第 {{ reconnectCount }} 次）
        </span>
        <span v-if="syncProgress && connectionState === CS.CATCHUP" class="sync-status-bar__detail">
          （{{ syncProgress }}%）
        </span>
      </div>

      <!-- 重试按钮（错误状态） -->
      <n-button v-if="connectionState === CS.ERROR" size="tiny" secondary @click="emit('retry')" :disabled="isRetrying">
        重试
      </n-button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ConnectionState } from '@/services/matrix/MatrixConnectionManager'

// ConnectionState 值常量（类型是别名，需要手动定义值）
const CS = {
  CONNECTING: 'CONNECTING',
  CATCHUP: 'CATCHUP',
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
  ERROR: 'ERROR',
  DISCONNECTED: 'DISCONNECTED'
} as const

const props = withDefaults(
  defineProps<{
    connectionState: ConnectionState
    syncProgress?: number | null
    reconnectCount?: number
    isVisible?: boolean
    dataTestId?: string
  }>(),
  {
    syncProgress: null,
    reconnectCount: 0,
    isVisible: true,
    dataTestId: 'sync-status-bar'
  }
)

const emit = defineEmits<{
  retry: []
  'update:isVisible': [visible: boolean]
}>()

const { t } = useI18n()

// 自动隐藏逻辑
const autoHideTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const shouldShow = computed(() => {
  if (!props.isVisible) return false
  // CONNECTED 状态延迟 2 秒后自动隐藏
  return true
})

const statusLabel = computed(() => {
  switch (props.connectionState) {
    case CS.CONNECTING:
      return t('connection.connecting')
    case CS.CATCHUP:
      return t('connection.catchup')
    case CS.RECONNECTING:
      return t('connection.reconnecting')
    case CS.ERROR:
      return t('connection.error')
    case CS.CONNECTED:
      return t('connection.connected')
    default:
      return ''
  }
})

const ariaLabel = computed(() => {
  const base = statusLabel.value
  if (props.reconnectCount > 0 && props.connectionState === CS.RECONNECTING) {
    return `${base}，第 ${props.reconnectCount} 次尝试`
  }
  if (props.syncProgress !== null && props.connectionState === CS.CATCHUP) {
    return `${base}，同步进度 ${props.syncProgress}%`
  }
  return base
})

const isRetrying = ref(false)

// 组件卸载时清理定时器
onUnmounted(() => {
  if (autoHideTimer.value) {
    clearTimeout(autoHideTimer.value)
  }
})
</script>

<style scoped lang="scss">
.sync-status-bar {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  padding: var(--tjg-space-2) var(--tjg-space-3);
  background: var(--tjg-surface-subtle);
  border-bottom: 1px solid var(--tjg-border-default);
  font-size: var(--tjg-font-size-sm);
  min-height: 32px;
}

.sync-status-bar__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    color: var(--tjg-text-tertiary);
  }

  &.status-icon--connecting svg {
    color: var(--tjg-color-primary-500);
  }
  &.status-icon--catchup svg {
    color: var(--tjg-color-info-500);
  }
  &.status-icon--reconnecting svg {
    color: var(--tjg-color-warning-500);
  }
  &.status-icon--error svg {
    color: var(--tjg-color-danger-500);
  }
  &.status-icon--connected svg {
    color: var(--tjg-color-success-500);
  }
}

.sync-status-bar__text {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--tjg-space-1);
  min-width: 0;

  .sync-status-bar__label {
    color: var(--tjg-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sync-status-bar__detail {
    color: var(--tjg-text-tertiary);
    font-size: var(--tjg-font-size-xs);
    white-space: nowrap;
  }
}

/* 减少运动偏好 */
@media (prefers-reduced-motion: reduce) {
  .sync-status-bar {
    transition: none;
  }
}

/* 淡入淡出动画 */
.sync-status-fade-enter-active,
.sync-status-fade-leave-active {
  transition: opacity 0.3s ease;
}

.sync-status-fade-enter-from,
.sync-status-fade-leave-to {
  opacity: 0;
}

/* 低性能降级 */
:global(html.low-perf) .sync-status-bar {
  background: var(--tjg-surface-panel);
}
</style>
