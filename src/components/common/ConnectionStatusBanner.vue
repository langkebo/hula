<template>
  <Transition name="connection-banner">
    <div
      v-if="showBanner"
      class="connection-status-banner"
      :class="`connection-status-banner--${bannerVariant}`"
      :role="state === 'error' ? 'alert' : 'status'"
      :aria-live="state === 'error' ? 'assertive' : 'polite'"
      aria-atomic="true">
      <div class="connection-status-banner__content">
        <div class="connection-status-banner__icon">
          <n-spin v-if="state === 'reconnecting' || state === 'connecting' || state === 'syncing'" :size="14" />
          <svg
            v-else-if="state === 'offline'"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
          <svg
            v-else-if="state === 'error'"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <svg
            v-else
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <span class="connection-status-banner__text">{{ statusText }}</span>
        <button v-if="state === 'error'" class="connection-status-banner__retry" @click="$emit('retry')">
          {{ t('connection.retry') }}
        </button>
        <button
          v-if="state === 'error'"
          class="connection-status-banner__retry"
          :disabled="diagnosing"
          @click="onDiagnose">
          {{ diagnosing ? t('connection.diagnose_running') : t('connection.diagnose') }}
        </button>
        <button
          v-if="showDegradation && !connectionVisible"
          class="connection-status-banner__dismiss"
          :aria-label="t('common.close')"
          @click="degradationDismissed = true">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { NSpin, useDialog } from 'naive-ui'
import { computed, h, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { ConnectionState } from '@/composables/useConnectionStatus'
import { useCapabilityStore } from '@/stores/domains/chat/capability'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { type DiagnosticResult, MatrixDiagnostics } from '@/utils/MatrixDiagnostics'

const props = withDefaults(
  defineProps<{
    state: ConnectionState
    retryCount?: number
    maxRetries?: number
  }>(),
  {
    retryCount: 0,
    maxRetries: 20
  }
)

defineEmits<{
  retry: []
}>()

const { t } = useI18n()
const dialog = useDialog()
const { showFeedback } = useActionFeedback()
const matrixStore = useMatrixStore()
const capabilityStore = useCapabilityStore()

const diagnosing = ref(false)

/** 连接类提示的可见性（offline / connecting / reconnecting / syncing / error）。 */
const connectionVisible = computed(() => props.state !== 'online' && props.state !== 'idle')

/** P-01：Matrix Worker 降级后搜索索引不可用，需要独立于连接状态向用户暴露。 */
const workerDegraded = computed(() => capabilityStore.extensionHealth.matrixWorker === 'degraded')
const degradationDismissed = ref(false)
watch(workerDegraded, (degraded) => {
  if (degraded) degradationDismissed.value = false
})
const showDegradation = computed(() => workerDegraded.value && !degradationDismissed.value)

const showBanner = computed(() => connectionVisible.value || showDegradation.value)

/** 连接正常但 worker 降级时，用降级配色而非 online 的空样式。 */
const bannerVariant = computed(() => (connectionVisible.value ? props.state : 'degraded'))

const statusText = computed(() => {
  const connectionText = (() => {
    switch (props.state) {
      case 'offline':
        return t('connection.offline')
      case 'connecting':
        return t('connection.reconnecting')
      case 'reconnecting':
        if (props.retryCount > 0) {
          return t('connection.reconnecting_attempt', { count: props.retryCount, max: props.maxRetries })
        }
        return t('connection.reconnecting')
      case 'syncing':
        return t('connection.syncing')
      case 'error':
        return t('connection.failed')
      default:
        return ''
    }
  })()
  if (!showDegradation.value) return connectionText
  const degradedText = t('connection.worker_degraded')
  return connectionText ? `${connectionText} · ${degradedText}` : degradedText
})

const renderResults = (results: DiagnosticResult[]) =>
  h(
    'ul',
    { style: 'margin:0;padding-left:18px;line-height:1.6;font-size:13px;' },
    results.map((r) => {
      const icon = r.status === 'success' ? '✅' : r.status === 'warning' ? '⚠️' : '❌'
      return h('li', { key: r.name }, `${icon} ${r.name}: ${r.message}`)
    })
  )

const onDiagnose = async () => {
  if (diagnosing.value) return
  const homeserverUrl = matrixStore.homeserverUrl
  if (!homeserverUrl) {
    showFeedback(t('connection.diagnose_no_homeserver'), 'warning')
    return
  }
  diagnosing.value = true
  try {
    const results = await new MatrixDiagnostics(homeserverUrl).runAll()
    dialog.info({
      title: t('connection.diagnose_title'),
      content: () => renderResults(results),
      positiveText: 'OK'
    })
  } catch (err) {
    showFeedback(t('connection.diagnose_failed', { message: String(err) }), 'error')
  } finally {
    diagnosing.value = false
  }
}
</script>

<style scoped>
.connection-status-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 6px 16px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  transition:
    color var(--tjg-motion-duration-slow) ease,
    background-color var(--tjg-motion-duration-slow) ease,
    border-color var(--tjg-motion-duration-slow) ease,
    box-shadow var(--tjg-motion-duration-slow) ease,
    opacity var(--tjg-motion-duration-slow) ease,
    transform var(--tjg-motion-duration-slow) ease;
}

.connection-status-banner--offline {
  background: var(--tjg-color-warning-500);
  color: var(--tjg-text-inverse);
}

.connection-status-banner--connecting {
  background: var(--tjg-color-info-500);
  color: var(--tjg-text-inverse);
}

.connection-status-banner--reconnecting {
  background: var(--tjg-color-info-500);
  color: var(--tjg-text-inverse);
}

.connection-status-banner--syncing {
  background: var(--tjg-color-info-500);
  color: var(--tjg-text-inverse);
}

.connection-status-banner--error {
  background: var(--tjg-color-danger-500);
  color: var(--tjg-text-inverse);
}

.connection-status-banner--degraded {
  background: var(--tjg-color-warning-bg);
  color: var(--tjg-text-primary);
}

/* 白字在 warning-500 上对比度不足，降级横幅改用弱化底 + 警示色图标。 */
.connection-status-banner--degraded .connection-status-banner__icon,
.connection-status-banner--degraded .connection-status-banner__dismiss {
  color: var(--tjg-color-warning-500);
}

.connection-status-banner__content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.connection-status-banner__icon {
  display: flex;
  align-items: center;
}

.connection-status-banner__text {
  white-space: nowrap;
}

.connection-status-banner__retry {
  padding: 2px 8px;
  border: 1px solid var(--tjg-border-inverse-muted);
  border-radius: 4px;
  background: transparent;
  color: var(--tjg-text-inverse);
  font-size: 11px;
  cursor: pointer;
  transition: background var(--tjg-motion-duration-normal);
}

.connection-status-banner__retry:hover {
  background: var(--tjg-surface-inverse-hover);
}

.connection-status-banner__retry:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.connection-status-banner__dismiss {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--tjg-text-inverse);
  cursor: pointer;
  transition: background var(--tjg-motion-duration-normal);
}

.connection-status-banner__dismiss:hover {
  opacity: 0.7;
}

.connection-banner-enter-active,
.connection-banner-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.connection-banner-enter-from,
.connection-banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
