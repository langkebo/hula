<template>
  <section class="room-spaces" data-testid="room-spaces">
    <div class="room-spaces__title">{{ t('room.settings_drawer.section_room_spaces') }}</div>

    <n-spin v-if="status === 'loading'" size="small" data-testid="room-spaces-loading" />

    <PartialStateBanner
      v-else-if="status === 'error'"
      compact
      data-testid="room-spaces-error"
      :message="t('room.settings_drawer.room_spaces_load_failed')"
      :retry-text="t('common.retry')"
      @retry="load" />

    <p v-else-if="status === 'unsupported'" class="room-spaces__hint" data-testid="room-spaces-unsupported">
      {{ t('room.settings_drawer.room_spaces_unsupported') }}
    </p>

    <p v-else-if="status === 'empty'" class="room-spaces__hint" data-testid="room-spaces-empty">
      {{ t('room.settings_drawer.room_spaces_empty') }}
    </p>

    <ul v-else class="room-spaces__list">
      <li v-for="space in spaces" :key="space.roomId" class="room-spaces__item" data-testid="room-spaces-item">
        <span class="room-spaces__name">{{ space.name || space.roomId }}</span>
        <span v-if="space.canonicalAlias" class="room-spaces__alias">{{ space.canonicalAlias }}</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PartialStateBanner from '@/components/common/PartialStateBanner.vue'
import type { RoomSpaceMembership } from '@/services/matrix/room/MetadataService'
import { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()

type SectionStatus = 'loading' | 'ok' | 'empty' | 'unsupported' | 'error'

const status = ref<SectionStatus>('loading')
const spaces = ref<RoomSpaceMembership[]>([])

async function load() {
  status.value = 'loading'
  const outcome = await matrixRoomReadFacade.getRoomSpaces(props.roomId)
  if (outcome.status === 'ok') {
    spaces.value = outcome.spaces
    status.value = 'ok'
    return
  }
  spaces.value = []
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
.room-spaces {
  display: flex;
  flex-direction: column;
}

.room-spaces__title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
  margin-bottom: 6px;
}

.room-spaces__hint {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
  margin: 0;
}

.room-spaces__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.room-spaces__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  background: var(--tjg-surface-app);
  border-radius: var(--tjg-radius-sm);
}

.room-spaces__name {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
}

.room-spaces__alias {
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
}
</style>
