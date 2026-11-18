<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.friends.requests.title') }}</h3>
    <div v-if="loadFailed" class="setting-error" data-test="friend-policy-error">
      <span>{{ t('common.load_failed') }}</span>
      <n-button size="small" data-test="friend-policy-retry" @click="emit('retry')">
        {{ t('common.retry') }}
      </n-button>
    </div>
    <template v-else>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.friends.requests.allow_label') }}</span>
          <span class="setting-desc">{{ t('setting.friends.requests.allow_desc') }}</span>
        </div>
        <n-switch :value="allowFriendRequests" @update:value="onSwitch('allowFriendRequests', $event)" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.friends.requests.auto_accept_label') }}</span>
          <span class="setting-desc">{{ t('setting.friends.requests.auto_accept_desc') }}</span>
        </div>
        <n-switch :value="autoAcceptFriends" @update:value="onSwitch('autoAcceptFriends', $event)" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.friends.requests.message_required_label') }}</span>
          <span class="setting-desc">{{ t('setting.friends.requests.message_required_desc') }}</span>
        </div>
        <n-switch
          :value="requireFriendRequestMessage"
          @update:value="onSwitch('requireFriendRequestMessage', $event)" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { NButton, NSwitch } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineOptions({ name: 'FriendsRequestPolicySection' })

defineProps<{
  loadFailed: boolean
  allowFriendRequests: boolean
  autoAcceptFriends: boolean
  requireFriendRequestMessage: boolean
}>()

const emit = defineEmits<{
  'update:allowFriendRequests': [value: boolean]
  'update:autoAcceptFriends': [value: boolean]
  'update:requireFriendRequestMessage': [value: boolean]
  toggle: []
  retry: []
}>()

const { t } = useI18n()

/**
 * 先同步本地值再通知父级保存。
 *
 * 父级的保存失败回滚依赖「模型已改」这一前提；若先保存后回写，
 * 保存成功后模型才更新，回滚路径就永远拿不到新值。
 */
function onSwitch(key: 'allowFriendRequests' | 'autoAcceptFriends' | 'requireFriendRequestMessage', value: boolean) {
  if (key === 'allowFriendRequests') emit('update:allowFriendRequests', value)
  if (key === 'autoAcceptFriends') emit('update:autoAcceptFriends', value)
  if (key === 'requireFriendRequestMessage') emit('update:requireFriendRequestMessage', value)
  emit('toggle')
}
</script>

<style scoped>
.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-3);
  color: var(--tjg-text-primary);
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

.setting-error {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
  padding: var(--tjg-space-3) 0;
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-secondary);
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
</style>
