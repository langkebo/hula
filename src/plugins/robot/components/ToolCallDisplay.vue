<template>
  <div class="tool-call-display">
    <n-collapse>
      <n-collapse-item v-for="toolCall in toolCalls" :key="toolCall.id">
        <template #header>
          <n-flex align="center" :size="8">
            <span class="tool-icon">{{ getToolIcon(toolCall.function.name) }}</span>
            <span>{{ toolCall.function.name }}</span>
            <n-tag :type="getStatusType(toolCall.status)" size="small">
              {{ getStatusText(toolCall.status) }}
            </n-tag>
          </n-flex>
        </template>

        <div class="tool-call-content">
          <div class="tool-call-section">
            <n-text depth="3" class="section-label">参数:</n-text>
            <n-code :code="formatArguments(toolCall.function.arguments)" language="json" />
          </div>

          <div v-if="toolCall.result" class="tool-call-section">
            <n-text depth="3" class="section-label">结果:</n-text>
            <n-code :code="formatResult(toolCall.result)" language="json" />
          </div>

          <div v-if="toolCall.error" class="tool-call-section error">
            <n-text depth="3" class="section-label">错误:</n-text>
            <n-text type="error">{{ toolCall.error }}</n-text>
          </div>
        </div>
      </n-collapse-item>
    </n-collapse>
  </div>
</template>

<script setup lang="ts">
import type { ToolCall } from '@/services/openclaw'

defineProps<{
  toolCalls: ToolCall[]
}>()

function getToolIcon(name: string) {
  const iconMap: Record<string, string> = {
    news: '📰',
    search: '🔍',
    trend: '📈',
    time: '⏰',
    date: '📅',
    calculate: '🔢',
    math: '🧮',
    default: '🔧'
  }

  for (const [key, icon] of Object.entries(iconMap)) {
    if (name.toLowerCase().includes(key)) {
      return icon
    }
  }
  return iconMap.default
}

function getStatusType(status: ToolCall['status']) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'running':
      return 'warning'
    case 'error':
      return 'error'
    default:
      return 'default'
  }
}

function getStatusText(status: ToolCall['status']) {
  switch (status) {
    case 'pending':
      return '等待中'
    case 'running':
      return '执行中'
    case 'completed':
      return '已完成'
    case 'error':
      return '失败'
    default:
      return '未知'
  }
}

function formatArguments(args: string): string {
  try {
    return JSON.stringify(JSON.parse(args), null, 2)
  } catch {
    return args
  }
}

function formatResult(result: unknown): string {
  try {
    return JSON.stringify(result, null, 2)
  } catch {
    return String(result)
  }
}
</script>

<style scoped lang="scss">
.tool-call-display {
  margin: 8px 0;
}

.tool-icon {
  font-size: 18px;
}

.tool-call-content {
  padding: 8px 0;
}

.tool-call-section {
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }

  &.error {
    padding: 8px;
    background-color: rgba(255, 0, 0, 0.05);
    border-radius: 4px;
  }
}

.section-label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
}
</style>
