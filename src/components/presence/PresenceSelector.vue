<template>
  <n-dropdown :options="presenceOptions" @select="handleSelect" trigger="click">
    <n-button size="small" secondary>
      <template #icon>
        <span class="presence-dot" :class="currentPresence"></span>
      </template>
      {{ currentLabel }}
    </n-button>
  </n-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PresenceStatus } from '@/services/matrix/MatrixPresenceService'
import matrixPresenceService from '@/services/matrix/MatrixPresenceService'

const props = withDefaults(
  defineProps<{
    presence?: PresenceStatus
  }>(),
  {
    presence: 'online'
  }
)

const emit = defineEmits<{
  (e: 'update:presence', value: PresenceStatus): void
  (e: 'change', value: PresenceStatus): void
}>()

const { t } = useI18n()

const currentPresence = computed(() => props.presence)

const currentLabel = computed(() => {
  switch (props.presence) {
    case 'online':
      return t('presence.online', '在线')
    case 'unavailable':
      return t('presence.unavailable', '离开')
    case 'busy':
      return t('presence.busy', '忙碌')
    case 'offline':
      return t('presence.offline', '离线')
    default:
      return t('presence.online', '在线')
  }
})

const presenceOptions = computed(() => [
  { label: t('presence.online', '在线'), key: 'online' },
  { label: t('presence.unavailable', '离开'), key: 'unavailable' },
  { label: t('presence.busy', '忙碌'), key: 'busy' },
  { label: t('presence.offline', '离线'), key: 'offline' }
])

async function handleSelect(key: string) {
  const status = key as PresenceStatus
  try {
    await matrixPresenceService.setPresence(status)
    emit('update:presence', status)
    emit('change', status)
  } catch {
    // error handled by service
  }
}
</script>

<style scoped lang="scss">
.presence-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &.online {
    background-color: #52c41a;
  }

  &.unavailable {
    background-color: #faad14;
  }

  &.busy {
    background-color: #f5222d;
  }

  &.offline {
    background-color: #bfbfbf;
  }
}
</style>
