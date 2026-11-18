<template>
  <section class="room-turn" data-testid="room-turn-server">
    <div class="room-turn__title">{{ t('room.settings_drawer.section_turn_server') }}</div>
    <p class="room-turn__hint">{{ t('room.settings_drawer.turn_server_hint') }}</p>

    <n-spin v-if="status === 'loading'" size="small" data-testid="turn-server-loading" />

    <PartialStateBanner
      v-else-if="status === 'error'"
      compact
      data-testid="turn-server-error"
      :message="t('room.settings_drawer.turn_server_load_failed')"
      :retry-text="t('common.retry')"
      @retry="load" />

    <p v-else-if="status === 'unsupported'" class="room-turn__hint" data-testid="turn-server-unsupported">
      {{ t('room.settings_drawer.turn_server_unsupported') }}
    </p>

    <p v-else-if="status === 'empty'" class="room-turn__hint" data-testid="turn-server-empty">
      {{ t('room.settings_drawer.turn_server_empty') }}
    </p>

    <div v-else class="room-turn__body">
      <ul class="room-turn__uris">
        <li v-for="uri in uris" :key="uri" class="room-turn__uri" data-testid="turn-server-uri">
          {{ uri }}
        </li>
      </ul>
      <div v-if="ttl !== null" class="room-turn__ttl" data-testid="turn-server-ttl">
        {{ t('room.settings_drawer.turn_server_ttl') }}: {{ ttl }}
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PartialStateBanner from '@/components/common/PartialStateBanner.vue'
import { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()

type SectionStatus = 'loading' | 'ok' | 'empty' | 'unsupported' | 'error'

const status = ref<SectionStatus>('loading')
const uris = ref<string[]>([])
const ttl = ref<number | null>(null)

async function load() {
  status.value = 'loading'
  const outcome = await matrixRoomReadFacade.getRoomTurnServer(props.roomId)
  if (outcome.status === 'ok') {
    uris.value = outcome.config.uris
    ttl.value = outcome.config.ttl
    status.value = 'ok'
    return
  }
  uris.value = []
  ttl.value = null
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
.room-turn {
  display: flex;
  flex-direction: column;
}

.room-turn__title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
  margin-bottom: 6px;
}

.room-turn__hint {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
  margin: 0 0 8px 0;
}

.room-turn__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.room-turn__uris {
  display: flex;
  flex-direction: column;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.room-turn__uri {
  padding: 4px 8px;
  background: var(--tjg-surface-app);
  border-radius: var(--tjg-radius-sm);
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-primary);
  word-break: break-all;
}

.room-turn__ttl {
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
}
</style>
