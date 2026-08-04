<template>
  <div class="room-encrypted-events-panel" data-testid="room-encrypted-events-panel">
    <n-card size="small" :bordered="true">
      <template #header>
        <span class="panel-title">{{ t('room.encrypted_events.title') }}</span>
      </template>

      <n-spin :show="loading" size="small">
        <p class="panel-subtitle">{{ t('room.encrypted_events.subtitle') }}</p>

        <template v-if="events.length > 0">
          <div class="event-list">
            <div
              v-for="item in events"
              :key="String(item.event_id)"
              class="encrypted-event-item"
              data-testid="encrypted-event-item">
              <div class="event-row">
                <span class="event-label">{{ t('room.encrypted_events.event_id') }}:</span>
                <span class="event-value" :title="String(item.event_id)">{{ truncateId(String(item.event_id)) }}</span>
              </div>
              <div class="event-row">
                <span class="event-label">{{ t('room.encrypted_events.algorithm') }}:</span>
                <n-tag size="small" type="info">{{ item.algorithm }}</n-tag>
              </div>
              <div class="event-row">
                <span class="event-label">{{ t('room.encrypted_events.session_id') }}:</span>
                <span class="event-value" :title="String(item.session_id)">
                  {{ truncateId(String(item.session_id)) }}
                </span>
              </div>
              <div v-if="item.sender" class="event-row">
                <span class="event-label">{{ t('room.encrypted_events.sender') }}:</span>
                <span class="event-value">{{ item.sender }}</span>
              </div>
            </div>
          </div>
        </template>

        <n-empty v-else :description="t('room.encrypted_events.empty')" size="small" />
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixRoomAccountDataService } from '@/services/matrix/room/AccountDataService'

interface EncryptedEvent {
  event_id: string
  algorithm: string
  session_id: string
  sender?: string
}

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()

const loading = ref(true)
const eventsData = ref<Record<string, unknown>>({})

const events = computed<EncryptedEvent[]>(() => {
  const list = eventsData.value?.events
  return Array.isArray(list) ? (list as EncryptedEvent[]) : []
})

function truncateId(id: string): string {
  if (id.length <= 24) return id
  return `${id.slice(0, 12)}...${id.slice(-8)}`
}

async function loadEvents() {
  loading.value = true
  try {
    eventsData.value = await matrixRoomAccountDataService.getEncryptedEvents(props.roomId)
  } catch {
    eventsData.value = {}
  } finally {
    loading.value = false
  }
}

onMounted(loadEvents)

watch(
  () => props.roomId,
  (newId) => {
    if (newId) loadEvents()
  }
)
</script>

<style scoped>
.room-encrypted-events-panel {
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

.event-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.encrypted-event-item {
  padding: 8px 12px;
  background: var(--tjg-surface-search);
  border-radius: 6px;
  font-size: 12px;
}

.event-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.event-row:last-child {
  margin-bottom: 0;
}

.event-label {
  color: var(--tjg-text-tertiary);
  flex-shrink: 0;
}

.event-value {
  font-family: monospace;
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
