<template>
  <div class="space-room-grid-wrapper">
    <!-- 加载骨架屏 -->
    <div v-if="loading" class="space-room-grid__skeleton-list" data-testid="space-room-grid-skeleton">
      <div v-for="i in SKELETON_COUNT" :key="`skeleton-${i}`" class="space-room-grid__skeleton-item">
        <SkeletonBase variant="avatar" :width="36" :height="36" />
        <div class="space-room-grid__skeleton-info">
          <SkeletonBase variant="text" width="60%" :height="13" />
          <SkeletonBase variant="text" width="35%" :height="11" />
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="rooms.length === 0" class="space-room-grid__empty">
      <EmptyState illustration="no-results" :title="t('space.no_rooms')" />
    </div>

    <!-- 房间列表（列表样式，符合原型 SP5 规范） -->
    <ul v-else class="space-room-grid" data-testid="space-room-grid" role="list">
      <li
        v-for="room in rooms"
        :key="room.roomId"
        class="space-room-grid__item"
        role="listitem"
        tabindex="0"
        @click="emit('enter-room', room.roomId)"
        @keydown.enter="emit('enter-room', room.roomId)"
        @keydown.space.prevent="emit('enter-room', room.roomId)">
        <!-- 房间头像 -->
        <div class="space-room-grid__avatar">
          <img v-if="room.avatarUrl" :src="room.avatarUrl" :alt="''" class="space-room-grid__avatar-img" />
          <span v-else class="space-room-grid__avatar-placeholder">
            {{ getInitial(room.name) }}
          </span>
        </div>

        <!-- 房间信息 -->
        <div class="space-room-grid__info">
          <div class="space-room-grid__name" :title="room.name">{{ room.name }}</div>
          <div class="space-room-grid__meta">
            <span v-if="room.memberCount" class="space-room-grid__meta-item">
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              {{ t('space.member_count_value', { count: room.memberCount }) }}
            </span>
            <span v-if="room.onlineCount" class="space-room-grid__meta-item space-room-grid__meta-item--online">
              <span class="space-room-grid__online-dot" />
              {{ room.onlineCount }} {{ t('common.online') }}
            </span>
          </div>
        </div>

        <!-- 建议标记切换（仅空间创建者可见） -->
        <button
          v-if="canManage"
          type="button"
          class="space-room-grid__star-btn"
          :class="{ 'is-suggested': room.suggested }"
          :aria-label="room.suggested ? t('space.unmark_suggested') : t('space.mark_suggested')"
          :title="room.suggested ? t('space.unmark_suggested') : t('space.mark_suggested')"
          @click.stop="handleToggleSuggested(room, $event)">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            :fill="room.suggested ? 'currentColor' : 'none'"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </button>
        <span v-if="room.suggested" class="space-room-grid__suggested-tag">{{ t('space.suggested_label') }}</span>

        <!-- 聊天入口图标 -->
        <button
          type="button"
          class="space-room-grid__enter-btn"
          :aria-label="t('space.context.enter_chat')"
          :title="t('space.context.enter_chat')"
          @click.stop="emit('enter-room', room.roomId)">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import SkeletonBase from '@/components/common/SkeletonBase.vue'
import type { SpaceChildRoom } from '@/composables/space/useSpaceRooms'

defineOptions({ name: 'SpaceRoomGrid' })

const SKELETON_COUNT = 5

defineProps<{
  rooms: SpaceChildRoom[]
  loading?: boolean
  /** 当前用户是否为空间创建者（决定是否显示建议标记按钮） */
  canManage?: boolean
}>()

const emit = defineEmits<{
  'enter-room': [roomId: string]
  'preview-room': [roomId: string]
  'toggle-suggested': [roomId: string, currentSuggested: boolean]
}>()

const { t } = useI18n()

const getInitial = (name: string): string => {
  return name?.charAt(0)?.toUpperCase() || '?'
}

const handleToggleSuggested = (room: SpaceChildRoom, e: MouseEvent) => {
  e.stopPropagation()
  emit('toggle-suggested', room.roomId, room.suggested ?? false)
}
</script>

<style scoped lang="scss">
.space-room-grid-wrapper {
  width: 100%;
}

.space-room-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.space-room-grid__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--tjg-radius-sm);
  cursor: pointer;
  color: var(--tjg-text-primary);
  outline: none;
  transition: background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--tjg-color-primary-200);
  }
}

.space-room-grid__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--tjg-radius-md);
  overflow: hidden;
  background: var(--tjg-surface-subtle);
}

.space-room-grid__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.space-room-grid__avatar-placeholder {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
}

.space-room-grid__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.space-room-grid__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
  line-height: 1.4;
}

.space-room-grid__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--tjg-font-size-2xs);
  color: var(--tjg-text-tertiary);
  line-height: 1.3;
}

.space-room-grid__meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;

  svg {
    color: var(--tjg-text-quaternary);
  }
}

.space-room-grid__meta-item--online {
  color: var(--tjg-status-success);
}

.space-room-grid__online-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: var(--tjg-radius-full);
  background: var(--tjg-status-success);
}

.space-room-grid__enter-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: 0;
  border-radius: var(--tjg-radius-xs);
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-color-primary-100);
    color: var(--tjg-color-primary-500);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }
}

.space-room-grid__star-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: 0;
  border-radius: var(--tjg-radius-xs);
  background: transparent;
  color: var(--tjg-text-quaternary);
  cursor: pointer;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
    color: var(--tjg-color-primary-500);
  }

  &.is-suggested {
    color: var(--tjg-color-primary-500);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }
}

.space-room-grid__suggested-tag {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--tjg-color-primary-600, var(--tjg-color-primary-500));
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--tjg-color-primary-50, var(--tjg-surface-search));
}

/* 骨架屏 */
.space-room-grid__skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
}

.space-room-grid__skeleton-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
}

.space-room-grid__skeleton-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 空状态 */
.space-room-grid__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--tjg-space-8) var(--tjg-space-4);
}

@media (prefers-reduced-motion: reduce) {
  .space-room-grid__item,
  .space-room-grid__enter-btn {
    transition: none;
  }
}
</style>
