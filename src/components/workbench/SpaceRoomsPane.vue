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
        <svg class="size-16px" aria-hidden="true"><use href="#arrow-left" /></svg>
      </button>
      <span class="space-rooms-pane__title">{{ t('space.child_rooms') }}</span>
      <span class="space-rooms-pane__count">{{ rooms.length }}</span>
    </header>

    <!-- 变更已生效但列表刷新失败：局部提示，不把整页判为失败 -->
    <div v-if="refreshError" class="space-rooms-pane__banner" data-test="space-rooms-refresh-error">
      <PartialStateBanner
        compact
        :message="t('space.rooms_refresh_failed')"
        :detail="refreshError"
        :retry-text="t('common.retry')"
        @retry="handleRetryLoad" />
    </div>

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
          <svg class="size-14px" aria-hidden="true"><use href="#grid" /></svg>
        </div>
        <span class="space-rooms-pane__name">{{ room.name || room.roomId }}</span>
        <button
          v-if="canManage"
          type="button"
          class="space-rooms-pane__remove"
          data-test="space-room-remove"
          :aria-label="t('space.remove_room')"
          @click.stop="handleRemove(room.roomId)">
          <svg class="size-12px" aria-hidden="true"><use href="#close" /></svg>
        </button>
        <svg v-else class="size-12px space-rooms-pane__arrow" aria-hidden="true"><use href="#arrow-right" /></svg>
      </div>

      <div
        v-if="isLoadingRooms"
        class="space-rooms-pane__state"
        data-test="space-rooms-loading"
        role="status"
        aria-live="polite">
        {{ t('common.loading') }}
      </div>

      <ErrorState
        v-else-if="hasLoadError"
        data-test="space-rooms-error"
        illustration="network-error"
        :title="t('space.load_failed')"
        :retry-text="t('common.retry')"
        @retry="handleRetryLoad" />

      <EmptyState
        v-else-if="isEmptyRooms"
        :description="t('space.detail_space_rooms_empty')"
        data-test="space-rooms-empty" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import ErrorState from '@/components/common/ErrorState.vue'
import PartialStateBanner from '@/components/common/PartialStateBanner.vue'
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
const { rooms, loading, error, refreshError, load, removeRoom } = useSpaceRooms(() => props.spaceId)

// 三态互斥由模板的 v-if / v-else-if 链保证，顺序即优先级：加载中 → 失败 → 空。
// 三者都只在「列表为空」时成立：已有数据时刷新失败不遮住旧列表（旧列表继续渲染）。
const isLoadingRooms = computed(() => loading.value && rooms.value.length === 0)
const hasLoadError = computed(() => Boolean(error.value) && rooms.value.length === 0)
/** 子房间列表为空时展示空态（失败 / 加载中另有专门分支，避免假空态） */
const isEmptyRooms = computed(() => rooms.value.length === 0)

const handleRetryLoad = () => void load()

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
.space-rooms-pane__state {
  padding: 16px 12px;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
  text-align: center;
}

.space-rooms-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--tjg-surface-panel);
}

.space-rooms-pane__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--tjg-border-layout-divider);
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
  color: var(--tjg-text-secondary);
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-fast) ease;

  &:hover {
    background: var(--tjg-surface-list-hover);
  }
}

.space-rooms-pane__title {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--tjg-text-primary);
}

.space-rooms-pane__count {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--tjg-surface-search);
}

.space-rooms-pane__banner {
  padding: 8px 8px 0;
  flex-shrink: 0;
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
  transition: background-color var(--tjg-motion-duration-fast) ease;

  &:hover {
    background: var(--tjg-surface-list-hover);
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
  background: var(--tjg-surface-search);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.space-rooms-pane__avatar--fallback {
  color: var(--tjg-text-quaternary);
}

.space-rooms-pane__name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.space-rooms-pane__arrow {
  color: var(--tjg-text-quaternary);
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
