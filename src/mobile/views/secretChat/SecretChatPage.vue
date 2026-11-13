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
                class="ms-8px w-44px !h-44px"
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import EncryptionLockBadge from '@/components/encryption/EncryptionLockBadge.vue'
import { useSecretChatPage } from '@/composables/secretChat/useSecretChatPage'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import { MOBILE_SETTINGS_SECURITY_PRIVACY_PATH } from '@/mobile/views/my/settingsRoutes'
import type { SessionItem } from '@/stores/domains/chat/chat/session'
import { useSettingStore } from '@/stores/domains/settings/setting'

defineOptions({
  name: 'MobileSecretChatPage'
})

const { t } = useI18n()
const router = useRouter()
const settingStore = useSettingStore()

/** 未配置密码时解锁必然失败，锁定态改为引导去设置密码。 */
const configured = computed(() => settingStore.isSecretChatConfigured())

/** 列表过滤 / 加密状态 / 解锁回跳 / 移出私密确认 / 离开页面即上锁与桌面端共用同一份规则。 */
const {
  locked,
  hiddenSessions,
  isEncrypted,
  sessionAriaLabel,
  handleUnlockClick,
  handleSessionClick,
  handleUnmark: unmarkPrivateSession
} = useSecretChatPage({
  returnTarget: '/mobile/secretChat',
  // 不清除私密标记：只是进入查看。
  openSession: (session) => router.push({ name: 'mobileChatMain', params: { roomId: session.roomId } }),
  // 进入私密会话不算「离开」，路由离开上锁由 composable 统一处理
  sessionRouteName: 'mobileChatMain',
  confirmUnmark: async () => {
    try {
      await showConfirmDialog({
        title: t('home.secret_chat.unmark_private'),
        message: t('home.secret_chat.unmark_confirm'),
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel')
      })
      return true
    } catch {
      return false
    }
  },
  isPasswordConfigured: () => settingStore.isSecretChatConfigured(),
  // 未配置密码时解锁不可能成功，直接引导去安全设置页
  onMissingPassword: () => {
    void router.replace(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
  }
})

/** 未配置密码：跳安全设置页完成设置，而不是弹必然失败的解锁框。 */
const handleGoSetupPassword = () => {
  void router.push(MOBILE_SETTINGS_SECURITY_PRIVACY_PATH)
}

/** 移出私密：取消房间标记后回到普通列表；登记表不可用时提示重试。 */
const handleUnmark = async (session: SessionItem) => {
  if ((await unmarkPrivateSession(session)) === 'failed') {
    showToast({ type: 'fail', message: t('home.secret_chat.registry_unavailable') })
  }
}
</script>
