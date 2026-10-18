<template>
  <div class="secret-chat-page size-full" role="main" :aria-label="t('home.secret_chat.title')">
    <div class="secret-chat-header" role="banner">
      <div class="header-title">
        <svg class="size-20px" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M12 3a9 9 0 0 0-9 9 9.75 9.75 0 0 0 5.5 8.38l-1.15 1.15a1 1 0 0 0 1.37 1.37l1.15-1.15A9.75 9.75 0 0 0 21 12a9 9 0 0 0-9-9zm-5 9a5 5 0 1 1 10 0 5 5 0 0 1-10 0z" />
        </svg>
        <div class="header-title__text">
          <span>{{ t('home.secret_chat.title') }}</span>
          <!-- 副标题必须如实：只承诺「本机加密显示」，不下「服务端不存储」这种绝对话术 -->
          <span class="header-subtitle">{{ t('home.secret_chat.subtitle') }}</span>
        </div>
      </div>
      <svg
        class="w-20px h-20px cursor-pointer"
        viewBox="0 0 24 24"
        fill="currentColor"
        role="button"
        :aria-label="t('common.close')"
        @click="handleClose">
        <path
          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
          aria-hidden="true" />
      </svg>
    </div>

    <div class="secret-chat-content" role="region" :aria-label="t('home.secret_chat.hidden_sessions_list')">
      <!-- 锁定态：**不渲染任何会话名/头像/预览**。
           这一屏最容易泄漏——会话名本身就暴露「你和谁有私密往来」，
           所以列表直接 v-if 掉，而不是靠 blur / 灰度遮罩（遮罩能被读屏与截图绕过）。 -->
      <div v-if="locked" class="locked-view" role="status" data-testid="secret-chat-locked">
        <svg class="locked-view__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3z" />
        </svg>
        <span class="locked-view__title">{{ t('home.secret_chat.locked_title') }}</span>
        <span class="locked-view__hint">{{ t('home.secret_chat.locked_hint') }}</span>
        <button type="button" class="locked-view__action" @click="handleUnlockClick">
          {{ t('home.secret_chat.unlock_action') }}
        </button>
      </div>

      <EmptyState
        v-else-if="hiddenSessions.length === 0"
        role="status"
        illustration="no-conversations"
        :description="t('home.secret_chat.no_hidden_sessions')" />

      <div v-else class="session-list" role="list" :aria-label="t('home.secret_chat.hidden_sessions_list')">
        <div
          v-for="session in hiddenSessions"
          :key="session.roomId"
          class="session-item"
          role="listitem"
          :aria-label="sessionAriaLabel(session)"
          @click="handleSessionClick(session)">
          <div class="session-avatar" aria-hidden="true">
            <img
              v-if="session.avatar"
              :src="session.avatar"
              :alt="t('home.secret_chat.avatar_alt', { name: session.name })" />
            <div v-else class="avatar-placeholder" aria-hidden="true">
              {{ session.name?.charAt(0) || '?' }}
            </div>
          </div>
          <div class="session-info">
            <div class="session-name">{{ session.name }}</div>
            <div class="session-preview">{{ session.text || t('home.secret_chat.no_messages') }}</div>
          </div>
          <div class="session-meta">
            <span
              class="unread-count"
              v-if="session.unreadCount > 0"
              :aria-label="t('home.secret_chat.unread_badge', { count: session.unreadCount })">
              {{ session.unreadCount }}
            </span>
            <!-- 私密会话已被普通列表过滤，这里必须提供「移出私密」出口，否则标记后无法退出 -->
            <button
              type="button"
              class="session-unmark"
              :aria-label="t('home.secret_chat.unmark_private')"
              :title="t('home.secret_chat.unmark_private')"
              @click.stop="handleUnmark(session)">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M12 3a9 9 0 0 0-9 9 9.75 9.75 0 0 0 5.5 8.38l-1.15 1.15a1 1 0 0 0 1.37 1.37l1.15-1.15A9.75 9.75 0 0 0 21 12a9 9 0 0 0-9-9zm-5 9a5 5 0 1 1 10 0 5 5 0 0 1-10 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import EmptyState from '@/components/common/EmptyState.vue'
import { openSecretChatUnlock } from '@/composables/secretChat/useSecretChatGate'
import {
  isPrivateRoom,
  loadPrivateRoomRegistry,
  migrateFromHiddenSessions,
  unmarkRoomPrivate
} from '@/services/matrix/privateChat/privateRoomRegistry'
import { type SessionItem, useSessionStore } from '@/stores/domains/chat/chat/session'
import {
  isSecretChatUnlocked,
  lockSecretChatSession,
  useSecretChatSession
} from '@/stores/domains/settings/secretChatSession'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SecretChatPage')

defineOptions({
  name: 'SecretChatPage'
})

const { t } = useI18n()
const router = useRouter()
const sessionStore = useSessionStore()
const { sessionList: sessions } = storeToRefs(sessionStore)

/**
 * 解锁态直接取自单例的响应式 computed（`isUnlocked`），不用事件。
 *
 * 用事件的话「自动锁 / 重启 / 其它窗口上锁」很容易漏掉某条路径，
 * 而 computed 天然跟着状态走 —— 状态一锁，页面立刻切到锁定态。
 */
const { isUnlocked } = useSecretChatSession()
const locked = computed(() => !isUnlocked.value)

const hiddenSessions = computed(() => {
  // 锁定态一律返回空数组：即使模板被改坏，也不可能把会话名泄漏出去
  if (locked.value) return []
  // 数据源是房间级登记表（不再依赖 session.hide —— 那只代表展示态）
  return sessions.value.filter((s: SessionItem) => isPrivateRoom(s.roomId))
})

/** 锁定态下点「输入密码继续」：回跳目标仍是本页，解锁后守卫会放行。 */
const handleUnlockClick = () => {
  openSecretChatUnlock('/secretChat')
}

/** 行内容的无障碍描述（含未读）；文案走 i18n，避免模板里堆中文。 */
const sessionAriaLabel = (session: SessionItem) =>
  session.unreadCount > 0
    ? `${session.name} ${t('home.secret_chat.unread_badge', { count: session.unreadCount })}`
    : session.name

const handleSessionClick = async (session: SessionItem) => {
  // 不清除私密标记：房间仍是私密房，只是进入查看。
  // 路由名必须是 `message`——`/chat/:roomId` 在本仓不存在（`/chat` 是机器人插件路由且无参数），
  // 之前跳到那里会落到 notFound。
  await router.push({ name: 'message', params: { roomId: session.roomId } })
}

const handleClose = () => {
  // 关闭即锁（默认策略）：私密页是私密内容的唯一入口，
  // 退出时不留解锁态，避免「关掉页面后别人接着用这台机器」还能直接看见列表。
  lockSecretChatSession('关闭私密会话页')
  router.back()
}

/** 移出私密：取消房间标记，会话回到普通列表（可逆操作，需二次确认）。 */
const handleUnmark = (session: SessionItem) => {
  window.$dialog?.create({
    title: t('home.secret_chat.unmark_private'),
    content: t('home.secret_chat.unmark_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await unmarkRoomPrivate(session.roomId)
      } catch (err) {
        logger.error('unmark private room failed:', err)
      }
    }
  })
}

/**
 * 刷新登记表 + 把历史 `session.hide` 会话一次性迁入（幂等）。
 *
 * 只在**已解锁**时执行：登记表内容本身也算私密信息（哪些房间被标记），
 * 锁定态下不该去拉取。
 */
const refreshPrivateSessions = () => {
  void loadPrivateRoomRegistry()
  void migrateFromHiddenSessions(sessions.value.filter((s: SessionItem) => s.hide).map((s: SessionItem) => s.roomId))
}

/**
 * 锁定兜底：路由守卫挡的是「进入时未解锁」，但页面停留期间可能触发自动锁
 * （空闲 / 切后台 / 另一处主动上锁）。
 *
 * 原地切到锁定态视图（不跳走）：列表被 v-if 掉、`hiddenSessions` 返回空数组，
 * DOM 里不留任何会话名/头像；点「输入密码继续」可原地解锁。
 */
onMounted(() => {
  if (!isSecretChatUnlocked()) {
    // 正常路径下守卫已经拦过；这里只处理「守卫放行后瞬间被锁」的竞态
    openSecretChatUnlock('/secretChat')
    return
  }
  refreshPrivateSessions()
})

// 原地解锁后要补一次登记表加载：上面 onMounted 在锁定态直接 return 了
watch(isUnlocked, (value) => {
  if (value) refreshPrivateSessions()
})
</script>

<style scoped>
.secret-chat-page {
  display: flex;
  flex-direction: column;
  background: var(--tjg-surface-app);
}

.secret-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--tjg-border-default);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
}

.header-title__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-subtitle {
  font-size: 11px;
  font-weight: 400;
  color: var(--tjg-text-tertiary);
}

.locked-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  padding: 24px;
  text-align: center;
}

.locked-view__icon {
  width: 40px;
  height: 40px;
  color: var(--tjg-text-tertiary);
}

.locked-view__title {
  font-size: 15px;
  font-weight: 500;
  color: var(--tjg-text-primary);
}

.locked-view__hint {
  font-size: 12px;
  color: var(--tjg-text-secondary);
}

.locked-view__action {
  margin-top: 8px;
  padding: 8px 20px;
  border: 1px solid var(--tjg-border-default);
  border-radius: 8px;
  background: var(--tjg-surface-panel);
  color: var(--tjg-text-primary);
  font-size: 13px;
  cursor: pointer;
}

.secret-chat-content {
  flex: 1;
  overflow-y: auto;
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
  transition: background-color var(--tjg-motion-duration-normal);
}

.session-item:hover {
  background: var(--tjg-surface-list-hover);
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
  background: var(--tjg-color-primary-500);
  color: var(--tjg-text-inverse);
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
  color: var(--tjg-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-preview {
  font-size: 12px;
  color: var(--tjg-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 4px;
}

.session-meta {
  flex-shrink: 0;
  margin-left: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-unmark {
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--tjg-text-secondary);
  cursor: pointer;
}

.session-unmark:hover {
  color: var(--tjg-color-primary-500);
}

.unread-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--tjg-color-danger-500);
  color: var(--tjg-text-inverse);
  font-size: 12px;
}
</style>
