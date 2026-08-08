<template>
  <div class="space-room-grid-wrapper">
    <!-- 加载骨架屏 -->
    <div v-if="loading" class="space-room-grid" data-testid="space-room-grid">
      <div v-for="i in SKELETON_COUNT" :key="`skeleton-${i}`" class="space-room-grid__skeleton">
        <SkeletonBase variant="card" height="80px" />
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="rooms.length === 0" class="space-room-grid__empty">
      <EmptyState illustration="no-results" :title="t('space.no_rooms')" />
    </div>

    <!-- 房间网格 -->
    <div v-else class="space-room-grid" data-testid="space-room-grid">
      <RoomCard
        v-for="room in rooms"
        :key="room.roomId"
        :room="toRoomCardData(room)"
        @join="emit('enter-room', $event)"
        @preview="emit('preview-room', $event)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonBase from '@/components/common/SkeletonBase.vue'
import type { RoomCardData } from '@/components/room/RoomCard.vue'
import RoomCard from '@/components/room/RoomCard.vue'
import type { SpaceChildRoom } from '@/composables/space/useSpaceRooms'

defineOptions({ name: 'SpaceRoomGrid' })

const SKELETON_COUNT = 6

defineProps<{
  rooms: SpaceChildRoom[]
  loading?: boolean
}>()

const emit = defineEmits<{
  'enter-room': [roomId: string]
  'preview-room': [roomId: string]
}>()

const { t } = useI18n()

const toRoomCardData = (room: SpaceChildRoom): RoomCardData => ({
  roomId: room.roomId,
  name: room.name,
  avatarUrl: room.avatarUrl,
  // SpaceChildRoom 无成员数字段，默认 0
  numJoinedMembers: 0
})
</script>

<style scoped lang="scss">
.space-room-grid-wrapper {
  width: 100%;
}

.space-room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--tjg-space-3);
}

.space-room-grid__skeleton {
  display: flex;
}

.space-room-grid__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--tjg-space-8) var(--tjg-space-4);
}

@media (prefers-reduced-motion: reduce) {
  .space-room-grid {
    transition: none;
  }
}
</style>
