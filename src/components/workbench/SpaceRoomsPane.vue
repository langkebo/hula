<template>
  <div class="space-rooms-pane">
    <!-- 面板头：返回按钮 + 标题 + 房间数 -->
    <header class="space-rooms-pane__header" data-test="space-rooms-header">
      <button
        type="button"
        class="space-rooms-pane__back"
        data-test="space-rooms-back"
        :aria-label="t('common.back')"
        @click="emit('back')">
        <svg class="size-16px"><use href="#arrow-left" /></svg>
      </button>
      <span class="space-rooms-pane__title">{{ t('space.child_rooms') }}</span>
      <span class="space-rooms-pane__count">{{ rooms.length }}</span>
    </header>

    <!-- 子房间完整列表（无 limit） -->
    <div class="space-rooms-pane__list">
      <div
        v-for="room in rooms"
        :key="room.roomId"
        class="space-rooms-pane__item"
        data-test="space-room-item"
        @click="emit('enterRoom', room.roomId)">
        <div v-if="room.avatarUrl" class="space-rooms-pane__avatar">
          <img :src="room.avatarUrl" :alt="room.name" />
        </div>
        <div v-else class="space-rooms-pane__avatar space-rooms-pane__avatar--fallback">
          <svg class="size-14px"><use href="#grid" /></svg>
        </div>
        <span class="space-rooms-pane__name">{{ room.name || room.roomId }}</span>
        <button
          v-if="canManage"
          type="button"
          class="space-rooms-pane__remove"
          data-test="space-room-remove"
          :aria-label="t('space.remove_room')"
          @click.stop="handleRemove(room.roomId)">
          <svg class="size-12px"><use href="#close" /></svg>
        </button>
        <svg v-else class="size-12px space-rooms-pane__arrow"><use href="#arrow-right" /></svg>
      </div>

      <div v-if="!rooms.length" class="space-rooms-pane__empty" data-test="space-rooms-empty">
        {{ t('space.detail_space_rooms_empty') }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSpaceRooms } from '@/composables/space/useSpaceRooms'

const props = defineProps<{
  spaceId: string
  canManage?: boolean
}>()

const emit = defineEmits<{
  back: []
  enterRoom: [roomId: string]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { rooms, load, removeRoom } = useSpaceRooms(() => props.spaceId)

const handleRemove = async (roomId: string) => {
  if (!roomId) return
  window.$dialog?.warning({
    title: t('space.remove_room'),
    content: t('space.remove_room_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const ok = await removeRoom(roomId)
        if (ok) {
          showFeedback(t('space.remove_room_success'), 'success')
        } else {
          showFeedback(t('space.remove_room_failed'), 'error')
        }
      } catch {
        showFeedback(t('space.remove_room_failed'), 'error')
      }
    }
  })
}

// 挂载时自动加载
void load()
</script>

<style scoped lang="scss">
.space-rooms-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--hula-surface-panel);
}

.space-rooms-pane__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--hula-border-layout-divider);
  flex-shrink: 0;
}

.space-rooms-pane__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--hula-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
}

.space-rooms-pane__title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--hula-text-primary);
}

.space-rooms-pane__count {
  font-size: 12px;
  color: var(--hula-text-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--hula-surface-search);
}

.space-rooms-pane__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}

.space-rooms-pane__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
}

.space-rooms-pane__avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--hula-surface-search);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.space-rooms-pane__avatar--fallback {
  color: var(--hula-text-quaternary);
}

.space-rooms-pane__name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--hula-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.space-rooms-pane__arrow {
  color: var(--hula-text-quaternary);
  flex-shrink: 0;
}

.space-rooms-pane__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--hula-text-quaternary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;

  &:hover {
    background: var(--hula-color-danger-100, color-mix(in srgb, var(--hula-color-danger-500) 12%, transparent));
    color: var(--hula-color-danger-500);
  }
}

.space-rooms-pane__empty {
  padding: 40px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--hula-text-quaternary);
}
</style>
