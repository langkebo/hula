<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.security.ignored_users') }}</h3>
    <n-spin :show="loadingIgnored">
      <div v-if="ignoredUsers.length > 0" class="ignored-list">
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
import { useAccount } from '@/composables/user/useAccount'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { createLogger } from '@/utils/Logger'

defineOptions({
  name: 'IgnoredUsersSection'
})

const logger = createLogger('IgnoredUsersSection')

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { getIgnoredUsers, setIgnoredUsers } = useAccount()

const loadingIgnored = ref(false)
const ignoredUsers = ref<string[]>([])

onMounted(async () => {
  // 等待 Matrix 客户端就绪后再加载忽略用户列表
  // （独立 WebView 会话恢复时，客户端由父组件 ensureClientReady 异步重建）
  try {
    await matrixClientService.waitForClientReady({ timeoutMs: 15000 })
  } catch (err) {
    logger.warn('waitForClientReady 超时，仍尝试加载忽略用户列表:', err)
  }
  await loadIgnoredUsers()
})

async function loadIgnoredUsers() {
  loadingIgnored.value = true
  try {
    ignoredUsers.value = await getIgnoredUsers()
  } catch (error) {
    logger.warn('Failed to fetch ignored users', error)
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
