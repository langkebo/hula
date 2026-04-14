<template>
  <div
    class="room-list-item"
    :class="{ active: isActive }"
    @click="$emit('click', room)"
    @contextmenu="$emit('context-menu', $event, room)">
    <n-avatar
      round
      :size="44"
      :src="avatarUrl"
      :style="{ backgroundColor: room.isDirect ? '#13987f' : '#1890ff' }">
      <template #fallback>
        <Icon :icon="room.isDirect ? 'mdi:account' : 'mdi:account-group'" :width="24" />
      </template>
    </n-avatar>

    <div class="room-info">
      <div class="room-header">
        <span class="room-name">{{ room.name || room.roomId }}</span>
        <span v-if="room.unreadCount > 0" class="unread-badge">{{ room.unreadCount > 99 ? '99+' : room.unreadCount }}</span>
      </div>
      <div class="room-meta">
        <span v-if="room.lastMessage" class="last-message">{{ room.lastMessage }}</span>
        <span v-if="lastMessageTs" class="last-time">{{ formatRelativeTime(lastMessageTs) }}</span>
      </div>
    </div>

    <div class="room-actions">
      <n-button text size="small" @click.stop="handleSendMessage">
        <template #icon>
          <Icon icon="mdi:message-text" :width="18" />
        </template>
      </n-button>
      <n-button v-if="room.isDirect" text size="small" @click.stop="handleCall">
        <template #icon>
          <Icon icon="mdi:phone" :width="18" />
        </template>
      </n-button>
      <n-button v-if="room.isDirect" text size="small" @click.stop="handleVideoCall">
        <template #icon>
          <Icon icon="mdi:video" :width="18" />
        </template>
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef } from 'vue'
import { NAvatar, NButton } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import { useRoomAvatar } from '@/composables/useAvatarUrl'
import { useTimeFormat } from '@/composables/useTimeFormat'

const props = defineProps<{
  room: any
}>()

const emit = defineEmits<{
  (e: 'click', room: any): void
  (e: 'context-menu', event: MouseEvent, room: any): void
}>()

const router = useRouter()
const roomStore = useRoomStore()
const { formatRelativeTime } = useTimeFormat()

const isActive = computed(() => roomStore.currentRoomId === props.room.roomId)

const avatarUrl = useRoomAvatar(toRef(props, 'room'))

const lastMessageTs = computed(() => props.room.lastMessageTime ?? props.room.lastMessageTs ?? 0)

function handleSendMessage() {
  router.push({ name: 'message', query: { roomId: props.room.roomId } })
}

function handleCall() {
  router.push({
    path: '/rtcCall',
    query: {
      roomId: props.room.roomId,
      callType: 'audio'
    }
  })
}

function handleVideoCall() {
  router.push({
    path: '/rtcCall',
    query: {
      roomId: props.room.roomId,
      callType: 'video'
    }
  })
}
</script>

<style scoped lang="scss">
.room-list-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-color-hover);

    .room-actions {
      opacity: 1;
    }
  }

  &.active {
    background: var(--primary-color-light);
  }
}

.room-info {
  flex: 1;
  min-width: 0;
  margin-left: 12px;
}

.room-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.room-name {
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-badge {
  padding: 2px 8px;
  font-size: 12px;
  color: white;
  background: #f56c6c;
  border-radius: 10px;
}

.room-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.last-message {
  flex: 1;
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.last-time {
  font-size: 12px;
  color: #999;
  margin-left: 8px;
}

.room-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}
</style>
