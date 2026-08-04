<template>
  <div class="delayed-events-panel">
    <div class="panel-header">
      <span class="panel-title">{{ t('delayed_events.title') }}</span>
    </div>

    <div v-if="loading" class="panel-loading">
      <n-spin size="small" />
    </div>

    <div v-else-if="loadError" class="delayed-events-error">
      <p>{{ t('delayed_events.load_failed') }}</p>
      <n-button size="small" @click="loadEvents">{{ t('common.retry') }}</n-button>
    </div>

    <div v-else-if="scheduledEvents.length === 0 && finalisedEvents.length === 0" class="panel-empty">
      <n-empty :description="t('delayed_events.empty')" size="small" />
    </div>

    <div v-else class="panel-body">
      <div v-if="scheduledEvents.length > 0" class="event-section">
        <div class="section-title">{{ t('delayed_events.scheduled') }} ({{ scheduledEvents.length }})</div>
        <div v-for="event in scheduledEvents" :key="event.delay_id" class="delayed-event-item">
          <div class="event-meta">
            <div class="meta-row">
              <span class="meta-label">{{ t('delayed_events.fields.delay_id') }}:</span>
              <span class="meta-value" :title="event.delay_id">{{ event.delay_id }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">{{ t('delayed_events.fields.type') }}:</span>
              <span class="meta-value">{{ event.type }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">{{ t('delayed_events.fields.delay') }}:</span>
              <span class="meta-value">{{ getDelay(event) }}ms</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">{{ t('delayed_events.fields.running_since') }}:</span>
              <span class="meta-value">{{ formatTimestamp(event.running_since) }}</span>
            </div>
          </div>
          <div class="event-actions">
            <n-button
              size="tiny"
              secondary
              data-testid="delayed-cancel-btn"
              :loading="actionLoading === `cancel:${event.delay_id}`"
              @click="handleCancel(event.delay_id)">
              {{ t('delayed_events.actions.cancel') }}
            </n-button>
            <n-button
              size="tiny"
              secondary
              data-testid="delayed-restart-btn"
              :loading="actionLoading === `restart:${event.delay_id}`"
              @click="handleRestart(event.delay_id)">
              {{ t('delayed_events.actions.restart') }}
            </n-button>
            <n-button
              size="tiny"
              type="primary"
              secondary
              data-testid="delayed-send-btn"
              :loading="actionLoading === `send:${event.delay_id}`"
              @click="handleSend(event.delay_id)">
              {{ t('delayed_events.actions.send') }}
            </n-button>
          </div>
        </div>
      </div>

      <template v-if="finalisedEvents.length > 0">
        <n-divider v-if="scheduledEvents.length > 0" />
        <div class="event-section">
          <div class="section-title">{{ t('delayed_events.finalised') }} ({{ finalisedEvents.length }})</div>
          <div
            v-for="(entry, index) in finalisedEvents"
            :key="`${entry.delayed_event.delay_id}-${index}`"
            class="delayed-event-item finalised">
            <div class="event-meta">
              <div class="meta-row">
                <span class="meta-label">{{ t('delayed_events.fields.delay_id') }}:</span>
                <span class="meta-value" :title="entry.delayed_event.delay_id">
                  {{ entry.delayed_event.delay_id }}
                </span>
              </div>
              <div class="meta-row">
                <span class="meta-label">{{ t('delayed_events.fields.type') }}:</span>
                <span class="meta-value">{{ entry.delayed_event.type }}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">
                  {{ t('delayed_events.outcome.send') }}/{{ t('delayed_events.outcome.cancel') }}:
                </span>
                <n-tag size="tiny" round :type="entry.outcome === 'send' ? 'success' : 'default'">
                  {{ t(`delayed_events.outcome.${entry.outcome}`) }}
                </n-tag>
              </div>
              <div class="meta-row">
                <span class="meta-label">{{ t('delayed_events.reason.delay') }}:</span>
                <span class="meta-value">{{ t(`delayed_events.reason.${entry.reason}`) }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { DelayedEventInfoItem } from '@/services/matrix/messaging/MatrixDelayedEventsService'
import { matrixDelayedEventsService } from '@/services/matrix/messaging/MatrixDelayedEventsService'

interface FinalisedEventEntry {
  delayed_event: DelayedEventInfoItem
  outcome: 'send' | 'cancel'
  reason: 'error' | 'action' | 'delay'
  error?: unknown
  event_id?: string
  origin_server_ts?: number
}

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loading = ref(true)
const loadError = ref(false)
const scheduledEvents = ref<DelayedEventInfoItem[]>([])
const finalisedEvents = ref<FinalisedEventEntry[]>([])
const actionLoading = ref<string | null>(null)

const formatTimestamp = (ts: number): string => {
  if (!ts) return '-'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts)
  }
}

const getDelay = (event: DelayedEventInfoItem): number => {
  if ('delay' in event && typeof event.delay === 'number') {
    return event.delay
  }
  return 0
}

const loadEvents = async () => {
  loading.value = true
  loadError.value = false
  try {
    const result = await matrixDelayedEventsService.getDelayedEvents('scheduled')
    scheduledEvents.value = result.scheduled ?? []
    finalisedEvents.value = result.finalised ?? []
  } catch (error) {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

const runAction = async (
  action: 'cancel' | 'restart' | 'send',
  delayId: string,
  serviceMethod: (id: string) => Promise<unknown>,
  successKey: string,
  failedKey: string
) => {
  actionLoading.value = `${action}:${delayId}`
  try {
    await serviceMethod(delayId)
    showFeedback(t(successKey), 'success')
    await loadEvents()
  } catch (error) {
    showFeedback(t(failedKey), 'error')
  } finally {
    actionLoading.value = null
  }
}

const handleCancel = (delayId: string) => {
  void runAction(
    'cancel',
    delayId,
    (id) => matrixDelayedEventsService.cancelScheduledDelayedEvent(id),
    'delayed_events.cancel_success',
    'delayed_events.cancel_failed'
  )
}

const handleRestart = (delayId: string) => {
  void runAction(
    'restart',
    delayId,
    (id) => matrixDelayedEventsService.restartScheduledDelayedEvent(id),
    'delayed_events.restart_success',
    'delayed_events.restart_failed'
  )
}

const handleSend = (delayId: string) => {
  void runAction(
    'send',
    delayId,
    (id) => matrixDelayedEventsService.sendScheduledDelayedEvent(id),
    'delayed_events.send_success',
    'delayed_events.send_failed'
  )
}

onMounted(() => {
  void loadEvents()
})

watch(
  () => props.roomId,
  () => {
    void loadEvents()
  }
)
</script>

<style scoped lang="scss">
.delayed-events-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 4px;

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;

    .panel-title {
      font-size: 14px;
      font-weight: 500;
      color: var(--tjg-text-primary);
    }
  }

  .panel-loading,
  .panel-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px 0;
  }

  .delayed-events-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 16px 0;
    color: var(--tjg-text-secondary);
    font-size: 12px;
  }

  .panel-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .event-section {
    display: flex;
    flex-direction: column;
    gap: 6px;

    .section-title {
      font-size: 12px;
      font-weight: 500;
      color: var(--tjg-text-secondary);
      padding: 4px 0;
    }
  }

  .delayed-event-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border-radius: 6px;
    background-color: var(--tjg-surface-app);
    border: 1px solid var(--tjg-border-layout-divider);

    &.finalised {
      opacity: 0.7;
    }

    .event-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;

      .meta-row {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        line-height: 1.4;

        .meta-label {
          color: var(--tjg-text-tertiary);
          flex-shrink: 0;
          min-width: 64px;
        }

        .meta-value {
          color: var(--tjg-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    .event-actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
  }
}
</style>
