<template>
  <section class="rs-tab__section" data-testid="room-permission-snapshot">
    <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_permission_snapshot') }}</h4>
    <p class="rs-permission-snapshot__hint">{{ t('room.settings_drawer.permission_snapshot_hint') }}</p>

    <n-spin v-if="status === 'loading'" size="small" data-testid="permission-snapshot-loading" />

    <PartialStateBanner
      v-else-if="status === 'error'"
      compact
      data-testid="permission-snapshot-error"
      :message="t('room.settings_drawer.permission_snapshot_load_failed')"
      :retry-text="t('common.retry')"
      @retry="load" />

    <p
      v-else-if="status === 'unsupported'"
      class="rs-permission-snapshot__hint"
      data-testid="permission-snapshot-unsupported">
      {{ t('room.settings_drawer.permission_snapshot_unsupported') }}
    </p>

    <p v-else-if="status === 'empty'" class="rs-permission-snapshot__hint" data-testid="permission-snapshot-empty">
      {{ t('room.settings_drawer.permission_snapshot_empty') }}
    </p>

    <div v-else class="rs-permission-snapshot__list">
      <div class="rs-permission-snapshot__row">
        <span class="rs-permission-snapshot__label">
          {{ t('room.settings_drawer.permission_snapshot_power_level') }}
        </span>
        <span class="rs-permission-snapshot__value" data-testid="permission-snapshot-power-level">
          {{ snapshot?.powerLevel ?? t('room.settings_drawer.permission_snapshot_unknown') }}
        </span>
      </div>
      <div
        v-for="item in capabilityItems"
        :key="item.key"
        class="rs-permission-snapshot__row"
        :data-testid="`permission-snapshot-${item.key}`">
        <span class="rs-permission-snapshot__label">{{ t(item.labelKey) }}</span>
        <span class="rs-permission-snapshot__value" :data-state="item.state">{{ labelOf(item.state) }}</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PartialStateBanner from '@/components/common/PartialStateBanner.vue'
import type { RoomPermissionSnapshot } from '@/services/matrix/room/MetadataService'
import { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()

type SectionStatus = 'loading' | 'ok' | 'empty' | 'unsupported' | 'error'
type CapabilityState = boolean | null

const status = ref<SectionStatus>('loading')
const snapshot = ref<RoomPermissionSnapshot | null>(null)

const capabilityItems = computed<Array<{ key: string; labelKey: string; state: CapabilityState }>>(() => [
  {
    key: 'can-send',
    labelKey: 'room.settings_drawer.permission_snapshot_can_send',
    state: snapshot.value?.canSend ?? null
  },
  {
    key: 'can-invite',
    labelKey: 'room.settings_drawer.permission_snapshot_can_invite',
    state: snapshot.value?.canInvite ?? null
  },
  {
    key: 'can-kick',
    labelKey: 'room.settings_drawer.permission_snapshot_can_kick',
    state: snapshot.value?.canKick ?? null
  },
  {
    key: 'can-ban',
    labelKey: 'room.settings_drawer.permission_snapshot_can_ban',
    state: snapshot.value?.canBan ?? null
  },
  {
    key: 'can-redact',
    labelKey: 'room.settings_drawer.permission_snapshot_can_redact',
    state: snapshot.value?.canRedact ?? null
  }
])

const labelOf = (state: CapabilityState) => {
  if (state === true) return t('room.settings_drawer.permission_snapshot_allowed')
  if (state === false) return t('room.settings_drawer.permission_snapshot_denied')
  return t('room.settings_drawer.permission_snapshot_unknown')
}

async function load() {
  status.value = 'loading'
  const outcome = await matrixRoomReadFacade.getRoomPermissions(props.roomId)
  if (outcome.status === 'ok') {
    snapshot.value = outcome.permissions
    status.value = 'ok'
    return
  }
  snapshot.value = null
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
.rs-tab__section {
  display: flex;
  flex-direction: column;
}

.rs-tab__section-title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
  margin-bottom: 6px;
}

.rs-permission-snapshot__hint {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
  margin: 0 0 8px 0;
}

.rs-permission-snapshot__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rs-permission-snapshot__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: var(--tjg-surface-app);
  border-radius: var(--tjg-radius-sm);
}

.rs-permission-snapshot__label {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
}

.rs-permission-snapshot__value {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
}

.rs-permission-snapshot__value[data-state='true'] {
  color: var(--tjg-color-success-500);
}

.rs-permission-snapshot__value[data-state='false'] {
  color: var(--tjg-color-danger-500);
}
</style>
