<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('space.add_room.title')"
    :style="{ width: '400px' }"
    :bordered="false"
    @update:show="$emit('update:visible', $event)">
    <div class="add-room-dialog">
      <n-input
        v-model:value="searchQuery"
        :placeholder="t('space.add_room.search_placeholder')"
        clearable>
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
            :class="{ selected: selectedRoomId === room.roomId }"
            @click="selectedRoomId = room.roomId">
            <n-radio :checked="selectedRoomId === room.roomId" />
            <n-avatar
              round
              :size="32"
              :src="room.avatar"
              :fallback-src="defaultAvatar" />
            <div class="room-info">
              <span class="room-name">{{ room.name }}</span>
              <span v-if="room.isSpace" class="space-badge">{{ t('space.space') }}</span>
            </div>
          </div>
        </n-scrollbar>
      </div>

      <div class="options">
        <n-checkbox v-model:checked="suggested">
          {{ t('space.add_room.suggested') }}
        </n-checkbox>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <n-button @click="$emit('update:visible', false)">{{ t('common.cancel') }}</n-button>
        <n-button
          type="primary"
          :disabled="!selectedRoomId"
          :loading="adding"
          @click="handleAdd">
          {{ t('space.add_room.add') }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { matrixSpaceService } from '@/services/matrix'
import { useRoomStore } from '@/stores/room'
import { AvatarUtils } from '@/utils/AvatarUtils'

const props = defineProps<{
  visible: boolean
  spaceId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'added', roomId: string): void
}>()

const { t } = useI18n()
const roomStore = useRoomStore()
const searchQuery = ref('')
const selectedRoomId = ref<string>('')
const suggested = ref(false)
const adding = ref(false)
const defaultAvatar = '/logoD.png'

const filteredRooms = computed(() => {
  const roomsMap = roomStore.rooms
  if (!roomsMap) return []
  const rooms = Array.from(roomsMap.values())
  const query = searchQuery.value.toLowerCase()

  return rooms
    .filter((room: any) => room.roomId !== props.spaceId)
    .filter((room: any) => !query || room.name?.toLowerCase().includes(query))
    .map((room: any) => ({
      roomId: room.roomId,
      name: room.name || room.roomId,
      avatar: AvatarUtils.getAvatarUrl(room.avatarUrl || ''),
      isSpace: room.roomType === 'm.space'
    }))
})

const handleAdd = async () => {
  if (!selectedRoomId.value || !props.spaceId) return

  adding.value = true
  try {
    await matrixSpaceService.addChildToSpace({
      spaceId: props.spaceId,
      childRoomId: selectedRoomId.value,
      suggested: suggested.value
    })

    window.$message?.success(t('space.add_room.success'))
    emit('added', selectedRoomId.value)
    emit('update:visible', false)
    selectedRoomId.value = ''
  } catch (error) {
    console.error('[AddToSpaceDialog] 添加房间失败:', error)
    window.$message?.error(t('space.add_room.failed'))
  } finally {
    adding.value = false
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      selectedRoomId.value = ''
      searchQuery.value = ''
    }
  }
)
</script>

<style scoped lang="scss">
.add-room-dialog {
  @apply flex flex-col gap-12px;
}

.room-list {
  @apply flex flex-col gap-4px;
}

.room-item {
  @apply flex items-center gap-10px p-8px rounded-8px cursor-pointer transition-all;

  &:hover {
    background: var(--emoji-hover);
  }

  &.selected {
    background: rgba(19, 152, 127, 0.1);
  }
}

.room-info {
  @apply flex items-center gap-6px flex-1 min-w-0;
}

.room-name {
  @apply text-14px truncate;
}

.space-badge {
  @apply text-10px px-4px py-1px bg-#13987f20 text-#13987f rounded-4px;
}

.options {
  @apply pt-8px border-t-1px border-solid border-[--border-color];
}

.dialog-footer {
  @apply flex justify-end gap-12px;
}
</style>
