<template>
  <div v-if="visible" class="invite-permission-panel" role="region" :aria-label="t('setting.invite_permission.title')">
    <div class="invite-permission-panel__header">
      <svg class="invite-permission-panel__icon" aria-hidden="true">
        <use href="#shield"></use>
      </svg>
      <span class="invite-permission-panel__title">{{ t('setting.invite_permission.title') }}</span>
    </div>

    <n-spin :show="loading">
      <div v-if="loadFailed" class="invite-permission-panel__error" data-test="invite-policy-error">
        <span>{{ t('common.load_failed') }}</span>
        <n-button size="small" :disabled="loading" data-test="invite-policy-retry" @click="loadPolicy">
          {{ t('common.retry') }}
        </n-button>
      </div>

      <template v-else>
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
          <n-button size="small" type="primary" data-test="add-blocklist-button" @click="handleAddUser('blocklist')">
            {{ t('setting.invite_permission.add') }}
          </n-button>
          <n-list v-if="blocklist.length > 0" bordered>
            <n-list-item v-for="userId in blocklist" :key="userId" class="invite-permission-panel__list-item">
              <div class="invite-permission-panel__user-row">
                <n-tag size="small">{{ userId }}</n-tag>
                <n-button
                  size="tiny"
                  quaternary
                  :aria-label="t('common.remove')"
                  @click="handleRemoveUser('blocklist', userId)">
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
          <n-button size="small" type="primary" data-test="add-allowlist-button" @click="handleAddUser('allowlist')">
            {{ t('setting.invite_permission.add') }}
          </n-button>
          <n-list v-if="allowlist.length > 0" bordered>
            <n-list-item v-for="userId in allowlist" :key="userId" class="invite-permission-panel__list-item">
              <div class="invite-permission-panel__user-row">
                <n-tag size="small">{{ userId }}</n-tag>
                <n-button
                  size="tiny"
                  quaternary
                  :aria-label="t('common.remove')"
                  @click="handleRemoveUser('allowlist', userId)">
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

        <!-- 私聊：非联系人私聊 + 新私聊默认加密 -->
        <div data-test="dm-section" class="invite-permission-panel__dm">
          <div class="invite-permission-panel__list-header">
            <span class="invite-permission-panel__list-title">
              {{ t('setting.invite_permission.dm_section') }}
            </span>
          </div>

          <div class="invite-permission-panel__setting-row">
            <div>
              <span class="setting-label">{{ t('setting.invite_permission.allow_strangers') }}</span>
              <span class="setting-desc">{{ t('setting.invite_permission.allow_strangers_hint') }}</span>
            </div>
            <n-switch
              data-test="allow-strangers"
              :value="allowStrangers"
              :disabled="mode === 'allowlist'"
              @update:value="handleAllowStrangersChange" />
          </div>
          <p v-if="mode === 'allowlist'" data-test="allow-strangers-note" class="setting-desc">
            {{ t('setting.invite_permission.allow_strangers_inactive') }}
          </p>

          <div class="invite-permission-panel__setting-row">
            <div>
              <span class="setting-label">{{ t('setting.invite_permission.encrypt_new_dm') }}</span>
              <span class="setting-desc">{{ t('setting.invite_permission.encrypt_new_dm_hint') }}</span>
            </div>
            <n-switch
              data-test="encrypt-new-dm"
              :value="encryptByDefault"
              @update:value="handleEncryptByDefaultChange" />
          </div>
        </div>
      </template>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { NButton, NInput, NList, NListItem, NRadio, NRadioGroup, NSpin, NSwitch, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useInvitePermissionPanel } from '@/composables/settings/useInvitePermissionPanel'
import type { InvitePolicyMode } from '@/services/matrix/user/invitePolicy'

/**
 * 桌面邀请权限面板。
 *
 * 状态、account data 读写与事件处理下沉到 `useInvitePermissionPanel`；本组件
 * 只做薄壳：声明 props、取 i18n 的 `t`，并把 composable 的绑定解构到顶层
 * 供模板使用。`visible` 仍作为显示开关保留；`mode`/`blocklist`/`allowlist`
 * 仍可传入用于覆盖初值（测试与嵌入场景）。
 */
const props = withDefaults(
  defineProps<{
    visible?: boolean
    mode?: InvitePolicyMode
    blocklist?: string[]
    allowlist?: string[]
  }>(),
  {
    visible: true
  }
)

const { t } = useI18n()

const {
  visible,
  loading,
  loadFailed,
  mode,
  blocklist,
  allowlist,
  allowStrangers,
  encryptByDefault,
  blocklistInput,
  allowlistInput,
  loadPolicy,
  handleModeChange,
  handleAllowStrangersChange,
  handleEncryptByDefaultChange,
  handleAddUser,
  handleRemoveUser
} = useInvitePermissionPanel(props)
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
    font-size: var(--tjg-font-size-md);
    font-weight: 600;
    color: var(--tjg-text-primary);
  }

  &__error {
    display: flex;
    align-items: center;
    gap: var(--tjg-space-2);
    font-size: var(--tjg-font-size-sm);
    color: var(--tjg-text-secondary);
  }

  &__modes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--tjg-space-3);
  }

  &__list,
  &__dm {
    display: flex;
    flex-direction: column;
    gap: var(--tjg-space-2);
    margin-top: var(--tjg-space-2);
  }

  &__list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__list-title {
    font-size: var(--tjg-font-size-sm);
    font-weight: 600;
    color: var(--tjg-text-primary);
  }

  &__list-item {
    display: flex;
    align-items: center;
  }

  &__user-row {
    display: flex;
    align-items: center;
    gap: var(--tjg-space-2);
  }

  &__remove-icon {
    width: 14px;
    height: 14px;
  }

  &__setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--tjg-space-3);
  }
}

.setting-label {
  display: block;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
}

.setting-desc {
  display: block;
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-secondary);
}
</style>
