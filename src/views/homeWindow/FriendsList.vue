<template>
  <div class="friends-list-shell" role="main" :aria-label="t('friend.list.title')">
    <div class="friends-list-shell__header" role="banner">
      <button
        type="button"
        class="friends-list-shell__shortcut"
        :aria-label="t('home.secret_chat.title')"
        @click="handleOpenSecretChat">
        <div class="friends-list-shell__shortcut-main">
          <span class="friends-list-shell__shortcut-title">{{ t('home.secret_chat.title') }}</span>
          <span class="friends-list-shell__shortcut-desc">{{ t('home.secret_chat.desc') }}</span>
        </div>
        <svg class="size-16px color-[--tjg-text-primary]" aria-hidden="true"><use href="#eye-close"></use></svg>
      </button>
    </div>

    <div class="min-h-0 flex-1" role="region" :aria-label="t('friend.list.title')">
      <FriendListView class="h-full" />
    </div>
  </div>
</template>

<script setup lang="ts" name="friendsList">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import FriendListView from '@/components/friend/FriendListView.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSettingStore } from '@/stores/domains/settings/setting'

const router = useRouter()
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const settingStore = useSettingStore()

const handleOpenSecretChat = () => {
  if (!settingStore.isSecretChatConfigured()) {
    showFeedback(t('home.secret_chat.no_password'), 'warning')
    return
  }

  void router.push('/secretChat')
}
</script>

<style scoped lang="scss">
.friends-list-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--tjg-surface-panel);
}

.friends-list-shell__header {
  padding: 30px 16px 12px;
  border-bottom: 1px solid var(--tjg-border-layout-divider);
}

.friends-list-shell__shortcut {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background: var(--tjg-surface-list-hover);
  }
}

.friends-list-shell__shortcut-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.friends-list-shell__shortcut-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--tjg-text-primary);
}

.friends-list-shell__shortcut-desc {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
}
</style>
