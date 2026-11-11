<template>
  <div class="space-details-pane__previews">
    <!-- 成员预览区 -->
    <section class="space-details-pane__section" data-test="space-members-preview">
      <div class="space-details-pane__section-header">
        <span class="space-details-pane__section-title">{{ t('space.detail_members_preview') }}</span>
        <button
          v-if="members.length"
          type="button"
          class="space-details-pane__link-btn"
          data-test="view-all-members"
          @click="emit('update:subView', 'members')">
          {{ t('space.view_all_members') }}
        </button>
      </div>
      <div v-if="membersLoading" class="space-details-pane__loading">
        <n-spin size="small" />
      </div>
      <div v-else-if="members.length" class="space-details-pane__members-grid">
        <div v-for="member in membersPreview" :key="member.user_id" class="space-details-pane__member">
          <div class="space-details-pane__member-fallback">
            {{ getInitials(member.user_id) }}
          </div>
          <span class="space-details-pane__member-name">
            {{ member.user_id }}
          </span>
        </div>
      </div>
      <p v-else class="space-details-pane__hint">{{ t('space.detail_members_empty') }}</p>
    </section>

    <!-- 子房间预览区 -->
    <section class="space-details-pane__section" data-test="space-rooms-preview">
      <div class="space-details-pane__section-header">
        <span class="space-details-pane__section-title">{{ t('space.child_rooms') }}</span>
        <button
          v-if="rooms.length"
          type="button"
          class="space-details-pane__link-btn"
          data-test="view-all-rooms"
          @click="emit('update:subView', 'rooms')">
          {{ t('space.view_all_rooms') }}
        </button>
      </div>
      <div v-if="roomsLoading" class="space-details-pane__loading">
        <n-spin size="small" />
      </div>
      <div v-else-if="rooms.length" class="space-details-pane__rooms-list">
        <div
          v-for="room in roomsPreview"
          :key="room.roomId"
          class="space-details-pane__room"
          @click="emit('enterRoom', room.roomId)">
          <n-avatar v-if="room.avatarUrl" :size="32" :src="room.avatarUrl" round />
          <div v-else class="space-details-pane__room-fallback">
            <svg class="size-14px"><use href="#grid" /></svg>
          </div>
          <span class="space-details-pane__room-name">{{ room.name || room.roomId }}</span>
          <button
            v-if="canManage"
            type="button"
            class="space-details-pane__room-remove"
            :aria-label="t('space.remove_room')"
            :title="t('space.remove_room')"
            @click.stop="emit('removeRoom', room.roomId)">
            <svg class="size-12px"><use href="#close" /></svg>
          </button>
          <svg v-else class="size-12px space-details-pane__room-arrow"><use href="#arrow-right" /></svg>
        </div>
      </div>
      <p v-else class="space-details-pane__hint">{{ t('space.detail_space_rooms_empty') }}</p>
    </section>

    <!-- 层级树入口 -->
    <section class="space-details-pane__section" data-test="space-hierarchy-entry">
      <div class="space-details-pane__section-header">
        <span class="space-details-pane__section-title">{{ t('space.hierarchy_title') }}</span>
        <button
          type="button"
          class="space-details-pane__link-btn"
          data-test="view-hierarchy"
          @click="emit('update:subView', 'hierarchy')">
          {{ t('space.view_hierarchy') }}
        </button>
      </div>
      <p class="space-details-pane__hint">{{ t('space.hierarchy_hint') }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SpaceChildRoom } from '@/composables/space/useSpaceRooms'
import type { SpaceMember } from '@/services/matrix/room/MatrixSpaceService'

const props = withDefaults(
  defineProps<{
    members: SpaceMember[]
    rooms: SpaceChildRoom[]
    membersLoading?: boolean
    roomsLoading?: boolean
    canManage?: boolean
  }>(),
  {
    membersLoading: false,
    roomsLoading: false,
    canManage: false
  }
)

const emit = defineEmits<{
  'update:subView': [view: 'members' | 'rooms' | 'hierarchy']
  enterRoom: [roomId: string]
  removeRoom: [roomId: string]
}>()

const { t } = useI18n()

const MEMBERS_PREVIEW_LIMIT = 8
const ROOMS_PREVIEW_LIMIT = 5

const membersPreview = computed(() => props.members.slice(0, MEMBERS_PREVIEW_LIMIT))
const roomsPreview = computed(() => props.rooms.slice(0, ROOMS_PREVIEW_LIMIT))

const getInitials = (text: string) => {
  // 提取用户 ID 的本地部分（@user:server → user）
  const localPart = text.startsWith('@') ? text.slice(1).split(':')[0] : text
  return localPart.slice(0, 2).toUpperCase() || '?'
}
</script>

<style scoped lang="scss">
.space-details-pane__previews {
  display: contents;
}

/* 通用 section */
.space-details-pane__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.space-details-pane__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.space-details-pane__section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tjg-text-secondary);
}

.space-details-pane__link-btn {
  border: 0;
  background: transparent;
  color: var(--tjg-color-primary-500);
  font-size: 12px;
  cursor: pointer;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
}

.space-details-pane__loading {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.space-details-pane__hint {
  margin: 0;
  font-size: 12px;
  color: var(--tjg-text-quaternary);
  padding: 8px 0;
}

/* 成员预览 */
.space-details-pane__members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 12px;
}

.space-details-pane__member {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;

  &:hover .space-details-pane__member-name {
    color: var(--tjg-color-primary-500);
  }
}

.space-details-pane__member-fallback {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--tjg-surface-search);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--tjg-text-secondary);
}

.space-details-pane__member-name {
  font-size: 11px;
  color: var(--tjg-text-tertiary);
  text-align: center;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--tjg-motion-duration-fast) ease;
}

/* 子房间列表 */
.space-details-pane__rooms-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.space-details-pane__room {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast) ease;

  &:hover {
    background: var(--tjg-surface-list-hover);
  }
}

.space-details-pane__room-fallback {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--tjg-surface-search);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tjg-text-quaternary);
}

.space-details-pane__room-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.space-details-pane__room-arrow {
  color: var(--tjg-text-quaternary);
  flex-shrink: 0;
}

.space-details-pane__room-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--tjg-text-quaternary);
  cursor: pointer;
  flex-shrink: 0;
  transition:
    color var(--tjg-motion-duration-fast) ease,
    background-color var(--tjg-motion-duration-fast) ease,
    border-color var(--tjg-motion-duration-fast) ease,
    box-shadow var(--tjg-motion-duration-fast) ease,
    opacity var(--tjg-motion-duration-fast) ease,
    transform var(--tjg-motion-duration-fast) ease;

  &:hover {
    background: var(--tjg-color-danger-100, color-mix(in srgb, var(--tjg-color-danger-500) 12%, transparent));
    color: var(--tjg-color-danger-500);
  }
}
</style>
