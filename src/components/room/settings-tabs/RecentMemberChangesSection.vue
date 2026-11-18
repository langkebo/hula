<template>
  <section class="rs-recent" data-testid="recent-member-changes">
    <div class="rs-recent__head">
      <h4 class="rs-recent__title">{{ t('room.settings_drawer.section_recent_members') }}</h4>
      <span class="rs-recent__hint">{{ t('room.settings_drawer.recent_members_hint') }}</span>
    </div>

    <n-spin v-if="status === 'loading'" size="small" data-testid="recent-members-loading" />

    <div v-else-if="status === 'error'" data-testid="recent-members-error">
      <PartialStateBanner
        compact
        :message="t('room.settings_drawer.recent_members_load_failed')"
        :retry-text="t('common.retry')"
        @retry="load" />
    </div>

    <div v-else-if="status === 'unsupported'" data-testid="recent-members-unsupported">
      <PartialStateBanner compact :message="t('room.settings_drawer.recent_members_unsupported')" />
    </div>

    <p v-else-if="status === 'empty'" class="rs-recent__empty" data-testid="recent-members-empty">
      {{ t('room.settings_drawer.recent_members_empty') }}
    </p>

    <ul v-else class="rs-recent__list">
      <li
        v-for="change in changes"
        :key="change.eventId || `${change.userId}:${change.membership}:${change.timestamp}`"
        class="rs-recent__item"
        data-testid="recent-members-item">
        <span
          :class="['rs-recent__action', `rs-recent__action--${toneOf(change.membership)}`]"
          data-testid="recent-members-action">
          {{ labelOf(change.membership) }}
        </span>
        <span class="rs-recent__name" data-testid="recent-members-name">{{ nameOf(change) }}</span>
        <span class="rs-recent__time" data-testid="recent-members-time">{{ formatChatTime(change.timestamp) }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PartialStateBanner from '@/components/common/PartialStateBanner.vue'
import type { RoomRecentMemberChange } from '@/services/matrix/room/MembershipService'
import { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'
import { formatChatTime } from '@/utils/ComputedTime'
import { membershipActionLabelKey, membershipActionTone } from './membershipActionMeta'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()

const RECENT_MEMBERS_LIMIT = 8

type SectionStatus = 'loading' | 'ok' | 'empty' | 'unsupported' | 'error'

const status = ref<SectionStatus>('loading')
const changes = ref<RoomRecentMemberChange[]>([])

const nameOf = (change: RoomRecentMemberChange) => change.displayName || change.userId

const labelOf = (membership: string) => {
  const key = membershipActionLabelKey(membership)
  return key ? t(key) : membership
}

const toneOf = membershipActionTone

async function load() {
  status.value = 'loading'
  const outcome = await matrixRoomReadFacade.getRecentMemberChanges(props.roomId, RECENT_MEMBERS_LIMIT)
  if (outcome.status === 'ok') {
    changes.value = outcome.changes
    status.value = 'ok'
    return
  }
  changes.value = []
  status.value = outcome.status
}

watch(
  () => props.roomId,
  () => {
    load()
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.rs-recent {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rs-recent__head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.rs-recent__title {
  margin: 0;
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
}

.rs-recent__hint {
  font-size: var(--tjg-font-size-2xs);
  color: var(--tjg-text-tertiary);
}

.rs-recent__empty {
  margin: 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
}

.rs-recent__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rs-recent__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--tjg-border-muted);
  border-radius: var(--tjg-radius-sm);
  background: var(--tjg-surface-app);
}

.rs-recent__action {
  flex: none;
  padding: 1px 8px;
  border-radius: var(--tjg-radius-xs);
  font-size: var(--tjg-font-size-xs);
  font-weight: var(--tjg-font-weight-medium);
  border: 1px solid currentColor;
}

.rs-recent__action--positive {
  color: var(--tjg-color-success-500);
}

.rs-recent__action--negative {
  color: var(--tjg-color-danger-500);
}

.rs-recent__action--warning {
  color: var(--tjg-color-warning-500);
}

.rs-recent__action--info {
  color: var(--tjg-color-primary-500);
}

.rs-recent__action--neutral {
  color: var(--tjg-text-secondary);
}

.rs-recent__name {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
}

.rs-recent__time {
  flex: none;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
}
</style>
