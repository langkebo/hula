<template>
  <section class="rs-tab__section" data-testid="room-event-diagnostics">
    <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_event_diagnostics') }}</h4>
    <p class="rs-event-diag__hint">{{ t('room.settings_drawer.event_diagnostics_hint') }}</p>

    <div class="rs-event-diag__block" data-testid="event-diag-reduced">
      <span class="rs-event-diag__label">{{ t('room.settings_drawer.event_diag_reduced_title') }}</span>
      <n-spin v-if="reduced.status === 'loading'" size="small" data-testid="event-diag-reduced-loading" />
      <div v-else-if="reduced.status === 'error'" class="rs-event-diag__state" data-testid="event-diag-reduced-error">
        <span class="rs-event-diag__hint">{{ t('room.settings_drawer.event_diag_load_failed') }}</span>
        <n-button size="small" data-testid="event-diag-reduced-retry" @click="loadReduced">
          {{ t('common.retry') }}
        </n-button>
      </div>
      <p v-else-if="reduced.status === 'unsupported'" class="rs-event-diag__hint">
        {{ t('room.settings_drawer.event_diag_unsupported') }}
      </p>
      <p v-else-if="reduced.status === 'empty'" class="rs-event-diag__hint">
        {{ t('room.settings_drawer.event_diag_empty') }}
      </p>
      <template v-else-if="reduced.snapshot">
        <span class="rs-event-diag__summary" data-testid="event-diag-reduced-summary">
          {{ t('room.settings_drawer.event_diag_reduced_summary', { count: reduced.snapshot.events.length }) }}
          <template v-if="reduced.snapshot.total !== null">
            · {{ t('room.settings_drawer.event_diag_reduced_total', { total: reduced.snapshot.total }) }}
          </template>
        </span>
        <ul class="rs-event-diag__list">
          <li v-for="item in reducedPreview" :key="`${item.eventId}-${item.type}`" class="rs-event-diag__row">
            <span class="rs-event-diag__mono">{{ item.type || '—' }}</span>
            <span v-if="item.sender" class="rs-event-diag__muted">{{ item.sender }}</span>
            <span v-if="item.eventId" class="rs-event-diag__muted">{{ shortId(item.eventId) }}</span>
          </li>
        </ul>
        <span v-if="reducedMore > 0" class="rs-event-diag__hint">
          {{ t('room.settings_drawer.event_diag_more', { count: reducedMore }) }}
        </span>
      </template>
    </div>

    <div class="rs-event-diag__block" data-testid="event-diag-rendered">
      <span class="rs-event-diag__label">{{ t('room.settings_drawer.event_diag_rendered_title') }}</span>
      <n-spin v-if="rendered.status === 'loading'" size="small" data-testid="event-diag-rendered-loading" />
      <div v-else-if="rendered.status === 'error'" class="rs-event-diag__state" data-testid="event-diag-rendered-error">
        <span class="rs-event-diag__hint">{{ t('room.settings_drawer.event_diag_load_failed') }}</span>
        <n-button size="small" data-testid="event-diag-rendered-retry" @click="loadRendered">
          {{ t('common.retry') }}
        </n-button>
      </div>
      <p v-else-if="rendered.status === 'unsupported'" class="rs-event-diag__hint">
        {{ t('room.settings_drawer.event_diag_unsupported') }}
      </p>
      <p v-else-if="rendered.status === 'empty'" class="rs-event-diag__hint">
        {{ t('room.settings_drawer.event_diag_empty') }}
      </p>
      <template v-else-if="rendered.snapshot">
        <span class="rs-event-diag__summary" data-testid="event-diag-rendered-summary">
          {{ t('room.settings_drawer.event_diag_rendered_state', { value: renderedStateLabel }) }}
          · {{ t('room.settings_drawer.event_diag_rendered_events', { count: rendered.snapshot.events.length }) }}
        </span>
        <p v-if="rendered.snapshot.plainText" class="rs-event-diag__preview">{{ renderedPreview }}</p>
      </template>
    </div>

    <div class="rs-event-diag__block" data-testid="event-diag-fragments">
      <span class="rs-event-diag__label">{{ t('room.settings_drawer.event_diag_fragments_title') }}</span>
      <n-spin v-if="fragments.status === 'loading'" size="small" data-testid="event-diag-fragments-loading" />
      <div
        v-else-if="fragments.status === 'error'"
        class="rs-event-diag__state"
        data-testid="event-diag-fragments-error">
        <span class="rs-event-diag__hint">{{ t('room.settings_drawer.event_diag_load_failed') }}</span>
        <n-button size="small" data-testid="event-diag-fragments-retry" @click="loadFragments">
          {{ t('common.retry') }}
        </n-button>
      </div>
      <p v-else-if="fragments.status === 'unsupported'" class="rs-event-diag__hint">
        {{ t('room.settings_drawer.event_diag_unsupported') }}
      </p>
      <p v-else-if="fragments.status === 'empty'" class="rs-event-diag__hint">
        {{ t('room.settings_drawer.event_diag_empty') }}
      </p>
      <template v-else-if="fragments.snapshot">
        <span class="rs-event-diag__summary" data-testid="event-diag-fragments-summary">
          {{ t('room.settings_drawer.event_diag_fragments_count', { count: fragments.snapshot.fragments.length }) }}
        </span>
        <ul class="rs-event-diag__list">
          <li
            v-for="fragment in fragments.snapshot.fragments"
            :key="`${fragment.start}-${fragment.end}`"
            class="rs-event-diag__row">
            <span class="rs-event-diag__mono">{{ shortId(fragment.start) }} → {{ shortId(fragment.end) }}</span>
            <span v-if="fragment.limited" class="rs-event-diag__badge">
              {{ t('room.settings_drawer.event_diag_fragment_limited') }}
            </span>
          </li>
        </ul>
      </template>
    </div>

    <div class="rs-event-diag__block" data-testid="event-diag-receipts">
      <span class="rs-event-diag__label">{{ t('room.settings_drawer.event_diag_receipts_title') }}</span>
      <div class="rs-event-diag__form">
        <n-input
          v-model:value="receiptEventId"
          size="small"
          clearable
          :placeholder="t('room.settings_drawer.event_diag_receipts_event_id')"
          data-testid="event-diag-receipts-event-id" />
        <n-select
          v-model:value="receiptType"
          size="small"
          :options="receiptTypeOptions"
          data-testid="event-diag-receipts-type" />
        <n-button
          size="small"
          :loading="receipts.status === 'loading'"
          :disabled="receiptEventId.trim().length === 0"
          data-testid="event-diag-receipts-query"
          @click="loadReceipts">
          {{ t('room.settings_drawer.event_diag_receipts_query') }}
        </n-button>
      </div>

      <n-spin v-if="receipts.status === 'loading'" size="small" data-testid="event-diag-receipts-loading" />
      <div v-else-if="receipts.status === 'error'" class="rs-event-diag__state" data-testid="event-diag-receipts-error">
        <span class="rs-event-diag__hint">{{ t('room.settings_drawer.event_diag_load_failed') }}</span>
      </div>
      <p v-else-if="receipts.status === 'unsupported'" class="rs-event-diag__hint">
        {{ t('room.settings_drawer.event_diag_unsupported') }}
      </p>
      <p v-else-if="receipts.status === 'empty'" class="rs-event-diag__hint">
        {{ t('room.settings_drawer.event_diag_empty') }}
      </p>
      <p v-else-if="receipts.status === 'idle'" class="rs-event-diag__hint">
        {{ t('room.settings_drawer.event_diag_receipts_idle') }}
      </p>
      <template v-else-if="receipts.snapshot">
        <span class="rs-event-diag__summary" data-testid="event-diag-receipts-summary">
          {{ t('room.settings_drawer.event_diag_receipts_count', { count: receipts.snapshot.users.length }) }}
        </span>
        <ul class="rs-event-diag__list">
          <li v-for="user in receipts.snapshot.users" :key="user.userId" class="rs-event-diag__row">
            <span class="rs-event-diag__mono">{{ user.userId }}</span>
            <span class="rs-event-diag__muted">{{ formatTimestamp(user.ts) }}</span>
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'
import type {
  RoomFragmentsSnapshot,
  RoomReceiptSnapshot,
  RoomReducedEventsSnapshot,
  RoomRenderedSnapshot
} from '@/services/matrix/room/timelineOutcomes'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()

type SectionStatus = 'idle' | 'loading' | 'ok' | 'empty' | 'unsupported' | 'error'

interface SectionState<T> {
  status: SectionStatus
  snapshot: T | null
}

const PREVIEW_LIMIT = 5
const TEXT_PREVIEW_LIMIT = 200

const reduced = ref<SectionState<RoomReducedEventsSnapshot>>({ status: 'loading', snapshot: null })
const rendered = ref<SectionState<RoomRenderedSnapshot>>({ status: 'loading', snapshot: null })
const fragments = ref<SectionState<RoomFragmentsSnapshot>>({ status: 'loading', snapshot: null })
const receipts = ref<SectionState<RoomReceiptSnapshot>>({ status: 'idle', snapshot: null })

const receiptEventId = ref('')
const receiptType = ref('m.read')
const receiptTypeOptions = ['m.read', 'm.read.private', 'm.read.thread'].map((value) => ({ label: value, value }))

const reducedPreview = computed(() => (reduced.value.snapshot?.events ?? []).slice(0, PREVIEW_LIMIT))
const reducedMore = computed(() => Math.max(0, (reduced.value.snapshot?.events.length ?? 0) - PREVIEW_LIMIT))
const renderedPreview = computed(() => {
  const text = rendered.value.snapshot?.plainText ?? ''
  return text.length > TEXT_PREVIEW_LIMIT ? `${text.slice(0, TEXT_PREVIEW_LIMIT)}…` : text
})
const renderedStateLabel = computed(() => {
  const value = rendered.value.snapshot?.rendered
  if (value === true) return t('room.settings_drawer.event_diag_rendered_true')
  if (value === false) return t('room.settings_drawer.event_diag_rendered_false')
  return t('room.settings_drawer.event_diag_rendered_unknown')
})

function shortId(value: string): string {
  return value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value
}

function formatTimestamp(ts: number | null): string {
  return ts === null ? '—' : new Date(ts).toLocaleString()
}

async function loadReduced() {
  reduced.value = { status: 'loading', snapshot: null }
  const outcome = await matrixRoomReadFacade.getRoomReducedEvents(props.roomId)
  reduced.value =
    outcome.status === 'ok' ? { status: 'ok', snapshot: outcome.snapshot } : { status: outcome.status, snapshot: null }
}

async function loadRendered() {
  rendered.value = { status: 'loading', snapshot: null }
  const outcome = await matrixRoomReadFacade.getRoomRendered(props.roomId)
  rendered.value =
    outcome.status === 'ok' ? { status: 'ok', snapshot: outcome.snapshot } : { status: outcome.status, snapshot: null }
}

async function loadFragments() {
  const userId = matrixClientService.getUserId()
  if (!userId) {
    fragments.value = { status: 'error', snapshot: null }
    return
  }
  fragments.value = { status: 'loading', snapshot: null }
  const outcome = await matrixRoomReadFacade.getRoomFragments(props.roomId, userId)
  fragments.value =
    outcome.status === 'ok' ? { status: 'ok', snapshot: outcome.snapshot } : { status: outcome.status, snapshot: null }
}

async function loadReceipts() {
  const eventId = receiptEventId.value.trim()
  if (eventId.length === 0) return
  receipts.value = { status: 'loading', snapshot: null }
  const outcome = await matrixRoomReadFacade.getRoomReceipts(props.roomId, receiptType.value, eventId)
  receipts.value =
    outcome.status === 'ok' ? { status: 'ok', snapshot: outcome.snapshot } : { status: outcome.status, snapshot: null }
}

watch(
  () => props.roomId,
  () => {
    receipts.value = { status: 'idle', snapshot: null }
    receiptEventId.value = ''
    loadReduced()
    loadRendered()
    loadFragments()
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.rs-tab__section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rs-tab__section-title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
  margin: 0;
}

.rs-event-diag__hint {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
  margin: 0;
}

.rs-event-diag__block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--tjg-border-muted);
}

.rs-event-diag__label {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.rs-event-diag__state {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rs-event-diag__summary {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
}

.rs-event-diag__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rs-event-diag__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
}

.rs-event-diag__mono {
  font-family: var(--tjg-font-family-mono, monospace);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rs-event-diag__muted {
  color: var(--tjg-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rs-event-diag__badge {
  padding: 0 6px;
  border: 1px solid var(--tjg-border-muted);
  border-radius: 4px;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
}

.rs-event-diag__preview {
  margin: 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
}

.rs-event-diag__form {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

@media (prefers-reduced-motion: reduce) {
  .rs-event-diag__block {
    transition: none;
  }
}
</style>
