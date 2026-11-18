<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.friends.pending.title') }}</h3>
    <n-spin :show="loading">
      <div class="request-section">
        <h4 class="subsection-title">
          {{ t('setting.friends.pending.incoming_title', { count: String(incoming.length) }) }}
        </h4>
        <EmptyState v-if="incoming.length === 0" compact :description="t('setting.friends.pending.incoming_empty')" />
        <div v-for="req in incoming" :key="req.user_id" class="request-item">
          <div class="request-info">
            <span class="request-user">{{ req.user_id }}</span>
            <span v-if="req.message" class="request-message">"{{ req.message }}"</span>
          </div>
          <div class="request-actions">
            <n-button size="small" type="primary" @click="emit('accept', req)">
              {{ t('setting.friends.pending.accept') }}
            </n-button>
            <n-button size="small" @click="emit('reject', req)">
              {{ t('setting.friends.pending.reject') }}
            </n-button>
          </div>
        </div>
      </div>

      <div class="request-section request-section--second">
        <h4 class="subsection-title">
          {{ t('setting.friends.pending.outgoing_title', { count: String(outgoing.length) }) }}
        </h4>
        <EmptyState v-if="outgoing.length === 0" compact :description="t('setting.friends.pending.outgoing_empty')" />
        <div v-for="req in outgoing" :key="req.user_id" class="request-item">
          <div class="request-info">
            <span class="request-user">{{ req.user_id }}</span>
            <span class="request-status">{{ t('setting.friends.pending.waiting') }}</span>
          </div>
          <n-button size="small" @click="emit('cancel', req)">{{ t('setting.common.cancel') }}</n-button>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { NButton, NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { FriendRequest } from '@/composables/settings/useFriendsSettings'

defineOptions({ name: 'FriendsPendingSection' })

defineProps<{
  loading: boolean
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
}>()

const emit = defineEmits<{
  accept: [request: FriendRequest]
  reject: [request: FriendRequest]
  cancel: [request: FriendRequest]
}>()

const { t } = useI18n()
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

.subsection-title {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  margin: 0 0 var(--tjg-space-2) 0;
  color: var(--tjg-text-primary);
}

.request-section {
  margin-bottom: var(--tjg-space-2);
}

.request-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px var(--tjg-space-3);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
  margin-bottom: 6px;
}

.request-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.request-user {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
  word-break: break-all;
}

.request-message {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
  margin-top: var(--tjg-space-1);
}

.request-status {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-color-warning-500);
  margin-top: var(--tjg-space-1);
}

.request-actions {
  display: flex;
  gap: var(--tjg-space-1);
  flex-shrink: 0;
  margin-left: var(--tjg-space-3);
}

.request-section--second {
  margin-top: var(--tjg-space-4);
}
</style>
