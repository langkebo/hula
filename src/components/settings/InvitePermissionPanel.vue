<template>
  <div v-if="visible" class="invite-permission-panel" role="region" :aria-label="t('setting.invite_permission.title')">
    <div class="invite-permission-panel__header">
      <svg class="invite-permission-panel__icon" aria-hidden="true">
        <use href="#shield"></use>
      </svg>
      <span class="invite-permission-panel__title">{{ t('setting.invite_permission.title') }}</span>
    </div>

    <n-radio-group :value="mode" class="invite-permission-panel__modes" @update:value="handleModeChange">
      <n-radio value="allow_all">{{ t('setting.invite_permission.mode.allow_all') }}</n-radio>
      <n-radio value="blocklist">{{ t('setting.invite_permission.mode.blocklist') }}</n-radio>
      <n-radio value="allowlist">{{ t('setting.invite_permission.mode.allowlist') }}</n-radio>
    </n-radio-group>

    <div v-if="mode === 'blocklist'" data-test="blocklist-section" class="invite-permission-panel__list">
      <div class="invite-permission-panel__list-header">
        <span class="invite-permission-panel__list-title">
          {{ t('setting.invite_permission.blocklist.title') }}
        </span>
      </div>
      <n-input
        v-model:value="blocklistInput"
        :placeholder="t('setting.invite_permission.user_id_placeholder')"
        size="small" />
      <n-button size="small" type="primary" @click="handleAddUser('blocklist')">
        {{ t('setting.invite_permission.add') }}
      </n-button>
      <n-list v-if="blocklist.length > 0" bordered>
        <n-list-item v-for="userId in blocklist" :key="userId" class="invite-permission-panel__list-item">
          <div class="invite-permission-panel__user-row">
            <n-tag size="small">{{ userId }}</n-tag>
            <n-button size="tiny" quaternary @click="handleRemoveUser('blocklist', userId)">
              <template #icon>
                <svg class="invite-permission-panel__remove-icon" aria-hidden="true">
                  <use href="#close"></use>
                </svg>
              </template>
            </n-button>
          </div>
        </n-list-item>
      </n-list>
    </div>

    <div v-if="mode === 'allowlist'" data-test="allowlist-section" class="invite-permission-panel__list">
      <div class="invite-permission-panel__list-header">
        <span class="invite-permission-panel__list-title">
          {{ t('setting.invite_permission.allowlist.title') }}
        </span>
      </div>
      <n-input
        v-model:value="allowlistInput"
        :placeholder="t('setting.invite_permission.user_id_placeholder')"
        size="small" />
      <n-button size="small" type="primary" @click="handleAddUser('allowlist')">
        {{ t('setting.invite_permission.add') }}
      </n-button>
      <n-list v-if="allowlist.length > 0" bordered>
        <n-list-item v-for="userId in allowlist" :key="userId" class="invite-permission-panel__list-item">
          <div class="invite-permission-panel__user-row">
            <n-tag size="small">{{ userId }}</n-tag>
            <n-button size="tiny" quaternary @click="handleRemoveUser('allowlist', userId)">
              <template #icon>
                <svg class="invite-permission-panel__remove-icon" aria-hidden="true">
                  <use href="#close"></use>
                </svg>
              </template>
            </n-button>
          </div>
        </n-list-item>
      </n-list>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { InvitePermissionMode } from '@/composables/app/useInvitePermissionFilter'

defineProps<{
  visible: boolean
  mode: InvitePermissionMode
  blocklist: string[]
  allowlist: string[]
}>()

const emit = defineEmits<{
  'mode-change': [mode: InvitePermissionMode]
  'add-user': [listType: 'blocklist' | 'allowlist', userId: string]
  'remove-user': [listType: 'blocklist' | 'allowlist', userId: string]
}>()

const { t } = useI18n()

const blocklistInput = ref('')
const allowlistInput = ref('')

function handleModeChange(value: InvitePermissionMode) {
  emit('mode-change', value)
}

function handleAddUser(listType: 'blocklist' | 'allowlist') {
  const value = listType === 'blocklist' ? blocklistInput.value : allowlistInput.value
  const trimmed = value.trim()
  if (!trimmed) return
  emit('add-user', listType, trimmed)
  if (listType === 'blocklist') {
    blocklistInput.value = ''
  } else {
    allowlistInput.value = ''
  }
}

function handleRemoveUser(listType: 'blocklist' | 'allowlist', userId: string) {
  emit('remove-user', listType, userId)
}
</script>

<style scoped lang="scss">
.invite-permission-panel {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-3);

  &__header {
    display: flex;
    align-items: center;
    gap: var(--tjg-space-2);
  }

  &__icon {
    width: 16px;
    height: 16px;
    color: var(--tjg-text-primary);
  }

  &__title {
    font-size: var(--tjg-font-size-base);
    font-weight: var(--tjg-font-weight-medium);
    color: var(--tjg-text-primary);
  }

  &__modes {
    display: flex;
    flex-direction: column;
    gap: var(--tjg-space-2);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--tjg-space-2);
    padding: var(--tjg-space-2);
    border-top: 1px solid var(--tjg-border-muted);
  }

  &__list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__list-title {
    font-size: var(--tjg-font-size-sm);
    font-weight: var(--tjg-font-weight-medium);
    color: var(--tjg-text-secondary);
  }

  &__list-item {
    padding: var(--tjg-space-1) var(--tjg-space-2) !important;
  }

  &__user-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--tjg-space-2);
    width: 100%;
  }

  &__remove-icon {
    width: 12px;
    height: 12px;
    color: var(--tjg-text-tertiary);
  }
}
</style>
