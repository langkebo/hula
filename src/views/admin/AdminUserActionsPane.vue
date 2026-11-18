<template>
  <n-tab-pane name="actions" :tab="t('admin.users.quickActions')">
    <n-space vertical>
      <n-button size="small" @click="emit('reset-password', selectedUser!.userId)">
        {{ t('admin.users.resetPassword') }}
      </n-button>
      <n-button size="small" @click="emit('toggle-admin', selectedUser!)">
        {{ selectedUser!.admin ? t('admin.users.removeAdmin') : t('admin.users.grantAdmin') }}
      </n-button>
      <n-button
        size="small"
        :type="selectedUser!.deactivated ? 'success' : 'error'"
        @click="emit('toggle-deactivate', selectedUser!)">
        {{ selectedUser!.deactivated ? t('admin.users.reactivate') : t('admin.users.deactivate') }}
      </n-button>
      <n-popconfirm @positive-click="handleInvalidateSession">
        <template #trigger>
          <n-button size="small" type="warning">
            {{ t('admin.users.invalidateAllSessions') }}
          </n-button>
        </template>
        {{ t('admin.users.invalidateSessionConfirm') }}
      </n-popconfirm>

      <n-divider class="my-4px" />

      <n-button size="small" type="warning" :loading="evicting" @click="handleEvict">
        {{ t('admin.users.evictUser') }}
      </n-button>
      <n-button size="small" type="error" :loading="loggingOutAll" @click="handleLogoutAll">
        {{ t('admin.users.logoutUserAll') }}
      </n-button>
      <n-button size="small" type="warning" :loading="samlLoggingOut" @click="handleSamlLogout">
        {{ t('admin.users.samlLogout') }}
      </n-button>
      <n-button size="small" type="info" :loading="impersonating" @click="handleLoginAs">
        {{ t('admin.users.loginUserAs') }}
      </n-button>

      <n-alert v-if="impersonationSession" type="warning" :bordered="false" class="mt-8px">
        <div class="impersonation-title">{{ t('admin.users.impersonationSession') }}</div>
        <div class="impersonation-hint">{{ t('admin.users.impersonationHint') }}</div>
        <n-input
          :value="impersonationSession.accessToken"
          readonly
          size="small"
          class="mt-8px"
          :aria-label="t('admin.users.accessToken')" />
        <div class="impersonation-meta">
          {{ t('admin.users.deviceId') }}: {{ impersonationSession.deviceId || '-' }}
        </div>
        <n-space class="mt-8px">
          <n-button size="tiny" @click="handleCopyToken">{{ t('admin.users.copyToken') }}</n-button>
          <n-button size="tiny" quaternary @click="admin.clearImpersonation()">
            {{ t('admin.users.clearSession') }}
          </n-button>
        </n-space>
      </n-alert>
    </n-space>
  </n-tab-pane>
</template>

<script setup lang="ts">
import { NAlert, NButton, NDivider, NInput, NPopconfirm, NSpace, NTabPane, useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { UseAdminUsersResult, UserInfo } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAdminErrorHandler } from './useAdminError'

const props = defineProps<{
  /** 父级持有的用户管理 composable 实例；本组件不自行创建，避免状态分叉。 */
  admin: UseAdminUsersResult
}>()

const emit = defineEmits<{
  'reset-password': [userId: string]
  'toggle-admin': [user: UserInfo]
  'toggle-deactivate': [user: UserInfo]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { handleAdminError } = useAdminErrorHandler()
const dialog = useDialog()
const { selectedUser, evicting, loggingOutAll, samlLoggingOut, impersonating, impersonationSession } = props.admin

async function handleInvalidateSession() {
  const user = selectedUser.value
  if (!user) return
  try {
    await props.admin.invalidateSession(user.userId)
    showFeedback(t('admin.users.invalidateSessionSuccess'), 'success')
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.users.invalidateSessionFailed'), 'error')
  }
}

function handleEvict() {
  const user = selectedUser.value
  if (!user) return
  dialog.warning({
    title: t('admin.users.evictUser'),
    content: t('admin.users.evictConfirm', { userId: user.userId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await props.admin.evictUser(user.userId)
        showFeedback(t('admin.users.evictSuccess'), 'success')
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.users.evictFailed'), 'error')
      }
    }
  })
}

function handleLogoutAll() {
  const user = selectedUser.value
  if (!user) return
  dialog.warning({
    title: t('admin.users.logoutUserAll'),
    content: t('admin.users.logoutAllConfirm', { userId: user.userId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await props.admin.logoutUserAll(user.userId)
        showFeedback(t('admin.users.logoutAllSuccess'), 'success')
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.users.logoutAllFailed'), 'error')
      }
    }
  })
}

function handleSamlLogout() {
  const user = selectedUser.value
  if (!user) return
  dialog.warning({
    title: t('admin.users.samlLogout'),
    content: t('admin.users.samlLogoutConfirm', { userId: user.userId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await props.admin.samlLogout(user.userId)
        showFeedback(t('admin.users.samlLogoutSuccess'), 'success')
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.users.samlLogoutFailed'), 'error')
      }
    }
  })
}

function handleLoginAs() {
  const user = selectedUser.value
  if (!user) return
  dialog.warning({
    title: t('admin.users.loginUserAs'),
    content: t('admin.users.loginAsConfirm', { userId: user.userId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        const session = await props.admin.loginUserAs(user.userId)
        if (!session) {
          showFeedback(t('admin.users.loginAsFailed'), 'error')
          return
        }
        showFeedback(t('admin.users.loginAsSuccess'), 'success')
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.users.loginAsFailed'), 'error')
      }
    }
  })
}

async function handleCopyToken() {
  const token = impersonationSession.value?.accessToken
  if (!token) return
  try {
    await navigator.clipboard.writeText(token)
    showFeedback(t('admin.users.copyTokenSuccess'), 'success')
  } catch {
    showFeedback(t('admin.users.copyTokenFailed'), 'error')
  }
}
</script>

<style scoped lang="scss">
.impersonation-title {
  font-size: 13px;
  font-weight: 600;
}

.impersonation-hint,
.impersonation-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--tjg-text-secondary);
}
</style>
