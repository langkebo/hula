<template>
  <div class="mobile-room-item" @click="emit('click', room)" @touchstart="onTouchStart" @touchend="onTouchEnd">
    <div class="room-avatar">
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
        <van-icon :name="room.isDirect ? 'user-o' : 'friends-o'" size="24" />
      </div>
      <van-badge v-if="room.unreadCount > 0" :content="room.unreadCount" max="99" class="unread-badge" />
    </div>

    <div class="room-info">
      <div class="room-header">
        <span class="room-name">{{ room.name || room.roomId }}</span>
        <span class="room-time">{{ formattedTime }}</span>
      </div>
      <div class="room-preview">
        <span v-if="room.lastMessage" class="last-message">{{ room.lastMessage }}</span>
        <span v-else class="no-message">{{ t('room.no_message', '暂无消息') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RoomInfo } from '@/stores/room'
import { useRoomAvatar } from '@/composables/useAvatarUrl'
import { useTimeFormat } from '@/composables/useTimeFormat'
import { useLongPress } from '@/composables/useLongPress'

const props = defineProps<{
  room: RoomInfo
}>()

const emit = defineEmits<{
  (e: 'click', room: RoomInfo): void
  (e: 'longPress', event: Event, room: RoomInfo): void
}>()

const { t } = useI18n()
const { formatRelativeTime } = useTimeFormat()

const defaultAvatar =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSIjOTk5Ij48cGF0aCBkPSJNMTIgMkM2LjQ4IDIgMiA2LjQ4IDIgMTJzNC40OCAxMCAxMCAxMCAxMC00LjQ4IDEwLTEwUzE3LjUyIDIgMTIgMnptMCAzYzEuNjYgMCAzIDEuMzQgMyAzcy0xLjM0IDMtMyAzLTMtMS4zNC0zLTMgMS4zNC0zIDMtM3ptMCAxNC4yYy0yLjUgMC00LjcxLTEuMjgtNi0zLjIyLjAzLTEuOTkgNC0zLjA4IDYtMy4wOCAxLjk5IDAgNS45NyAxLjA5IDYgMy4wOC0xLjI5IDEuOTQtMy41IDMuMjItNiAzLjIyeiIvPjwvc3ZnPg=='

const avatarUrl = useRoomAvatar(toRef(props, 'room'))

const formattedTime = computed(() => {
  const ts = props.room.lastMessageTime
  if (!ts) return ''
  return formatRelativeTime(ts)
})

const { onTouchStart, onTouchEnd } = useLongPress((event) => {
  emit('longPress', event, props.room)
})
</script>

<style lang="scss" scoped>
.mobile-room-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--van-background);
  border-bottom: 1px solid var(--van-border-color);
  gap: 12px;

  &:active {
    background: var(--van-active-color);
  }

  .room-avatar {
    position: relative;
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

    .unread-badge {
      position: absolute;
      top: -4px;
      right: -4px;
    }
  }

  .room-info {
    flex: 1;
    min-width: 0;

    .room-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;

      .room-name {
        font-size: 16px;
        font-weight: 500;
        color: var(--van-text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .room-time {
        font-size: 12px;
        color: var(--van-text-color-3);
        flex-shrink: 0;
        margin-left: 8px;
      }
    }

    .room-preview {
      .last-message,
      .no-message {
        font-size: 14px;
        color: var(--van-text-color-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: block;
      }

      .no-message {
        color: var(--van-text-color-3);
      }
    }
  }

  .muted-icon {
    flex-shrink: 0;
  }
}
</style>
