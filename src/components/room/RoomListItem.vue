<template>
  <div
    class="room-list-item"
    :class="{ 'is-selected': isSelected, 'is-unread': room.unreadCount > 0 }"
    @click="handleClick"
    @context-menu="handleContextMenu">
    <!-- 房间头像 -->
    <n-avatar :size="48" :src="avatarUrl" :fallback-src="defaultAvatar" round class="flex-shrink-0" />

    <div class="room-info">
      <!-- 房间名称和未读数 -->
      <div class="room-header">
        <span class="room-name text-ellipsis">{{ displayName }}</span>
        <span v-if="room.unreadCount > 0" class="unread-badge">
          {{ room.unreadCount > 99 ? '99+' : room.unreadCount }}
        </span>
      </div>

      <!-- 最后消息 -->
      <div class="room-preview">
        <span v-if="room.isEncrypted" class="lock-icon">🔒</span>
        <span class="last-message text-ellipsis">{{ lastMessageText }}</span>
      </div>

      <!-- 元信息 -->
      <div class="room-meta">
        <span class="time">{{ formatTime(room.lastMessageTime) }}</span>
        <span v-if="room.isDirect" class="dm-tag">私信</span>
      </div>
    </div>

    <!-- 高亮提示 -->
    <div v-if="room.highlightCount > 0" class="highlight-indicator"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NAvatar, NEllipsis } from 'naive-ui'
import { useRoomStore } from '@/stores/domains/chat/room'
import type { RoomInfo } from '@/services/types'

const props = defineProps<{
  room: RoomInfo
  isSelected?: boolean
}>()

const emit = defineEmits<{
  click: []
  contextMenu: [event: MouseEvent]
}>()

const roomStore = useRoomStore()

// 默认头像
const defaultAvatar = '/images/default-avatar.png'

// 计算属性
const displayName = computed(() => props.room.name || '未命名房间')
const avatarUrl = computed(() => props.room.avatarUrl || undefined)
const lastMessageText = computed(() => props.room.lastMessage || '暂无消息')

// 格式化时间
function formatTime(timestamp: number | null): string {
  if (!timestamp) return ''

  const now = Date.now()
  const diff = now - timestamp
  const oneDay = 24 * 60 * 60 * 1000
  const oneHour = 60 * 60 * 1000

  if (diff < oneHour) {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (diff < oneDay) {
    return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (diff < 7 * oneDay) {
    return new Date(timestamp).toLocaleDateString('zh-CN', { weekday: 'short' })
  } else {
    return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }
}

// 处理点击
function handleClick() {
  emit('click')
}

// 处理右键菜单
function handleContextMenu(event: MouseEvent) {
  emit('contextMenu', event)
}
</script>

<style scoped>
.room-list-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  position: relative;
}

.room-list-item:hover {
  background-color: var(--hover-bg-color, #f5f5f5);
}

.room-list-item.is-selected {
  background-color: var(--selected-bg-color, #e8f4ff);
}

.room-list-item.is-unread {
  background-color: var(--unread-bg-color, #f0f7ff);
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
  margin-bottom: 4px;
}

.room-name {
  font-weight: 500;
  font-size: 15px;
  color: var(--text-primary, #333);
  flex: 1;
  min-width: 0;
}

.unread-badge {
  background-color: var(--color-danger);
  color: white;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 8px;
  flex-shrink: 0;
}

.room-preview {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.lock-icon {
  font-size: 12px;
  margin-right: 4px;
}

.last-message {
  font-size: 13px;
  color: var(--text-secondary, #666);
}

.room-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.time {
  font-size: 12px;
  color: var(--text-tertiary, #999);
}

.dm-tag {
  font-size: 11px;
  padding: 2px 6px;
  background-color: var(--tag-bg-color, #e8f4ff);
  color: var(--tag-text-color, #1890ff);
  border-radius: 4px;
}

.highlight-indicator {
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 40px;
  background-color: var(--color-danger);
  border-radius: 2px;
}

/* 响应式设计 - 移动端 */
@media (max-width: 768px) {
  .room-list-item {
    padding: 8px 12px;
  }

  .room-name {
    font-size: 14px;
  }

  .last-message {
    font-size: 12px;
  }

  .room-info {
    margin-left: 8px;
  }

  .dm-tag {
    display: none; /* 移动端隐藏标签 */
  }
}

/* 平板端 */
@media (min-width: 769px) and (max-width: 1024px) {
  .room-list-item {
    padding: 10px 14px;
  }
}
</style>
