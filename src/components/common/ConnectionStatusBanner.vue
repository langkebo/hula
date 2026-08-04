<template>
  <Transition name="connection-banner">
    <div v-if="showBanner" class="connection-status-banner" :class="`connection-status-banner--${state}`">
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
            stroke-width="2">
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
            stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
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
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { NSpin, useDialog } from 'naive-ui'
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { ConnectionState } from '@/composables/useConnectionStatus'
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

const diagnosing = ref(false)

const showBanner = computed(() => props.state !== 'online' && props.state !== 'idle')

const statusText = computed(() => {
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
  transition: all 0.3s ease;
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
  transition: background 0.2s;
}

.connection-status-banner__retry:hover {
  background: var(--tjg-surface-inverse-hover);
}

.connection-status-banner__retry:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
