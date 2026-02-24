<template>
  <div class="space-panel">
    <div class="space-header">
      <span class="space-title">{{ t('space.title') }}</span>
      <n-button text @click="showCreateDialog = true">
        <template #icon>
          <svg class="size-18px">
            <use href="#add"></use>
          </svg>
        </template>
      </n-button>
    </div>

    <div class="space-list">
      <n-scrollbar>
        <div
          v-for="space in spaces"
          :key="space.roomId"
          class="space-item"
          :class="{ active: activeSpaceId === space.roomId }"
          @click="handleSpaceClick(space)">
          <n-avatar
            round
            :size="40"
            :src="space.avatarUrl"
            :fallback-src="defaultAvatar" />
          <div class="space-info">
            <span class="space-name">{{ space.name }}</span>
            <span class="space-meta">
              {{ space.memberCount }} {{ t('space.members') }}
              <span v-if="space.isPublic"> · {{ t('space.public') }}</span>
            </span>
          </div>
        </div>
      </n-scrollbar>
    </div>

    <div v-if="activeSpace" class="space-children">
      <div class="children-header">
        <span class="children-title">{{ activeSpace.name }}</span>
        <n-button text size="tiny" @click="showAddRoomDialog = true">
          <template #icon>
            <svg class="size-14px">
              <use href="#add"></use>
            </svg>
          </template>
        </n-button>
      </div>
      <n-scrollbar>
        <div
          v-for="child in spaceChildren"
          :key="child.roomId"
          class="child-item"
          @click="handleRoomClick(child)">
          <n-avatar
            round
            :size="32"
            :src="child.avatarUrl"
            :fallback-src="defaultAvatar" />
          <div class="child-info">
            <span class="child-name">{{ child.name }}</span>
            <span v-if="child.isSpace" class="space-badge">{{ t('space.space') }}</span>
          </div>
        </div>
      </n-scrollbar>
    </div>

    <CreateSpaceDialog
      v-model:visible="showCreateDialog"
      @created="handleSpaceCreated" />

    <AddToSpaceDialog
      v-model:visible="showAddRoomDialog"
      :space-id="activeSpaceId"
      @added="handleRoomAdded" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { matrixSpaceService, type Space, type SpaceChild } from '@/services/matrix'
import CreateSpaceDialog from './CreateSpaceDialog.vue'
import AddToSpaceDialog from './AddToSpaceDialog.vue'

const emit = defineEmits<{
  (e: 'space-selected', space: Space): void
  (e: 'room-selected', roomId: string): void
}>()

const { t } = useI18n()
const spaces = ref<Space[]>([])
const spaceChildren = ref<SpaceChild[]>([])
const activeSpaceId = ref<string>('')
const showCreateDialog = ref(false)
const showAddRoomDialog = ref(false)
const defaultAvatar = '/logoD.png'

const activeSpace = computed(() => {
  return spaces.value.find((s) => s.roomId === activeSpaceId.value)
})

const loadSpaces = async () => {
  try {
    spaces.value = matrixSpaceService.getJoinedSpaces()
  } catch (error) {
    console.error('[SpacePanel] 加载空间列表失败:', error)
  }
}

const loadSpaceChildren = async (spaceId: string) => {
  try {
    spaceChildren.value = await matrixSpaceService.getSpaceChildren(spaceId)
  } catch (error) {
    console.error('[SpacePanel] 加载子房间失败:', error)
  }
}

const handleSpaceClick = async (space: Space) => {
  activeSpaceId.value = space.roomId
  await loadSpaceChildren(space.roomId)
  emit('space-selected', space)
}

const handleRoomClick = (child: SpaceChild) => {
  emit('room-selected', child.roomId)
}

const handleSpaceCreated = async (spaceId: string) => {
  await loadSpaces()
  activeSpaceId.value = spaceId
  await loadSpaceChildren(spaceId)
}

const handleRoomAdded = async () => {
  if (activeSpaceId.value) {
    await loadSpaceChildren(activeSpaceId.value)
  }
}

onMounted(() => {
  loadSpaces()
})
</script>

<style scoped lang="scss">
.space-panel {
  @apply flex flex-col h-full bg-[--bg-color] border-r-1px border-solid border-[--border-color];
  width: 280px;
}

.space-header {
  @apply flex items-center justify-between p-12px border-b-1px border-solid border-[--border-color];
}

.space-title {
  @apply text-14px font-medium;
}

.space-list {
  @apply flex-1 overflow-hidden;
}

.space-item {
  @apply flex items-center gap-12px p-12px cursor-pointer transition-all;

  &:hover {
    background: var(--emoji-hover);
  }

  &.active {
    background: rgba(19, 152, 127, 0.1);
  }
}

.space-info {
  @apply flex flex-col gap-4px flex-1 min-w-0;
}

.space-name {
  @apply text-14px truncate;
}

.space-meta {
  @apply text-12px color-#909090;
}

.space-children {
  @apply flex flex-col border-t-1px border-solid border-[--border-color] max-h-200px;
}

.children-header {
  @apply flex items-center justify-between p-8px bg-[--right-chat-reply-color];
}

.children-title {
  @apply text-12px font-medium color-#909090;
}

.child-item {
  @apply flex items-center gap-10px p-8px cursor-pointer transition-all;

  &:hover {
    background: var(--emoji-hover);
  }
}

.child-info {
  @apply flex items-center gap-6px flex-1 min-w-0;
}

.child-name {
  @apply text-13px truncate;
}

.space-badge {
  @apply text-10px px-4px py-1px bg-#13987f20 text-#13987f rounded-4px;
}
</style>
