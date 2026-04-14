<template>
  <div class="mobile-space-item" @click="emit('click', space)" @touchstart="onTouchStart" @touchend="onTouchEnd">
    <div class="space-avatar">
      <van-image
        v-if="avatarUrl"
        :src="avatarUrl"
        width="48"
        height="48"
        round
        fit="cover"
        :error-icon="defaultAvatar"
        :loading-icon="defaultAvatar" />
      <div v-else class="avatar-placeholder">
        <van-icon name="apps-o" size="24" />
      </div>
    </div>

    <div class="space-info">
      <div class="space-header">
        <span class="space-name">{{ space.name || space.roomId }}</span>
      </div>
      <div class="space-meta">
        <span class="meta-item">
          <van-icon name="user-o" size="12" />
          {{ space.memberCount || 0 }} {{ t('space.members') }}
        </span>
        <span class="meta-item">
          <van-icon name="chat-o" size="12" />
          {{ space.childCount || 0 }} {{ t('space.rooms') }}
        </span>
      </div>
    </div>

    <van-icon name="arrow" size="16" color="#999" />
  </div>
</template>

<script setup lang="ts">
import { toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Space } from '@/stores/space'
import { useRoomAvatar } from '@/composables/useAvatarUrl'
import { useLongPress } from '@/composables/useLongPress'

const props = defineProps<{
  space: Space
}>()

const emit = defineEmits<{
  (e: 'click', space: Space): void
  (e: 'longPress', event: Event, space: Space): void
}>()

const { t } = useI18n()

const defaultAvatar =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjOTk5Ij48cGF0aCBkPSJNNCA4aDRWNEg0djR6bTYgMTJoNHYtNGgtNHY0em0tNiAwaDR2LTRINHY0em0wLTZoNHYtNEg0djR6bTYgMGg0di00aC00djR6bTYtMTJoNHYtNGgtNHY0em0tNiAwaDRWNEg0djR6bTYgMGg0VjRoLTR2NHoiLz48L3N2Zz4='

const avatarUrl = useRoomAvatar(toRef(props, 'space'))

const { onTouchStart, onTouchEnd } = useLongPress((event) => {
  emit('longPress', event, props.space)
})
</script>

<style lang="scss" scoped>
.mobile-space-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--van-background);
  border-bottom: 1px solid var(--van-border-color);
  gap: 12px;

  &:active {
    background: var(--van-active-color);
  }

  .space-avatar {
    flex-shrink: 0;

    .avatar-placeholder {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: var(--van-gray-2);
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .space-info {
    flex: 1;
    min-width: 0;

    .space-header {
      margin-bottom: 4px;

      .space-name {
        font-size: 16px;
        font-weight: 500;
        color: var(--van-text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    .space-meta {
      display: flex;
      gap: 12px;

      .meta-item {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: var(--van-text-color-3);
      }
    }
  }
}
</style>
