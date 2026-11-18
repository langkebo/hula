<template>
  <div class="rs-history">
    <n-spin v-if="status === 'loading'" size="small" data-testid="membership-history-loading" />

    <div v-else-if="status === 'error'" data-testid="membership-history-error">
      <PartialStateBanner
        :message="t('room.settings_drawer.membership_history_load_failed')"
        :retry-text="t('common.retry')"
        @retry="load" />
    </div>

    <div v-else-if="status === 'unsupported'" data-testid="membership-history-unsupported">
      <PartialStateBanner :message="t('room.settings_drawer.membership_history_unsupported')" />
    </div>

    <p v-else-if="status === 'empty'" class="rs-history__hint" data-testid="membership-history-empty">
      {{ t('room.settings_drawer.membership_history_empty') }}
    </p>

    <template v-else>
      <p class="rs-history__hint">{{ t('room.settings_drawer.membership_history_limit_hint') }}</p>
      <ul class="rs-history__list">
        <li v-for="event in events" :key="event.eventId" class="rs-history__item" data-testid="membership-history-item">
          <span
            :class="['rs-history__action', `rs-history__action--${toneOf(event.membership)}`]"
            data-testid="membership-history-action">
            {{ labelOf(event.membership) }}
          </span>
          <span class="rs-history__user" data-testid="membership-history-user">{{ event.userId }}</span>
          <span class="rs-history__meta">
            <span data-testid="membership-history-sender">{{ event.sender }}</span>
            <span data-testid="membership-history-time">{{ formatChatTime(event.timestamp) }}</span>
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PartialStateBanner from '@/components/common/PartialStateBanner.vue'
import type { RoomMembershipEvent } from '@/services/matrix/room/MembershipService'
import { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'
import { formatChatTime } from '@/utils/ComputedTime'
import { membershipActionLabelKey, membershipActionTone } from './membershipActionMeta'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()

const MEMBERSHIP_EVENTS_LIMIT = 100

type TabStatus = 'loading' | 'ok' | 'empty' | 'unsupported' | 'error'

const status = ref<TabStatus>('loading')
const events = ref<RoomMembershipEvent[]>([])

const labelOf = (membership: string) => {
  const key = membershipActionLabelKey(membership)
  return key ? t(key) : membership
}

const toneOf = membershipActionTone

async function load() {
  status.value = 'loading'
  const outcome = await matrixRoomReadFacade.getMembershipEvents(props.roomId, MEMBERSHIP_EVENTS_LIMIT)
  if (outcome.status === 'ok') {
    events.value = outcome.events
    status.value = 'ok'
    return
  }
  events.value = []
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
.rs-history {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rs-history__hint {
  margin: 0;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
}

.rs-history__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rs-history__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--tjg-border-muted);
  border-radius: var(--tjg-radius-sm);
  background: var(--tjg-surface-app);
}

.rs-history__action {
  flex: none;
  padding: 1px 8px;
  border-radius: var(--tjg-radius-xs);
  font-size: var(--tjg-font-size-xs);
  font-weight: var(--tjg-font-weight-medium);
  border: 1px solid currentColor;
}

.rs-history__action--positive {
  color: var(--tjg-color-success-500);
}

.rs-history__action--negative {
  color: var(--tjg-color-danger-500);
}

.rs-history__action--warning {
  color: var(--tjg-color-warning-500);
}

.rs-history__action--info {
  color: var(--tjg-color-primary-500);
}

.rs-history__action--neutral {
  color: var(--tjg-text-secondary);
}

.rs-history__user {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
}

.rs-history__meta {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
}
</style>
