<template>
  <div class="workbench-forward-pane">
    <div class="workbench-forward-pane__header">
      <span class="text-13px font-600">{{ t('message.forward.title') }}</span>
      <button type="button" class="workbench-forward-pane__close" @click="emit('close')">
        {{ t('common.close') }}
      </button>
    </div>

    <div class="workbench-forward-pane__search">
      <n-input
        v-model:value="searchQuery"
        size="small"
        :placeholder="t('message.forward.search_placeholder')"
        clearable>
        <template #prefix>
          <svg class="size-14px"><use href="#search" /></svg>
        </template>
      </n-input>
    </div>

    <div class="workbench-forward-pane__list">
      <n-scrollbar style="max-height: 320px">
        <div
          v-for="room in filteredRooms"
          :key="room.roomId"
          class="workbench-forward-pane__item"
          :class="{ 'workbench-forward-pane__item--selected': selectedRooms.includes(room.roomId) }"
          @click="toggleRoom(room.roomId)">
          <n-checkbox :checked="selectedRooms.includes(room.roomId)" @update:checked="toggleRoom(room.roomId)" />
          <n-avatar round :size="28" :src="room.avatar" :fallback-src="defaultAvatar" />
          <div class="workbench-forward-pane__item-info">
            <span class="workbench-forward-pane__item-name">{{ room.name }}</span>
            <svg v-if="room.isEncrypted" class="size-12px color-[--hula-color-primary-500]"><use href="#lock" /></svg>
          </div>
        </div>

        <div v-if="filteredRooms.length === 0" class="workbench-forward-pane__empty">
          <span class="text-12px color-[--hula-text-tertiary]">{{ t('message.forward.no_rooms') }}</span>
        </div>
      </n-scrollbar>
    </div>

    <div v-if="selectedRooms.length > 0" class="workbench-forward-pane__summary">
      <span class="text-12px color-[--hula-text-tertiary]">
        {{ t('message.forward.selected_count', { count: selectedRooms.length }) }}
      </span>
    </div>

    <div class="workbench-forward-pane__footer">
      <n-button size="small" @click="emit('close')">{{ t('common.cancel') }}</n-button>
      <n-button
        size="small"
        type="primary"
        :disabled="selectedRooms.length === 0"
        :loading="forwarding"
        @click="handleForward">
        {{ t('message.forward.send') }}
        <template v-if="selectedRooms.length > 0">({{ selectedRooms.length }})</template>
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { matrixForwardService } from '@/services/matrix/messaging/MatrixForwardService'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { useRoomStore } from '@/stores/domains/chat/room'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WorkbenchForwardPane')

const props = defineProps<{
  eventId?: string
  roomId?: string
}>()

const emit = defineEmits<{
  close: []
  forwarded: [roomIds: string[]]
}>()

const { t } = useI18n()
const roomStore = useRoomStore()
const searchQuery = ref('')
const selectedRooms = ref<string[]>([])
const forwarding = ref(false)
const defaultAvatar = '/logoD.png'

const filteredRooms = computed(() => {
  const roomsMap = roomStore.rooms
  if (!roomsMap) return []
  const rooms = Array.from(roomsMap.values())
  const query = searchQuery.value.toLowerCase()

  return rooms
    .filter((room) => room.roomId !== (props.roomId ?? ''))
    .filter((room) => !query || room.name?.toLowerCase().includes(query))
    .map((room) => ({
      roomId: room.roomId,
      name: room.name || room.roomId,
      avatar: AvatarUtils.getAvatarUrl(room.avatarUrl || ''),
      isEncrypted: room.isEncrypted || false
    }))
})

const toggleRoom = (roomId: string) => {
  const index = selectedRooms.value.indexOf(roomId)
  if (index === -1) {
    selectedRooms.value.push(roomId)
  } else {
    selectedRooms.value.splice(index, 1)
  }
}

const handleForward = async () => {
  if (selectedRooms.value.length === 0) return

  forwarding.value = true
  try {
    const event = await matrixMessageService.getRoomMessage(props.roomId ?? '', props.eventId ?? '')
    if (!event) return

    const results = await matrixForwardService.forwardEventToMultipleRooms(event, selectedRooms.value)
    const successCount = results.filter((r) => r.success).length

    if (successCount > 0) {
      window.$message?.success(t('message.forward.success', { count: successCount }))
      emit('forwarded', selectedRooms.value)
      selectedRooms.value = []
    } else {
      window.$message?.error(t('message.forward.failed'))
    }
  } catch (error) {
    logger.error('Forward failed:', error)
    window.$message?.error(t('message.forward.failed'))
  } finally {
    forwarding.value = false
  }
}
</script>

<style scoped lang="scss">
.workbench-forward-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
}

.workbench-forward-pane__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.workbench-forward-pane__close {
  border: 0;
  background: transparent;
  color: var(--hula-text-tertiary);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
    color: var(--hula-text-primary);
  }
}

.workbench-forward-pane__search {
  margin-bottom: 12px;
}

.workbench-forward-pane__list {
  flex: 1;
  min-height: 0;
}

.workbench-forward-pane__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--hula-fill-hover);
  }

  &--selected {
    background: var(--hula-color-primary-100);
  }
}

.workbench-forward-pane__item-info {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.workbench-forward-pane__item-name {
  overflow: hidden;
  color: var(--hula-text-primary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workbench-forward-pane__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
}

.workbench-forward-pane__summary {
  padding: 8px 0;
  border-top: 1px solid var(--hula-border-default);
}

.workbench-forward-pane__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--hula-border-default);
}
</style>
