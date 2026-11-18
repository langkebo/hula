<template>
  <div class="settings-section">
    <h3 class="section-title">{{ t('setting.friends.groups.title') }}</h3>
    <n-spin :show="loading">
      <EmptyState v-if="groups.length === 0" compact :description="t('setting.friends.groups.empty')" />
      <div v-else class="group-list">
        <div v-for="group in groups" :key="group.group_id" class="group-item">
          <div class="group-info">
            <span class="group-name">{{ group.name }}</span>
            <span class="group-count">
              {{ t('setting.friends.groups.member_count', { count: String(group.member_count) }) }}
            </span>
          </div>
          <div class="group-actions">
            <n-button size="small" quaternary @click="emit('edit', group)">
              {{ t('setting.friends.common.edit') }}
            </n-button>
            <n-button size="small" type="error" quaternary @click="emit('delete', group)">
              {{ t('setting.friends.common.delete') }}
            </n-button>
          </div>
        </div>
      </div>
    </n-spin>
    <n-button class="create-group-btn" size="small" @click="emit('create')">
      {{ t('setting.friends.groups.create_action') }}
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { NButton, NSpin } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { FriendGroup } from '@/composables/settings/useFriendsSettings'

defineOptions({ name: 'FriendsGroupsSection' })

defineProps<{
  loading: boolean
  groups: FriendGroup[]
}>()

const emit = defineEmits<{
  create: []
  edit: [group: FriendGroup]
  delete: [group: FriendGroup]
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

.group-list {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
}

.group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px var(--tjg-space-3);
  background-color: var(--tjg-settings-card-bg);
  border-radius: var(--tjg-radius-sm);
}

.group-info {
  display: flex;
  align-items: center;
  gap: var(--tjg-space-2);
}

.group-name {
  font-size: var(--tjg-font-size-base);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-primary);
}

.group-count {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}

.group-actions {
  display: flex;
  gap: var(--tjg-space-1);
}

.create-group-btn {
  margin-top: var(--tjg-space-2);
}
</style>
