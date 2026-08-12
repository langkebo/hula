<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.security.invite_lists') }}</h3>
    <n-alert type="info" :show-icon="true" class="invite-lists-alert">
      {{ t('setting.security.invite_lists_info') }}
    </n-alert>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.security.invite_blocklist') }}</span>
        <span class="setting-desc">{{ t('setting.security.invite_blocklist_desc') }}</span>
      </div>
      <n-button size="small" @click="showInviteBlocklist = true">
        {{ t('setting.security.manage') }} ({{ inviteBlocklist.length }})
      </n-button>
    </div>
    <div class="setting-item">
      <div class="setting-info">
        <span class="setting-label">{{ t('setting.security.invite_allowlist') }}</span>
        <span class="setting-desc">{{ t('setting.security.invite_allowlist_desc') }}</span>
      </div>
      <n-button size="small" @click="showInviteAllowlist = true">
        {{ t('setting.security.manage') }} ({{ inviteAllowlist.length }})
      </n-button>
    </div>
  </div>

  <n-modal
    v-model:show="showInviteBlocklist"
    preset="card"
    :title="t('setting.security.invite_blocklist_manage_title')"
    style="width: 450px">
    <div class="list-management">
      <div v-for="user in inviteBlocklist" :key="user" class="ignored-item">
        <span class="user-id">{{ user }}</span>
        <n-button size="tiny" @click="handleRemoveInviteBlocklist(user)">{{ t('setting.security.remove') }}</n-button>
      </div>
      <n-empty v-if="inviteBlocklist.length === 0" :description="t('setting.security.blocklist_empty')" />
      <div class="add-row">
        <n-input
          v-model:value="newBlocklistUser"
          :placeholder="t('setting.security.user_id_placeholder')"
          size="small"
          style="flex: 1" />
        <n-button size="small" type="primary" @click="handleAddInviteBlocklist">
          {{ t('setting.security.add') }}
        </n-button>
      </div>
    </div>
  </n-modal>

  <n-modal
    v-model:show="showInviteAllowlist"
    preset="card"
    :title="t('setting.security.invite_allowlist_manage_title')"
    style="width: 450px">
    <div class="list-management">
      <div v-for="user in inviteAllowlist" :key="user" class="ignored-item">
        <span class="user-id">{{ user }}</span>
        <n-button size="tiny" @click="handleRemoveInviteAllowlist(user)">{{ t('setting.security.remove') }}</n-button>
      </div>
      <n-empty v-if="inviteAllowlist.length === 0" :description="t('setting.security.allowlist_empty')" />
      <div class="add-row">
        <n-input
          v-model:value="newAllowlistUser"
          :placeholder="t('setting.security.user_id_placeholder')"
          size="small"
          style="flex: 1" />
        <n-button size="small" type="primary" @click="handleAddInviteAllowlist">
          {{ t('setting.security.add') }}
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { NAlert, NButton, NEmpty, NInput, NModal } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

defineOptions({
  name: 'InviteListsSection'
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const showInviteBlocklist = ref(false)
const showInviteAllowlist = ref(false)
const inviteBlocklist = ref<string[]>([])
const inviteAllowlist = ref<string[]>([])
const newBlocklistUser = ref('')
const newAllowlistUser = ref('')

onMounted(() => {
  loadInviteLists()
})

// 邀请黑白名单存储于 localStorage，不依赖 Matrix 客户端
function loadInviteLists() {
  try {
    const savedBlock = localStorage.getItem('tjg-invite-blocklist')
    if (savedBlock) inviteBlocklist.value = JSON.parse(savedBlock)
    const savedAllow = localStorage.getItem('tjg-invite-allowlist')
    if (savedAllow) inviteAllowlist.value = JSON.parse(savedAllow)
  } catch {
    // ignore
  }
}

function saveInviteBlocklist() {
  localStorage.setItem('tjg-invite-blocklist', JSON.stringify(inviteBlocklist.value))
}

function saveInviteAllowlist() {
  localStorage.setItem('tjg-invite-allowlist', JSON.stringify(inviteAllowlist.value))
}

function handleAddInviteBlocklist() {
  if (!newBlocklistUser.value.trim()) {
    showFeedback(t('setting.security.input_user_id_required'), 'warning')
    return
  }
  if (inviteBlocklist.value.includes(newBlocklistUser.value.trim())) {
    showFeedback(t('setting.security.user_already_in_blocklist'), 'warning')
    return
  }
  inviteBlocklist.value.push(newBlocklistUser.value.trim())
  newBlocklistUser.value = ''
  saveInviteBlocklist()
  showFeedback(t('setting.security.invite_blocklist_added'), 'success')
}

function handleRemoveInviteBlocklist(userId: string) {
  inviteBlocklist.value = inviteBlocklist.value.filter((u) => u !== userId)
  saveInviteBlocklist()
  showFeedback(t('setting.security.invite_blocklist_removed'), 'success')
}

function handleAddInviteAllowlist() {
  if (!newAllowlistUser.value.trim()) {
    showFeedback(t('setting.security.input_user_id_required'), 'warning')
    return
  }
  if (inviteAllowlist.value.includes(newAllowlistUser.value.trim())) {
    showFeedback(t('setting.security.user_already_in_allowlist'), 'warning')
    return
  }
  inviteAllowlist.value.push(newAllowlistUser.value.trim())
  newAllowlistUser.value = ''
  saveInviteAllowlist()
  showFeedback(t('setting.security.invite_allowlist_added'), 'success')
}

function handleRemoveInviteAllowlist(userId: string) {
  inviteAllowlist.value = inviteAllowlist.value.filter((u) => u !== userId)
  saveInviteAllowlist()
  showFeedback(t('setting.security.invite_allowlist_removed'), 'success')
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

.invite-lists-alert {
  margin-bottom: var(--tjg-space-3);
  font-size: var(--tjg-font-size-sm);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.setting-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
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

.add-row {
  margin-top: var(--tjg-space-2);
  display: flex;
  gap: var(--tjg-space-2);
}
</style>
