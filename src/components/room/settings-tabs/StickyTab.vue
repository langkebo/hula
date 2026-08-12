<template>
  <div class="rs-tab" data-testid="sticky-tab">
    <n-spin :show="loading">
      <!-- Hint text -->
      <p class="rs-tab__hint">{{ t('room.settings_drawer.sticky_hint') }}</p>

      <!-- Sticky Events List -->
      <section class="rs-tab__section">
        <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_sticky_events') }}</h4>
        <div v-if="stickyEvents.length > 0" class="rs-tab__sticky-list">
          <div v-for="item in stickyEvents" :key="item.eventId" class="rs-tab__sticky-item">
            <div class="rs-tab__sticky-meta">
              <span class="rs-tab__sticky-sender">{{ item.sender }}</span>
              <span class="rs-tab__sticky-time">{{ formatTime(item.timestamp) }}</span>
            </div>
            <p class="rs-tab__sticky-body">{{ item.body }}</p>
            <span class="rs-tab__sticky-id">{{ item.eventId }}</span>
          </div>
        </div>
        <n-empty v-else :description="t('room.settings_drawer.section_sticky_events')" />
      </section>

      <!-- Create from Recent Messages -->
      <section class="rs-tab__section">
        <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_sticky_create') }}</h4>
        <p class="rs-tab__hint">{{ t('room.settings_drawer.sticky_from_recent_hint') }}</p>
        <div v-if="recentMessages.length > 0" class="rs-tab__recent-list">
          <div v-for="msg in recentMessages" :key="msg.eventId" class="rs-tab__recent-item">
            <div class="rs-tab__recent-content">
              <span class="rs-tab__sticky-sender">{{ msg.sender }}</span>
              <p class="rs-tab__sticky-body">{{ msg.body }}</p>
            </div>
            <n-button
              size="small"
              type="primary"
              ghost
              :loading="promotingId === msg.eventId"
              :disabled="promotingId !== null"
              @click="handlePromote(msg)">
              <template #icon>
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true">
                  <path d="M12 17v5" />
                  <path
                    d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                </svg>
              </template>
              {{ t('room.settings_drawer.action_add') }}
            </n-button>
          </div>
        </div>
        <n-empty v-else :description="t('room.settings_drawer.sticky_from_recent_hint')" />
      </section>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'

interface StickyEventInfo {
  eventId: string
  sender: string
  body: string
  timestamp: number
}

interface MatrixEventLike {
  getId(): string | null
  getSender(): string | null
  getContent(): Record<string, unknown>
  getTs(): number
  getType(): string
}

const props = defineProps<{ roomId: string }>()
defineEmits<{ close: [] }>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loading = ref(false)
const promotingId = ref<string | null>(null)
const stickyEvents = ref<StickyEventInfo[]>([])
const recentMessages = ref<StickyEventInfo[]>([])

function extractBody(content: Record<string, unknown>): string {
  if (typeof content.body === 'string') return content.body
  if (typeof content.text === 'string') return content.text
  return ''
}

function formatTime(ts: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleString()
}

function parseStickyEvents(data: Record<string, unknown>): StickyEventInfo[] {
  const rawEvents = Array.isArray(data.events) ? data.events : []
  return rawEvents
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      eventId: String(item.event_id ?? item.eventId ?? ''),
      sender: String(item.sender ?? ''),
      body: String(item.body ?? ''),
      timestamp: Number(item.origin_server_ts ?? item.timestamp ?? 0)
    }))
    .filter((item) => item.eventId !== '')
}

async function loadStickyEvents(): Promise<void> {
  loading.value = true
  try {
    const data = await matrixRoomActionFacade.getStickyEvents(props.roomId)
    stickyEvents.value = parseStickyEvents(data)
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    loading.value = false
  }
}

function loadRecentMessages(): void {
  const room = matrixClientService.getRoom(props.roomId)
  if (!room) {
    recentMessages.value = []
    return
  }
  const events = room.getLiveTimeline().getEvents() as MatrixEventLike[]
  const messageEvents = events.filter((e) => e.getType() === 'm.room.message')
  const last5 = messageEvents.slice(-5).reverse()
  recentMessages.value = last5.map((e) => ({
    eventId: e.getId() ?? '',
    sender: e.getSender() ?? '',
    body: extractBody(e.getContent()),
    timestamp: e.getTs()
  }))
}

async function handlePromote(msg: StickyEventInfo): Promise<void> {
  promotingId.value = msg.eventId
  try {
    const currentData = await matrixRoomActionFacade.getStickyEvents(props.roomId)
    const currentList = parseStickyEvents(currentData)
    const exists = currentList.some((item) => item.eventId === msg.eventId)
    if (exists) {
      showFeedback(t('room.settings_drawer.saved_failed'), 'warning')
      return
    }
    const updatedList = [...currentList, msg]
    const payload: Record<string, unknown> = {
      events: updatedList.map((item) => ({
        event_id: item.eventId,
        sender: item.sender,
        body: item.body,
        origin_server_ts: item.timestamp
      }))
    }
    await matrixRoomActionFacade.setStickyEvents(props.roomId, payload)
    await loadStickyEvents()
    showFeedback(t('room.settings_drawer.saved_success'), 'success')
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    promotingId.value = null
  }
}

onMounted(async () => {
  await loadStickyEvents()
  loadRecentMessages()
})
</script>

<style scoped lang="scss">
.rs-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.rs-tab__section {
  display: flex;
  flex-direction: column;
}
.rs-tab__section-title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
  margin: 0 0 10px 0;
}
.rs-tab__field {
  margin-bottom: 12px;
}
.rs-tab__field-label {
  display: block;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
  margin-bottom: 5px;
}
.rs-tab__hint {
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
  margin: 0 0 10px 0;
}
.rs-tab__sticky-list,
.rs-tab__recent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rs-tab__sticky-item,
.rs-tab__recent-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border: 1px solid var(--tjg-border-muted);
  border-radius: var(--tjg-radius-sm);
  background: var(--tjg-surface-list);
}
.rs-tab__recent-item {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.rs-tab__recent-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.rs-tab__sticky-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.rs-tab__sticky-sender {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}
.rs-tab__sticky-time {
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
}
.rs-tab__sticky-body {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
  margin: 0;
  word-break: break-word;
}
.rs-tab__sticky-id {
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
  font-family: monospace;
}

@media (prefers-reduced-motion: reduce) {
  .rs-tab,
  .rs-tab * {
    transition: none !important;
    animation: none !important;
  }
}
</style>
