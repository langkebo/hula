<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('message.forward.title')"
    :style="{ width: '400px' }"
    :bordered="false"
    @update:show="$emit('update:visible', $event)">
    <div class="forward-dialog">
      <n-input v-model:value="searchQuery" :placeholder="t('message.forward.search_placeholder')" clearable>
        <template #prefix>
          <svg class="size-16px">
            <use href="#search"></use>
          </svg>
        </template>
      </n-input>

      <div class="room-list">
        <n-scrollbar style="max-height: 300px">
          <div
            v-for="room in filteredRooms"
            :key="room.roomId"
            class="room-item"
            :class="{ selected: selectedRooms.includes(room.roomId) }"
            @click="toggleRoom(room.roomId)">
            <n-checkbox :checked="selectedRooms.includes(room.roomId)" @update:checked="toggleRoom(room.roomId)" />
            <n-avatar round :size="36" :src="room.avatar" :fallback-src="defaultAvatar" />
            <div class="room-info">
              <span class="room-name">{{ room.name }}</span>
              <span v-if="room.isEncrypted" class="encrypted-badge">
                <svg class="size-12px">
                  <use href="#lock"></use>
                </svg>
              </span>
            </div>
          </div>
        </n-scrollbar>
      </div>

      <div class="dialog-footer">
        <n-button @click="handleCancel">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :disabled="selectedRooms.length === 0" :loading="forwarding" @click="handleForward">
          {{ t('message.forward.send') }}
          <template v-if="selectedRooms.length > 0">({{ selectedRooms.length }})</template>
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { matrixForwardService, matrixMessageService } from '@/services/matrix'
import { useRoomStore } from '@/stores/domains/chat/room'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('ForwardDialog')

const props = defineProps<{
  visible: boolean
  eventId: string
  roomId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'forwarded', roomIds: string[]): void
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
    .filter((room: any) => room.roomId !== props.roomId)
    .filter((room: any) => !query || room.name?.toLowerCase().includes(query))
    .map((room: any) => ({
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

const handleCancel = () => {
  emit('update:visible', false)
  selectedRooms.value = []
}

const handleForward = async () => {
  if (selectedRooms.value.length === 0) return

  forwarding.value = true
  try {
    const event = await matrixMessageService.getRoomMessage(props.roomId, props.eventId)
    if (!event) return

    const results = await matrixForwardService.forwardEventToMultipleRooms(event, selectedRooms.value)
    const successCount = results.filter((r) => r.success).length

    if (successCount > 0) {
      window.$message?.success(t('message.forward.success', { count: successCount }))
      emit('forwarded', selectedRooms.value)
      emit('update:visible', false)
      selectedRooms.value = []
    } else {
      window.$message?.error(t('message.forward.failed'))
    }
  } catch (error) {
    logger.error('转发失败:', error)
    window.$message?.error(t('message.forward.failed'))
  } finally {
    forwarding.value = false
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      selectedRooms.value = []
      searchQuery.value = ''
    }
  }
)
</script>

<style scoped lang="scss">
.forward-dialog {
  @apply flex flex-col gap-16px;
}

.room-list {
  @apply flex flex-col gap-4px;
}

.room-item {
  @apply flex items-center gap-12px p-8px rounded-8px cursor-pointer transition-all;

  &:hover {
    background: var(--emoji-hover);
  }

  &.selected {
    background: var(--color-primary-light);
  }
}

.room-info {
  @apply flex items-center gap-6px flex-1 min-w-0;
}

.room-name {
  @apply text-14px truncate;
}

.encrypted-badge {
  @apply flex-center color-[--color-primary];
}

.dialog-footer {
  @apply flex justify-end gap-12px pt-8px border-t-1px border-solid border-[--border-color];
}
</style>
