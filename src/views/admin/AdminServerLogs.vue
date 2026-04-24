<template>
  <div class="admin-server-logs">
    <n-page-header :title="t('admin.logs.title')" :subtitle="t('admin.logs.subtitle')">
      <template #extra>
        <n-space>
          <n-select
            v-model:value="logLevel"
            :options="levelOptions"
            :placeholder="t('admin.logs.filter_level')"
            clearable
            style="width: 130px"
          />
          <n-button @click="loadLogs" :loading="loading">
            {{ t('common.refresh') }}
          </n-button>
        </n-space>
      </template>
    </n-page-header>

    <n-alert type="warning" title="功能尚未就绪 / Feature not available" class="my-12px">
      后端 `/logs` 端点未实现，页面数据将为空。Backend `/logs` endpoint is not implemented; this page will show no data.
    </n-alert>

    <div class="log-container" ref="logContainerRef">
      <n-spin :show="loading" class="min-h-200px">
        <div v-if="logs.length === 0 && !loading" class="flex-center h-200px opacity-50">
          {{ t('admin.logs.empty') }}
        </div>
        <div v-for="(log, index) in logs" :key="index" class="log-entry" :class="`log-entry--${log.level}`">
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <n-tag :type="getLevelTagType(log.level)" size="small" class="log-level">{{ log.level }}</n-tag>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </n-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { NPageHeader, NSpace, NButton, NSelect, NTag, NSpin, NAlert } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { adminService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminServerLogs')
const { t } = useI18n()

interface LogEntry {
  level: string
  message: string
  timestamp: number
}

const loading = ref(false)
const logs = ref<LogEntry[]>([])
const logLevel = ref<string | null>(null)
const logContainerRef = ref<HTMLElement | null>(null)

const levelOptions = computed(() => [
  { label: 'DEBUG', value: 'debug' },
  { label: 'INFO', value: 'info' },
  { label: 'WARN', value: 'warn' },
  { label: 'ERROR', value: 'error' }
])

function getLevelTagType(level: string): 'info' | 'success' | 'warning' | 'error' {
  switch (level.toLowerCase()) {
    case 'error':
      return 'error'
    case 'warn':
      return 'warning'
    case 'info':
      return 'info'
    default:
      return 'success'
  }
}

function formatTime(ts: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString()
}

async function loadLogs() {
  loading.value = true
  try {
    const result = await adminService.getServerLogs(
      logLevel.value as 'debug' | 'info' | 'warn' | 'error' | undefined,
      200
    )
    logs.value = (Array.isArray(result) ? result : []).map((item: Record<string, unknown>) => ({
      level: (item.level as string) || 'info',
      message: (item.message as string) || '',
      timestamp: (item.timestamp as number) || Date.now()
    }))
  } catch (err) {
    logger.error('加载服务器日志失败:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => loadLogs())
</script>

<style scoped>
.admin-server-logs {
  padding: 16px 24px;
}

.log-container {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  background: var(--bg-card, #fafafa);
  border-radius: 8px;
  padding: 12px;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--line-color, rgba(0, 0, 0, 0.05));
  line-height: 1.6;
}

.log-entry--error {
  color: var(--color-danger, #d03050);
}

.log-entry--warn {
  color: var(--color-warning, #f0a020);
}

.log-time {
  flex-shrink: 0;
  color: var(--text-color-tertiary, #999);
  min-width: 80px;
}

.log-level {
  flex-shrink: 0;
}

.log-message {
  word-break: break-all;
}
</style>
