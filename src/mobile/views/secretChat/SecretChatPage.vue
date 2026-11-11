<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :is-official="false" :hidden-right="true" :room-name="t('home.secret_chat.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <p class="px-16px pt-12px pb-4px m-0 text-12px text-[--tjg-text-tertiary]">
          {{ t('home.secret_chat.subtitle') }}
        </p>

        <!-- 锁定态：**不渲染任何会话名/头像/预览**。会话名本身就暴露「和谁有私密往来」，
             所以列表直接 v-if 掉，而不是用遮罩（遮罩可被读屏与截图绕过）。 -->
        <div
          v-if="locked"
          class="flex flex-col items-center justify-center gap-8px flex-1 px-24px py-40px text-center"
          role="status"
          data-testid="mobile-secret-chat-locked">
          <svg
            class="w-40px h-40px text-[--tjg-text-tertiary]"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true">
            <path
              d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3z" />
          </svg>
          <span class="text-15px font-500 text-[--tjg-text-primary]">{{ t('home.secret_chat.locked_title') }}</span>
          <span class="text-12px text-[--tjg-text-secondary]">{{ t('home.secret_chat.locked_hint') }}</span>
          <van-button v-if="configured" class="mt-8px" size="small" type="primary" plain @click="handleUnlockClick">
            {{ t('home.secret_chat.unlock_action') }}
          </van-button>
          <van-button
            v-else
            class="mt-8px"
            size="small"
            type="primary"
            data-testid="mobile-secret-chat-setup-password"
            @click="handleGoSetupPassword">
            {{ t('mobile_security.secret_chat.go_settings') }}
          </van-button>
        </div>

        <van-empty
          v-else-if="hiddenSessions.length === 0"
          :description="t('home.secret_chat.no_hidden_sessions')"
          image="search" />

        <van-cell-group v-else inset class="my-12px">
          <van-cell
            v-for="session in hiddenSessions"
            :key="session.roomId"
            :label="session.text || t('home.secret_chat.no_messages')"
            :aria-label="sessionAriaLabel(session)"
            @click="handleSessionClick(session)">
            <template #title>
              <div class="flex items-center gap-4px overflow-hidden">
                <span class="truncate">{{ session.name }}</span>
                <EncryptionLockBadge
                  v-if="isEncrypted(session.roomId)"
                  :label="t('home.secret_chat.encrypted_badge')" />
              </div>
            </template>
            <template #icon>
              <div
                class="w-44px h-44px rounded-full overflow-hidden shrink-0 me-12px flex items-center justify-center bg-[--tjg-color-primary-500] text-[--tjg-text-inverse] text-18px font-500">
                <img
                  v-if="session.avatar"
                  :src="session.avatar"
                  :alt="t('home.secret_chat.avatar_alt', { name: session.name })"
                  class="w-full h-full object-cover" />
                <span v-else>{{ session.name?.charAt(0) || '?' }}</span>
              </div>
            </template>
            <template #value>
              <van-badge v-if="session.unreadCount > 0" :content="session.unreadCount" />
            </template>
            <!-- 私密会话已被普通列表过滤，必须保留「移出私密」出口，否则标记后无法退出 -->
            <template #right-icon>
              <van-button
                size="mini"
                plain
                class="ms-8px w-32px !h-32px"
                :aria-label="t('home.secret_chat.unmark_private')"
                @click.stop="handleUnmark(session)">
                <svg class="w-16px h-16px" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path
                    d="M12 3a9 9 0 0 0-9 9 9.75 9.75 0 0 0 5.5 8.38l-1.15 1.15a1 1 0 0 0 1.37 1.37l1.15-1.15A9.75 9.75 0 0 0 21 12a9 9 0 0 0-9-9zm-5 9a5 5 0 1 1 10 0 5 5 0 0 1-10 0z" />
                </svg>
              </van-button>
            </template>
          </van-cell>
        </van-cell-group>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import EncryptionLockBadge from '@/components/encryption/EncryptionLockBadge.vue'
import { usePrivateRoomEncryption } from '@/composables/secretChat/usePrivateRoomEncryption'
import { openSecretChatUnlock } from '@/composables/secretChat/useSecretChatGate'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import { MOBILE_SETTINGS_SECURITY_PRIVACY_PATH } from '@/mobile/views/my/settingsRoutes'
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
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileSecretChatPage')

defineOptions({
  name: 'MobileSecretChatPage'
})

const { t } = useI18n()
const router = useRouter()
const sessionStore = useSessionStore()
const settingStore = useSettingStore()

/** 未配置密码时解锁必然失败，锁定态改为引导去设置密码。 */
const configured = computed(() => settingStore.isSecretChatConfigured())

/** 解锁态取自单例响应式 computed：自动锁/其它窗口上锁都会立刻切回锁定态。 */
const { isUnlocked } = useSecretChatSession()
const locked = computed(() => !isUnlocked.value)

const hiddenSessions = computed(() => {
  // 锁定态一律返回空数组：模板即使被改坏也泄漏不出会话名
  if (locked.value) return []
  return sessionStore.sessionList.filter((session: SessionItem) => isPrivateRoom(session.roomId))
})

const { refresh: refreshEncryption, isEncrypted } = usePrivateRoomEncryption()

/** 列表变化时批量刷新加密状态；锁定态列表为空，快照随之清空。 */
watch(
  // map() 每次求值都返回新数组，直接 watch 会因引用变化在无关更新时重复整批查询；
  // 用 join 后的字符串做稳定 key，只有房间集合真正变化才触发。
  () => hiddenSessions.value.map((session: SessionItem) => session.roomId).join('\n'),
  () => {
    void refreshEncryption(hiddenSessions.value.map((session: SessionItem) => session.roomId))
  },
  { immediate: true }
)

/** 行内容的无障碍描述（含未读）。 */
const sessionAriaLabel = (session: SessionItem) =>
  session.unreadCount > 0
    ? `${session.name} ${t('home.secret_chat.unread_badge', { count: session.unreadCount })}`
    : session.name

/** 锁定态点「输入密码继续」：回跳目标是本页，解锁后由守卫放行。 */
const handleUnlockClick = () => {
  openSecretChatUnlock('/mobile/secretChat')
}

/** 未配置密码：跳安全设置页完成设置，而不是弹必然失败的解锁框。 */
const handleGoSetupPassword = () => {
  void router.push(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
}

const handleSessionClick = async (session: SessionItem) => {
  // 不清除私密标记：只是进入查看。
  await router.push({ name: 'mobileChatMain', params: { roomId: session.roomId } })
}

/**
 * 离开本页即上锁（默认策略），但进入私密会话本身不算「关闭」——
 * 否则聊天页门禁会把刚解锁的会话立刻拦下。
 */
onBeforeRouteLeave((to) => {
  if (to.name === 'mobileChatMain') return
  lockSecretChatSession('leave mobile secret chat page')
})

/** 移出私密：取消房间标记，会话回到普通列表（可逆操作，需二次确认）。 */
const handleUnmark = async (session: SessionItem) => {
  try {
    await showConfirmDialog({
      title: t('home.secret_chat.unmark_private'),
      message: t('home.secret_chat.unmark_confirm'),
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    return
  }

  try {
    await unmarkRoomPrivate(session.roomId)
  } catch (err) {
    logger.error('unmark private room failed:', err)
    showToast({ type: 'fail', message: t('home.secret_chat.registry_unavailable') })
  }
}

/**
 * 刷新登记表 + 把历史 `session.hide` 会话一次性迁入（幂等）。
 * 只在已解锁时执行：登记表内容本身也是私密信息。
 */
const refreshPrivateSessions = () => {
  void loadPrivateRoomRegistry()
  void migrateFromHiddenSessions(
    sessionStore.sessionList
      .filter((session: SessionItem) => session.hide)
      .map((session: SessionItem) => session.roomId)
  )
}

onMounted(() => {
  if (!isSecretChatUnlocked()) {
    // 未配置密码时解锁不可能成功，直接引导去安全设置页
    if (!settingStore.isSecretChatConfigured()) {
      void router.replace(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
      return
    }
    // 正常路径下路由守卫已拦过；这里只兜底「守卫放行后瞬间被锁」的竞态
    openSecretChatUnlock('/mobile/secretChat')
    return
  }
  refreshPrivateSessions()
})

// 原地解锁后补一次登记表加载
watch(isUnlocked, (value) => {
  if (value) refreshPrivateSessions()
})
</script>
