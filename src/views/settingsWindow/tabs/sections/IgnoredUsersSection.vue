<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.security.ignored_users') }}</h3>
    <n-spin :show="loadingIgnored">
      <div v-if="loadError" class="ignored-error">
        <span>{{ t('common.load_failed') }}</span>
        <n-button size="tiny" text type="primary" data-testid="ignored-users-retry" @click="loadIgnoredUsers">
          {{ t('common.retry') }}
        </n-button>
      </div>
      <div v-else-if="ignoredUsers.length > 0" class="ignored-list">
        <div v-for="user in ignoredUsers" :key="user" class="ignored-item">
          <span class="user-id">{{ user }}</span>
          <n-button size="tiny" @click="handleUnignore(user)">{{ t('setting.security.unignore') }}</n-button>
        </div>
      </div>
      <n-empty v-else :description="t('setting.security.no_ignored_users')" />
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { NButton, NEmpty, NSpin } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useWindowSessionReady } from '@/composables/common/useWindowSessionReady'
import { useAccount } from '@/composables/user/useAccount'
import { createLogger } from '@/utils/Logger'

defineOptions({
  name: 'IgnoredUsersSection'
})

const logger = createLogger('IgnoredUsersSection')

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { getIgnoredUsers, setIgnoredUsers } = useAccount()
const { ensureSessionReady } = useWindowSessionReady()

const loadingIgnored = ref(false)
const loadError = ref(false)
const ignoredUsers = ref<string[]>([])

onMounted(async () => {
  // 等待会话就绪后再加载忽略用户列表。恢复统一走 `useWindowSessionReady()`
  // （幂等：父组件 SecuritySettings 与 SettingsPage 已触发，这里只是 wait 同一次）。
  const sessionState = await ensureSessionReady()
  if (sessionState !== 'ready') {
    logger.warn(`session state=${sessionState}; attempting to load ignored users list anyway`)
  }
  await loadIgnoredUsers()
})

async function loadIgnoredUsers() {
  loadingIgnored.value = true
  loadError.value = false
  try {
    ignoredUsers.value = await getIgnoredUsers()
  } catch (error) {
    logger.warn('Failed to fetch ignored users', error)
    // 读取失败不能渲染成「无忽略用户」：那会让用户以为屏蔽列表已被清空
    loadError.value = true
  } finally {
    loadingIgnored.value = false
  }
}

async function handleUnignore(userId: string) {
  try {
    const newIgnoredUsers = ignoredUsers.value.filter((u) => u !== userId)
    await setIgnoredUsers(newIgnoredUsers)
    ignoredUsers.value = newIgnoredUsers
    showFeedback(t('setting.security.ignored_user_removed'), 'success')
  } catch (error) {
    showFeedback(t('setting.security.operation_failed'), 'error')
  }
}
</script>

<style scoped>
.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.ignored-list {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.ignored-error {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-secondary);
}

.ignored-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-2) var(--tjg-space-3);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-xs);
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}
</style>
