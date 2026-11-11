<template>
  <div class="space-children" data-testid="space-children">
    <div class="children-header">
      <span class="children-title">{{ t('space.child_rooms') }}</span>
      <van-button size="mini" plain type="primary" data-testid="space-create-room" @click="showCreate = !showCreate">
        <template #icon><van-icon name="plus" /></template>
        {{ t('space.create_room') }}
      </van-button>
    </div>

    <div v-if="showCreate" class="children-create">
      <van-field
        v-model="roomName"
        :placeholder="t('space.create_room_name_placeholder')"
        data-testid="space-room-name" />
      <van-button size="small" type="primary" :loading="mutating" data-testid="space-room-submit" @click="handleCreate">
        {{ t('common.confirm') }}
      </van-button>
    </div>

    <div v-if="loading && rooms.length === 0" class="children-hint" data-testid="space-rooms-loading">
      {{ t('common.loading') }}
    </div>
    <div v-else-if="rooms.length === 0" class="children-hint" data-testid="space-rooms-empty">
      {{ t('space.no_rooms') }}
    </div>
    <div v-else class="children-list">
      <div
        v-for="room in rooms"
        :key="room.roomId"
        v-clickable
        class="child-row"
        :data-room-id="room.roomId"
        @click="openRoom(room)">
        <div class="child-avatar">
          <img v-if="room.avatarUrl" :src="room.avatarUrl" :alt="room.name" />
          <van-icon v-else name="chat-o" size="20" />
        </div>
        <div class="child-name">{{ room.name || room.roomId }}</div>
        <span v-if="room.suggested" class="child-badge">{{ t('space.suggested_label') }}</span>
        <van-icon name="arrow" class="child-chevron" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useSpaceRooms } from '@/composables/space'
import type { SpaceChildRoom } from '@/composables/space/useSpaceRooms'
import { createLogger } from '@/utils/Logger'

/**
 * 空间子房间列表（移动端）。
 *
 * 背景：`SpaceView` 之前只渲染「空间卡片 + 成员/房间计数」，
 * `useSpaceRooms` 的 `rooms` / `load` / `createRoomInSpace` 一个都没接 ——
 * 于是「空间里有房间」这件事在移动端**完全看不见**（详情层只有按 roomId 添加）。
 *
 * 这里补上最小可用的树形视图：空间（父）→ 子房间（子，可点击进入聊天）+ 内联新建。
 * 数据源仍是 `MatrixSpaceService`（`m.space.child` 状态事件），不在前端自造层级。
 */
defineOptions({ name: 'SpaceChildrenList' })

const props = defineProps<{ spaceId: string }>()

const { t } = useI18n()
const router = useRouter()
const logger = createLogger('SpaceChildrenList')

const { rooms, loading, mutating, load, createRoomInSpace } = useSpaceRooms(() => props.spaceId)

const showCreate = ref(false)
const roomName = ref('')

watch(
  () => props.spaceId,
  async (id) => {
    showCreate.value = false
    roomName.value = ''
    if (!id) return
    await load()
  },
  { immediate: true }
)

const handleCreate = async () => {
  const name = roomName.value.trim()
  if (!name) {
    showToast(t('space.create_room_name_required'))
    return
  }
  const roomId = await createRoomInSpace({ name })
  if (!roomId) {
    showToast(t('space.create_room_failed'))
    return
  }
  showToast(t('space.create_room_success'))
  roomName.value = ''
  showCreate.value = false
  logger.info(`Child room created and linked to space ${props.spaceId}: ${roomId}`)
}

const openRoom = (room: SpaceChildRoom) => {
  if (!room.roomId) return
  void router.push({ name: 'mobileChatMain', params: { roomId: room.roomId } })
}
</script>

<style scoped lang="scss">
.space-children {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.children-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .children-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--van-text-color);
  }
}

.children-create {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border-radius: var(--tjg-radius-md, 8px);
  background: var(--tjg-glass-row-bg);
}

.children-hint {
  padding: 12px 0;
  font-size: 13px;
  color: var(--van-text-color-3);
}

.children-list {
  display: flex;
  flex-direction: column;
}

.child-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 4px;
  border-radius: var(--tjg-radius-md, 8px);
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;

  &:active {
    background: var(--tjg-glass-row-bg-pressed);
  }

  .child-avatar {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--van-gray-2);
    color: var(--van-gray-6);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .child-name {
    flex: 1;
    min-width: 0;
    font-size: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .child-badge {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 999px;
    color: var(--van-primary-color);
    background: var(--tjg-color-primary-100);
  }

  .child-chevron {
    color: var(--van-text-color-3);
  }
}
</style>
