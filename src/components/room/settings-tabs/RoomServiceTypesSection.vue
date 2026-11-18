<template>
  <section class="rs-tab__section" data-testid="room-service-types">
    <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_service_types') }}</h4>

    <n-spin v-if="status === 'loading'" size="small" data-testid="service-types-loading" />

    <div v-else-if="status === 'error'" class="rs-service-types__state" data-testid="service-types-error">
      <span class="rs-service-types__hint">{{ t('room.settings_drawer.service_types_load_failed') }}</span>
      <n-button size="small" data-testid="service-types-retry" @click="load">
        {{ t('common.retry') }}
      </n-button>
    </div>

    <p v-else-if="status === 'unsupported'" class="rs-service-types__hint" data-testid="service-types-unsupported">
      {{ t('room.settings_drawer.service_types_unsupported') }}
    </p>

    <p v-else-if="status === 'empty'" class="rs-service-types__hint" data-testid="service-types-empty">
      {{ t('room.settings_drawer.service_types_empty') }}
    </p>

    <div v-else class="rs-service-types__list">
      <span
        v-for="serviceType in serviceTypes"
        :key="serviceType"
        class="rs-service-types__item"
        data-testid="service-types-item">
        {{ labelOf(serviceType) }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()

type SectionStatus = 'loading' | 'ok' | 'empty' | 'unsupported' | 'error'

const KNOWN_SERVICE_TYPE_KEYS: Record<string, string> = {
  messaging: 'room.settings_drawer.service_type_messaging',
  encryption: 'room.settings_drawer.service_type_encryption',
  directory: 'room.settings_drawer.service_type_directory'
}

const status = ref<SectionStatus>('loading')
const serviceTypes = ref<string[]>([])

const labelOf = (serviceType: string) => {
  const key = KNOWN_SERVICE_TYPE_KEYS[serviceType]
  return key ? t(key) : serviceType
}

async function load() {
  status.value = 'loading'
  const outcome = await matrixRoomReadFacade.getRoomServiceTypes(props.roomId)
  if (outcome.status === 'ok') {
    serviceTypes.value = outcome.serviceTypes
    status.value = 'ok'
    return
  }
  serviceTypes.value = []
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
  margin-bottom: 10px;
}

.rs-service-types__state {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rs-service-types__hint {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-tertiary);
  margin: 0;
}

.rs-service-types__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rs-service-types__item {
  padding: 2px 8px;
  border: 1px solid var(--tjg-border-muted);
  border-radius: 4px;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
}
</style>
