<template>
  <div class="room-message-queue-panel" data-testid="room-message-queue-panel">
    <n-card size="small" :bordered="true">
      <template #header>
        <span class="panel-title">{{ t('room.message_queue.title') }}</span>
      </template>

      <n-spin :show="loading" size="small">
        <p class="panel-subtitle">{{ t('room.message_queue.subtitle') }}</p>

        <template v-if="queueItems.length > 0">
          <div class="queue-list">
            <div v-for="item in queueItems" :key="String(item.event_id)" class="queue-item" data-testid="queue-item">
              <div class="queue-item-row">
                <span class="queue-item-label">{{ t('room.message_queue.event_id') }}:</span>
                <span class="queue-item-value" :title="String(item.event_id)">
                  {{ truncateId(String(item.event_id)) }}
                </span>
              </div>
              <div class="queue-item-row">
                <span class="queue-item-label">{{ t('room.message_queue.type') }}:</span>
                <n-tag size="small">{{ item.type }}</n-tag>
              </div>
              <div v-if="item.content" class="queue-item-row">
                <span class="queue-item-label">{{ t('room.message_queue.content') }}:</span>
                <span class="queue-item-content">{{ formatContent(item.content) }}</span>
              </div>
            </div>
          </div>
        </template>

        <n-empty v-else :description="t('room.message_queue.empty')" size="small" />
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixRoomAccountDataService } from '@/services/matrix/room/AccountDataService'

interface QueueItem {
  event_id: string
  type: string
  content?: unknown
}

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()

const loading = ref(true)
const queueData = ref<Record<string, unknown>>({})

const queueItems = computed<QueueItem[]>(() => {
  const queue = queueData.value?.queue
  return Array.isArray(queue) ? (queue as QueueItem[]) : []
})

function truncateId(id: string): string {
  if (id.length <= 24) return id
  return `${id.slice(0, 12)}...${id.slice(-8)}`
}

function formatContent(content: unknown): string {
  if (content === null || content === undefined) return '-'
  if (typeof content === 'object') {
    const obj = content as Record<string, unknown>
    if (typeof obj.body === 'string') return obj.body
    return JSON.stringify(content)
  }
  return String(content)
}

async function loadQueue() {
  loading.value = true
  try {
    queueData.value = await matrixRoomAccountDataService.getMessageQueue(props.roomId)
  } catch {
    queueData.value = {}
  } finally {
    loading.value = false
  }
}

onMounted(loadQueue)

watch(
  () => props.roomId,
  (newId) => {
    if (newId) loadQueue()
  }
)
</script>

<style scoped>
.room-message-queue-panel {
  width: 100%;
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
}

.panel-subtitle {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  line-height: 1.5;
}

.queue-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.queue-item {
  padding: 8px 12px;
  background: var(--tjg-surface-search);
  border-radius: 6px;
  font-size: 12px;
}

.queue-item-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.queue-item-row:last-child {
  margin-bottom: 0;
}

.queue-item-label {
  color: var(--tjg-text-tertiary);
  flex-shrink: 0;
}

.queue-item-value {
  font-family: monospace;
  color: var(--tjg-text-primary);
}

.queue-item-content {
  color: var(--tjg-text-secondary);
  word-break: break-word;
}
</style>
