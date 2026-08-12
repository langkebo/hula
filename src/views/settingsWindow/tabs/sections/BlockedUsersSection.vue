<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.security.blocked_users') }}</h3>
    <n-spin :show="loadingBlocked">
      <div v-if="blockedUsers.length > 0" class="ignored-list">
        <div v-for="user in blockedUsers" :key="user" class="ignored-item">
          <span class="user-id">{{ user }}</span>
          <n-button size="tiny" @click="handleUnblock(user)">{{ t('setting.security.unblock') }}</n-button>
        </div>
      </div>
      <n-empty v-else :description="t('setting.security.no_blocked_users')" />
    </n-spin>
    <div class="add-button-wrapper">
      <n-button size="small" @click="showAddBlocked = true">{{ t('setting.security.add_blocked_user') }}</n-button>
    </div>
  </div>

  <n-modal
    v-model:show="showAddBlocked"
    preset="dialog"
    :title="t('setting.security.add_blocked_user_title')"
    :positive-text="t('setting.security.add')"
    :negative-text="t('setting.common.cancel')"
    @positive-click="handleAddBlocked">
    <n-form>
      <n-form-item :label="t('setting.security.user_id_label')">
        <n-input v-model:value="newBlockedUser" :placeholder="t('setting.security.user_id_placeholder')" />
      </n-form-item>
    </n-form>
  </n-modal>
</template>

<script setup lang="ts">
import { NButton, NEmpty, NForm, NFormItem, NInput, NModal, NSpin } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

defineOptions({
  name: 'BlockedUsersSection'
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loadingBlocked = ref(false)
const blockedUsers = ref<string[]>([])
const showAddBlocked = ref(false)
const newBlockedUser = ref('')

onMounted(() => {
  loadBlockedUsers()
})

// 屏蔽用户列表存储于 localStorage，不依赖 Matrix 客户端
async function loadBlockedUsers() {
  loadingBlocked.value = true
  try {
    const saved = localStorage.getItem('tjg-blocked-users')
    if (saved) {
      blockedUsers.value = JSON.parse(saved)
    }
  } catch {
    // ignore
  } finally {
    loadingBlocked.value = false
  }
}

function saveBlockedUsers() {
  localStorage.setItem('tjg-blocked-users', JSON.stringify(blockedUsers.value))
}

function handleAddBlocked() {
  if (!newBlockedUser.value.trim()) {
    showFeedback(t('setting.security.input_user_id_required'), 'warning')
    return false
  }
  if (blockedUsers.value.includes(newBlockedUser.value.trim())) {
    showFeedback(t('setting.security.user_already_blocked'), 'warning')
    return false
  }
  blockedUsers.value.push(newBlockedUser.value.trim())
  newBlockedUser.value = ''
  saveBlockedUsers()
  showFeedback(t('setting.security.blocked_user_added'), 'success')
}

function handleUnblock(userId: string) {
  blockedUsers.value = blockedUsers.value.filter((u) => u !== userId)
  saveBlockedUsers()
  showFeedback(t('setting.security.blocked_user_removed'), 'success')
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

.add-button-wrapper {
  margin-top: var(--tjg-space-2);
}
</style>
