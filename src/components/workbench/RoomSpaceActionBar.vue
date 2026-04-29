<template>
  <div
    class="room-space-action-bar border-b border-[--hula-border-default] px-12px py-10px"
    :class="{ 'room-space-action-bar--compact': compact }">
    <n-flex align="center" justify="space-between" :size="12" wrap>
      <n-flex vertical :size="4" class="min-w-0">
        <span class="truncate text-14px font-500">{{ spaceName }}</span>
        <span class="text-12px color-[--hula-text-tertiary]">
          {{ roomCount }} {{ t('space.rooms') }} · {{ t('space.sessions_count', { count: sessionCount }) }}
        </span>
      </n-flex>

      <n-flex align="center" :size="8" wrap>
        <n-button size="small" secondary :disabled="!canManageSpace" @click="handleInvite">
          <template #icon>
            <svg class="size-14px">
              <use href="#add-user"></use>
            </svg>
          </template>
          {{ t('space.invite') }}
        </n-button>
        <n-button size="small" secondary :disabled="!canManageSpace" @click="handleAddRoom">
          <template #icon>
            <svg class="size-14px">
              <use href="#add"></use>
            </svg>
          </template>
          {{ t('space.add_room') }}
        </n-button>
        <n-button size="small" secondary :disabled="!canManageSpace" @click="handleSettings">
          <template #icon>
            <svg class="size-14px">
              <use href="#setting"></use>
            </svg>
          </template>
          {{ t('space.settings') }}
        </n-button>
      </n-flex>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { spaceName, roomCount, sessionCount, canManageSpace } = defineProps<{
  spaceName: string
  roomCount: number
  sessionCount: number
  canManageSpace: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  invite: []
  addRoom: []
  settings: []
}>()

const { t } = useI18n()

const handleInvite = () => {
  if (!canManageSpace) return
  emit('invite')
}

const handleAddRoom = () => {
  if (!canManageSpace) return
  emit('addRoom')
}

const handleSettings = () => {
  if (!canManageSpace) return
  emit('settings')
}
</script>

<style scoped lang="scss">
.room-space-action-bar {
  background: var(--hula-surface-panel);
}

.room-space-action-bar--compact {
  padding: 10px;
}
</style>
