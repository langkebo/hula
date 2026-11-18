<template>
  <div class="room-server-summary" data-testid="room-server-summary">
    <header class="rss-header">
      <div class="rss-header-text">
        <h4 class="rss-title">{{ t('room.server_summary.title') }}</h4>
        <p class="rss-subtitle">{{ t('room.server_summary.subtitle') }}</p>
      </div>
      <button
        type="button"
        class="rss-refresh"
        :aria-label="t('common.refresh')"
        :disabled="loading"
        data-testid="room-server-summary-refresh"
        @click="load">
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
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
    </header>

    <div v-if="loading" class="rss-loading">
      <n-spin size="small" />
    </div>

    <n-alert v-else-if="error" type="warning" :bordered="false" data-testid="room-server-summary-error">
      {{ t('room.server_summary.load_failed') }}
    </n-alert>

    <template v-else>
      <PartialStateBanner
        v-if="partialFailure"
        compact
        data-testid="room-server-summary-partial"
        :message="partialMessage"
        :retry-text="t('common.retry')"
        @retry="load" />

      <section class="rss-section">
        <h5 class="rss-section-title">{{ t('room.server_summary.members') }}</h5>
        <ul v-if="members.length" class="rss-list">
          <li v-for="member in members" :key="member.user_id" class="rss-item">
            <div class="rss-item-main">
              <span class="rss-name">{{ member.display_name || member.user_id }}</span>
              <span class="rss-meta">{{ member.user_id }} · {{ member.membership }}</span>
            </div>
            <span v-if="member.is_hero" class="rss-badge">{{ t('room.server_summary.hero') }}</span>
          </li>
        </ul>
        <p v-else class="rss-empty">{{ sectionEmptyText('room.server_summary.members') }}</p>
      </section>

      <section class="rss-section">
        <h5 class="rss-section-title">{{ t('room.server_summary.state') }}</h5>
        <ul v-if="states.length" class="rss-list">
          <RoomServerSummaryItem
            v-for="(state, index) in states"
            :key="`${state.event_type}:${state.state_key}`"
            :name="state.event_type"
            :meta="state.state_key"
            :payload="state.content"
            :expanded="expandedKey === `state-${index}`"
            @toggle="toggle(`state-${index}`)" />
        </ul>
        <p v-else class="rss-empty">{{ sectionEmptyText('room.server_summary.state') }}</p>
      </section>

      <section class="rss-section">
        <h5 class="rss-section-title">{{ t('room.server_summary.ephemeral') }}</h5>
        <ul v-if="ephemeral.length" class="rss-list">
          <RoomServerSummaryItem
            v-for="(event, index) in ephemeral"
            :key="`ephemeral-${index}`"
            :name="ephemeralType(event)"
            :payload="event"
            :expanded="expandedKey === `ephemeral-${index}`"
            @toggle="toggle(`ephemeral-${index}`)" />
        </ul>
        <p v-else class="rss-empty">{{ sectionEmptyText('room.server_summary.ephemeral') }}</p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PartialStateBanner from '@/components/common/PartialStateBanner.vue'
import type { RoomSummaryMemberEntry, RoomSummaryStateEntry } from '@/services/matrix/room/AccountDataService'
import { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'
import { createLogger } from '@/utils/Logger'
import RoomServerSummaryItem from './RoomServerSummaryItem.vue'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()
const logger = createLogger('RoomServerSummaryPanel')

const loading = ref(false)
const error = ref(false)
const members = ref<RoomSummaryMemberEntry[]>([])
const states = ref<RoomSummaryStateEntry[]>([])
const ephemeral = ref<Record<string, unknown>[]>([])
const expandedKey = ref('')

type SummarySectionKey = 'room.server_summary.members' | 'room.server_summary.state' | 'room.server_summary.ephemeral'

/** 部分数据源失败：仍渲染可用区块，但必须显式告知「这里少了数据」，不能伪装成空态 */
const failedSectionKeys = ref<SummarySectionKey[]>([])
const partialFailure = computed(() => failedSectionKeys.value.length > 0 && failedSectionKeys.value.length < 3)
const partialMessage = computed(() => {
  const sources = failedSectionKeys.value.map((key) => t(key)).join(', ')
  return t('room.server_summary.partial_failed', { sources })
})
const isSectionFailed = (key: SummarySectionKey) => failedSectionKeys.value.includes(key)

const toggle = (key: string) => {
  expandedKey.value = expandedKey.value === key ? '' : key
}

const sectionEmptyText = (key: SummarySectionKey) =>
  isSectionFailed(key) ? t('room.server_summary.unavailable') : t('room.server_summary.empty')

const ephemeralType = (event: Record<string, unknown>): string => {
  const type = event.type
  return typeof type === 'string' ? type : '-'
}

async function load() {
  if (!props.roomId) return
  loading.value = true
  error.value = false
  expandedKey.value = ''
  failedSectionKeys.value = []
  const [memberResult, stateResult, ephemeralResult] = await Promise.allSettled([
    matrixRoomReadFacade.getRoomSummaryMembers(props.roomId),
    matrixRoomReadFacade.getRoomSummaryState(props.roomId),
    matrixRoomReadFacade.getRoomEphemeral(props.roomId)
  ])
  members.value = memberResult.status === 'fulfilled' ? memberResult.value : []
  states.value = stateResult.status === 'fulfilled' ? stateResult.value : []
  ephemeral.value = ephemeralResult.status === 'fulfilled' ? ephemeralResult.value : []
  const failed: SummarySectionKey[] = []
  if (memberResult.status === 'rejected') failed.push('room.server_summary.members')
  if (stateResult.status === 'rejected') failed.push('room.server_summary.state')
  if (ephemeralResult.status === 'rejected') failed.push('room.server_summary.ephemeral')
  failedSectionKeys.value = failed
  const allRejected = failed.length === 3
  error.value = allRejected
  if (allRejected) logger.warn('[RoomServerSummary] room summary API unavailable')
  loading.value = false
}

watch(
  () => props.roomId,
  () => void load(),
  { immediate: true }
)
</script>

<style scoped lang="scss">
.room-server-summary {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
}

.rss-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--tjg-space-2);
}

.rss-header-text {
  min-width: 0;
}

.rss-title {
  margin: 0;
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
}

.rss-subtitle {
  margin: 2px 0 0;
  font-size: var(--tjg-font-size-2xs);
  color: var(--tjg-text-tertiary);
}

.rss-refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--tjg-radius-xs);
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover:not(:disabled) {
    background-color: var(--tjg-surface-list-hover);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.rss-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--tjg-space-3) 0;
}

.rss-section {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-1);
}

.rss-section-title {
  margin: 0;
  font-size: var(--tjg-font-size-2xs);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.rss-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-1);
}

.rss-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-2);
  padding: var(--tjg-space-1) var(--tjg-space-2);
  border-radius: var(--tjg-radius-xs);
  background-color: var(--tjg-surface-subtle);
}

.rss-name {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rss-meta {
  font-size: var(--tjg-font-size-2xs);
  color: var(--tjg-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rss-badge {
  flex-shrink: 0;
  padding: 1px var(--tjg-space-1);
  border-radius: var(--tjg-radius-xs);
  background-color: var(--tjg-color-primary-50);
  color: var(--tjg-color-primary-600);
  font-size: var(--tjg-font-size-2xs);
}

.rss-empty {
  margin: 0;
  font-size: var(--tjg-font-size-2xs);
  color: var(--tjg-text-tertiary);
}

@media (prefers-reduced-motion: reduce) {
  .rss-refresh {
    transition: none;
  }
}
</style>
