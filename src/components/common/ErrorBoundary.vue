<template>
  <div v-if="hasError" class="error-boundary">
    <div class="error-content">
      <div class="error-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2 class="error-title">{{ t('errorBoundary.title') }}</h2>
      <p class="error-message">{{ errorMessage }}</p>
      <div class="error-actions">
        <n-button type="primary" @click="handleRetry">
          {{ t('errorBoundary.retry') }}
        </n-button>
        <n-button @click="handleReload">
          {{ t('errorBoundary.reload') }}
        </n-button>
      </div>
      <details v-if="isDev" class="error-details">
        <summary>{{ t('errorBoundary.details') }}</summary>
        <pre>{{ errorStack }}</pre>
      </details>
    </div>
  </div>
  <slot v-else />
</template>

<script setup lang="ts">
import { ref, onErrorCaptured, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { relaunch } from '@tauri-apps/plugin-process'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ErrorBoundary')
const { t } = useI18n()

const isDev = import.meta.env.DEV

const error = ref<Error | null>(null)
const hasError = computed(() => error.value !== null)
const errorMessage = computed(() => error.value?.message || t('errorBoundary.unknownError'))
const errorStack = computed(() => error.value?.stack || '')

onErrorCaptured((err: Error) => {
  error.value = err
  logger.error('捕获到错误:', err)
  return false
})

const handleRetry = () => {
  error.value = null
}

const handleReload = async () => {
  try {
    await relaunch()
  } catch (err) {
    logger.error('重启失败:', err)
    window.location.reload()
  }
}
</script>

<style scoped lang="scss">
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
}

.error-content {
  max-width: 480px;
  padding: 32px;
  text-align: center;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
}

.error-icon {
  margin-bottom: 24px;
  color: #f56c6c;
}

.error-title {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.error-message {
  margin: 0 0 24px;
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.error-details {
  margin-top: 24px;
  text-align: left;

  summary {
    cursor: pointer;
    font-size: 13px;
    color: #909399;
  }

  pre {
    margin-top: 12px;
    padding: 12px;
    overflow: auto;
    font-size: 12px;
    background: #f5f7fa;
    border-radius: 8px;
    max-height: 200px;
  }
}
</style>
