<template>
  <div class="secret-chat-page size-full">
    <div class="secret-chat-header">
      <div class="header-title">
        <svg class="size-20px" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 3a9 9 0 0 0-9 9 9.75 9.75 0 0 0 5.5 8.38l-1.15 1.15a1 1 0 0 0 1.37 1.37l1.15-1.15A9.75 9.75 0 0 0 21 12a9 9 0 0 0-9-9zm-5 9a5 5 0 1 1 10 0 5 5 0 0 1-10 0z" />
        </svg>
        <span>私密聊天</span>
      </div>
      <svg @click="handleClose" class="w-20px h-20px cursor-pointer" viewBox="0 0 24 24" fill="currentColor">
        <path
          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
      </svg>
    </div>

    <div class="secret-chat-content">
      <div v-if="hiddenSessions.length === 0" class="empty-state">
        <svg class="size-48px text-[--hula-text-disabled]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
        </svg>
        <span class="text-(14px [--hula-text-disabled]) mt-10px">暂无隐藏会话</span>
      </div>

      <div v-else class="session-list">
        <div
          v-for="session in hiddenSessions"
          :key="session.roomId"
          class="session-item"
          @click="handleSessionClick(session)">
          <div class="session-avatar">
            <img v-if="session.avatar" :src="session.avatar" alt="" />
            <div v-else class="avatar-placeholder">
              {{ session.name?.charAt(0) || '?' }}
            </div>
          </div>
          <div class="session-info">
            <div class="session-name">{{ session.name }}</div>
            <div class="session-preview">{{ session.text || '暂无消息' }}</div>
          </div>
          <div class="session-meta">
            <span class="unread-count" v-if="session.unreadCount > 0">{{ session.unreadCount }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import { useSessionStore, type SessionItem } from '@/stores/domains/chat/chat/session'

defineOptions({
  name: 'SecretChatPage'
})

const router = useRouter()
const sessionStore = useSessionStore()
const { sessionList: sessions } = storeToRefs(sessionStore)

const hiddenSessions = computed(() => {
  return sessions.value.filter((s: SessionItem) => s.hide)
})

const handleSessionClick = async (session: SessionItem) => {
  sessionStore.updateSession(session.roomId, { hide: false })
  router.push(`/chat/${session.roomId}`)
}

const handleClose = () => {
  router.back()
}
</script>

<style scoped>
.secret-chat-page {
  display: flex;
  flex-direction: column;
  background: var(--hula-surface-app);
}

.secret-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--hula-border-default);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
}

.secret-chat-content {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.session-list {
  padding: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.session-item:hover {
  background: var(--hula-surface-list-hover);
}

.session-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.session-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-color);
  color: #fff;
  font-size: 18px;
  font-weight: 500;
}

.session-info {
  flex: 1;
  margin-left: 12px;
  overflow: hidden;
}

.session-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--hula-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-preview {
  font-size: 12px;
  color: var(--hula-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 4px;
}

.session-meta {
  flex-shrink: 0;
  margin-left: 8px;
}

.unread-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--error-color);
  color: #fff;
  font-size: 12px;
}
</style>
