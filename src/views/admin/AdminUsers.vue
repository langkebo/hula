<template>
  <div class="admin-users">
    <div class="admin-users-header">
      <n-space align="center" :size="12">
        <n-input v-model:value="searchQuery" :placeholder="t('admin.users.search')" clearable class="w-[300px]">
          <template #prefix>
            <svg class="size-16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </template>
        </n-input>
        <n-select
          v-model:value="filterRole"
          :options="[
            { label: t('admin.users.allRoles'), value: 'all' },
            { label: t('admin.users.adminRole'), value: 'admin' },
            { label: t('admin.users.userRole'), value: 'user' }
          ]"
          class="w-[140px]" />
        <n-select
          v-model:value="filterStatus"
          :options="[
            { label: t('admin.users.allStatuses'), value: 'all' },
            { label: t('admin.users.active'), value: 'active' },
            { label: t('admin.users.deactivated'), value: 'deactivated' }
          ]"
          class="w-[140px]" />
      </n-space>
      <n-space>
        <n-button type="primary" @click="showCreateDialog = true">
          {{ t('admin.users.createUser') }}
        </n-button>
      </n-space>
    </div>

    <AdminBulkActionBar :selected-count="selectedUserIds.size" :actions="batchActions" @action="handleBatchAction" />

    <AdminTable
      :columns="columns"
      :data="filteredUsers"
      :loading="loading"
      :pagination="{ pageSize: 20 }"
      :row-key="(row: UserInfo) => row.userId" />

    <n-drawer v-model:show="showCreateDialog" placement="right" :width="380">
      <n-drawer-content :title="t('admin.users.createUser')" closable>
        <n-form ref="createFormRef" :model="createForm" :rules="createRules">
          <n-form-item :label="t('admin.users.username')" path="username">
            <n-input v-model:value="createForm.username" />
          </n-form-item>
          <n-form-item :label="t('admin.users.password')" path="password">
            <n-input v-model:value="createForm.password" type="password" show-password-on="click" />
          </n-form-item>
          <n-form-item :label="t('admin.users.displayName')" path="displayName">
            <n-input v-model:value="createForm.displayName" />
          </n-form-item>
          <n-form-item :label="t('admin.users.isAdmin')" path="isAdmin">
            <n-switch v-model:value="createForm.isAdmin" />
          </n-form-item>
        </n-form>
        <template #footer>
          <div class="flex justify-end gap-12px">
            <n-button @click="showCreateDialog = false">{{ t('admin.common.cancel') }}</n-button>
            <n-button type="primary" :loading="creating" @click="handleCreateUser">
              {{ t('admin.common.confirm') }}
            </n-button>
          </div>
        </template>
      </n-drawer-content>
    </n-drawer>

    <AdminUserDetailDrawer
      v-model:show="showUserDetail"
      :admin="admin"
      @reset-password="handleResetPassword"
      @toggle-admin="handleToggleAdmin"
      @toggle-deactivate="handleToggleDeactivate" />
  </div>
</template>

<script setup lang="ts">
import { NButton, NCheckbox, NDrawer, NDrawerContent, NSpace, NTag, useDialog } from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminBulkActionBar from '@/components/admin/AdminBulkActionBar.vue'
import AdminTable from '@/components/admin/AdminTable.vue'
import { type UserInfo, useAdminUsers } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAdminStore } from '@/stores/domains/admin/admin'
import AdminUserDetailDrawer from './AdminUserDetailDrawer.vue'
import { useAdminErrorHandler } from './useAdminError'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const dialog = useDialog()
const adminStore = useAdminStore()
const { handleAdminError } = useAdminErrorHandler()

const admin = useAdminUsers()
// View-only local state (UI affordances, not business data)
const showCreateDialog = ref(false)
const creating = ref(false)
const showUserDetail = ref(false)

// Alias refs from composable so existing template bindings keep working
const loading = admin.loading
const searchQuery = admin.searchQuery
const filterRole = admin.filterRole
const filterStatus = admin.filterStatus
const filteredUsers = admin.filteredUsers
const selectedUserIds = admin.selectedUserIds

const createForm = ref({
  username: '',
  password: '',
  displayName: '',
  isAdmin: false
})

const createRules = {
  username: { required: true, message: t('admin.users.usernameRequired') },
  password: { required: true, message: t('admin.users.passwordRequired') }
}

const columns = computed(() => [
  {
    title: '',
    key: '__selection',
    width: 50,
    render(row: UserInfo) {
      return h(NCheckbox, {
        checked: selectedUserIds.value.has(row.userId),
        onUpdateChecked: () => admin.toggleUserSelection(row.userId)
      })
    }
  },
  {
    title: t('admin.users.userId'),
    key: 'userId',
    ellipsis: { tooltip: true },
    width: 260
  },
  {
    title: t('admin.users.displayName'),
    key: 'displayname',
    ellipsis: { tooltip: true },
    width: 150
  },
  {
    title: t('admin.users.status'),
    key: 'deactivated',
    width: 100,
    render(row: UserInfo) {
      return h(NTag, { type: row.deactivated ? 'error' : 'success', size: 'small' }, () =>
        row.deactivated ? t('admin.users.deactivated') : t('admin.users.active')
      )
    }
  },
  {
    title: t('admin.users.role'),
    key: 'admin',
    width: 100,
    render(row: UserInfo) {
      return h(NTag, { type: row.admin ? 'warning' : 'default', size: 'small' }, () =>
        row.admin ? t('admin.users.adminRole') : t('admin.users.userRole')
      )
    }
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 200,
    render(row: UserInfo) {
      return h(NSpace, { size: 'small' }, () => [
        h(NButton, { size: 'small', type: 'primary', onClick: () => openUserDetail(row) }, () =>
          t('admin.users.detail')
        ),
        h(
          NButton,
          {
            size: 'small',
            type: row.deactivated ? 'success' : 'error',
            onClick: () => handleToggleDeactivate(row)
          },
          () => (row.deactivated ? t('admin.users.reactivate') : t('admin.users.deactivate'))
        )
      ])
    }
  }
])

async function loadUsers() {
  if (!adminStore.isAdmin) return
  await admin.loadUsers(200)
}

async function openUserDetail(user: UserInfo) {
  showUserDetail.value = true
  await admin.selectUser(user)
}

async function handleCreateUser() {
  creating.value = true
  try {
    const result = await admin.createUser(createForm.value.username, createForm.value.password, {
      admin: createForm.value.isAdmin,
      displayname: createForm.value.displayName
    })
    if (result) {
      showFeedback(t('admin.users.createSuccess'), 'success')
      showCreateDialog.value = false
      createForm.value = { username: '', password: '', displayName: '', isAdmin: false }
    } else {
      showFeedback(t('admin.users.createFailed'), 'error')
    }
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.users.createFailed'), 'error')
  } finally {
    creating.value = false
  }
}

async function handleResetPassword(userId: string) {
  const newPassword = prompt(t('admin.users.enterNewPassword'))
  if (!newPassword) return
  try {
    await admin.resetPassword(userId, newPassword)
    showFeedback(t('admin.users.resetSuccess'), 'success')
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.users.resetFailed'), 'error')
  }
}

async function handleToggleDeactivate(user: UserInfo) {
  if (user.deactivated) {
    // 重新激活用户
    dialog.info({
      title: t('admin.users.reactivate'),
      content: t('admin.users.reactivateConfirm', { userId: user.userId }),
      positiveText: t('admin.common.confirm'),
      negativeText: t('admin.common.cancel'),
      onPositiveClick: async () => {
        try {
          await admin.activateUser(user.userId)
          showFeedback(t('admin.users.reactivateSuccess'), 'success')
        } catch (err) {
          if (handleAdminError(err)) showFeedback(t('admin.users.reactivateFailed'), 'error')
        }
      }
    })
  } else {
    // 停用用户
    dialog.warning({
      title: t('admin.users.deactivate'),
      content: t('admin.users.deactivateConfirm', { userId: user.userId }),
      positiveText: t('admin.common.confirm'),
      negativeText: t('admin.common.cancel'),
      onPositiveClick: async () => {
        try {
          await admin.deactivateUser(user.userId)
          showFeedback(t('admin.users.deactivateSuccess'), 'success')
        } catch (err) {
          if (handleAdminError(err)) showFeedback(t('admin.users.deactivateFailed'), 'error')
        }
      }
    })
  }
}

async function handleToggleAdmin(user: UserInfo) {
  const newAdminState = !user.admin
  dialog.warning({
    title: newAdminState ? t('admin.users.grantAdmin') : t('admin.users.removeAdmin'),
    content: t('admin.users.adminConfirm', {
      userId: user.userId,
      action: newAdminState ? t('admin.users.grantAdmin') : t('admin.users.removeAdmin')
    }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await admin.setAdmin(user.userId, newAdminState)
        showFeedback(t('admin.users.adminUpdateSuccess'), 'success')
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.users.adminUpdateFailed'), 'error')
      }
    }
  })
}

async function handleBatchDeactivate() {
  const ids = Array.from(selectedUserIds.value)
  if (ids.length === 0) return
  dialog.warning({
    title: t('admin.users.batchDeactivate'),
    content: t('admin.users.batchDeactivateConfirm', { count: ids.length }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        const result = await admin.batchDeactivate(ids)
        const failedCount = result.filter((r) => !r.success).length
        if (failedCount === 0) {
          showFeedback(t('admin.users.batchDeactivateSuccess'), 'success')
        } else {
          showFeedback(t('admin.users.batchDeactivatePartial', { failed: failedCount }), 'warning')
        }
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.users.batchDeactivateFailed'), 'error')
      }
    }
  })
}

// 批量操作列表（由 AdminBulkActionBar 渲染）
const batchActions = computed(() => [
  { key: 'deactivate', label: t('admin.users.batchDeactivate'), type: 'error' as const }
])

function handleBatchAction(key: string) {
  if (key === 'deactivate') handleBatchDeactivate()
}

onMounted(loadUsers)
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;
.admin-users {
  max-width: 1200px;
}

.admin-users-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

@include responsive.down('md') {
  .admin-users-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
