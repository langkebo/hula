<template>
  <div class="admin-users">
    <div class="admin-users-header">
      <n-input v-model:value="searchQuery" :placeholder="t('admin.users.search')" clearable style="width: 300px">
        <template #prefix>
          <svg class="size-16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </template>
      </n-input>
      <n-button type="primary" @click="showCreateDialog = true">
        {{ t('admin.users.createUser') }}
      </n-button>
    </div>

    <n-spin :show="loading">
      <n-data-table
        :columns="columns"
        :data="filteredUsers"
        :pagination="{ pageSize: 20 }"
        :bordered="false"
        striped
        :row-key="(row: UserInfo) => row.userId" />
    </n-spin>

    <n-modal v-model:show="showCreateDialog" :title="t('admin.users.createUser')" preset="dialog" style="width: 500px">
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
      <template #action>
        <n-button @click="showCreateDialog = false">{{ t('admin.common.cancel') }}</n-button>
        <n-button type="primary" :loading="creating" @click="handleCreateUser">
          {{ t('admin.common.confirm') }}
        </n-button>
      </template>
    </n-modal>

    <n-modal v-model:show="showUserDetail" :title="t('admin.users.userDetail')" preset="dialog" style="width: 700px">
      <template v-if="selectedUser">
        <n-descriptions bordered :column="2" label-placement="left" style="margin-bottom: 16px">
          <n-descriptions-item :label="t('admin.users.userId')">{{ selectedUser.userId }}</n-descriptions-item>
          <n-descriptions-item :label="t('admin.users.displayName')">
            {{ selectedUser.displayname || '-' }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.users.status')">
            <n-tag :type="selectedUser.deactivated ? 'error' : 'success'" size="small">
              {{ selectedUser.deactivated ? t('admin.users.deactivated') : t('admin.users.active') }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.users.role')">
            <n-tag :type="selectedUser.admin ? 'warning' : 'default'" size="small">
              {{ selectedUser.admin ? t('admin.users.adminRole') : t('admin.users.userRole') }}
            </n-tag>
          </n-descriptions-item>
        </n-descriptions>

        <n-tabs type="line" animated>
          <n-tab-pane name="devices" :tab="t('admin.users.devices')">
            <n-spin :show="devicesLoading">
              <n-data-table
                v-if="userDevices.length > 0"
                :columns="deviceColumns"
                :data="userDevices"
                :bordered="false"
                size="small"
                :row-key="(row: UserDevice) => row.deviceId" />
              <n-empty v-else :description="t('admin.users.noDevices')" style="padding: 24px 0" />
            </n-spin>
          </n-tab-pane>

          <n-tab-pane name="rateLimit" :tab="t('admin.users.rateLimit')">
            <n-spin :show="rateLimitLoading">
              <n-space vertical>
                <n-descriptions bordered :column="2" label-placement="left">
                  <n-descriptions-item :label="t('admin.users.messagesPerSecond')">
                    {{ rateLimit?.messagesPerSecond ?? t('admin.users.default') }}
                  </n-descriptions-item>
                  <n-descriptions-item :label="t('admin.users.burstCount')">
                    {{ rateLimit?.burstCount ?? t('admin.users.default') }}
                  </n-descriptions-item>
                </n-descriptions>
                <n-space>
                  <n-button size="small" @click="showRateLimitDialog = true">
                    {{ t('admin.users.setRateLimit') }}
                  </n-button>
                  <n-button size="small" type="error" @click="handleDeleteRateLimit">
                    {{ t('admin.users.deleteRateLimit') }}
                  </n-button>
                </n-space>
              </n-space>
            </n-spin>
          </n-tab-pane>

          <n-tab-pane name="shadowBan" :tab="t('admin.users.shadowBan')">
            <n-spin :show="shadowBanLoading">
              <n-space vertical>
                <div class="shadow-ban-status">
                  <n-tag :type="shadowBanStatus?.banned ? 'error' : 'success'" size="medium">
                    {{ shadowBanStatus?.banned ? t('admin.users.shadowBanned') : t('admin.users.notShadowBanned') }}
                  </n-tag>
                  <span v-if="shadowBanStatus?.bannedAt" class="ban-time">
                    {{ t('admin.users.bannedAt') }}: {{ new Date(shadowBanStatus.bannedAt).toLocaleString() }}
                  </span>
                </div>
                <n-space>
                  <n-button v-if="!shadowBanStatus?.banned" size="small" type="error" @click="handleShadowBan">
                    {{ t('admin.users.shadowBan') }}
                  </n-button>
                  <n-button v-else size="small" type="success" @click="handleUnshadowBan">
                    {{ t('admin.users.unshadowBan') }}
                  </n-button>
                </n-space>
              </n-space>
            </n-spin>
          </n-tab-pane>

          <n-tab-pane name="actions" :tab="t('admin.users.quickActions')">
            <n-space vertical>
              <n-button size="small" @click="handleResetPassword(selectedUser!.userId)">
                {{ t('admin.users.resetPassword') }}
              </n-button>
              <n-button size="small" @click="handleToggleAdmin(selectedUser!)">
                {{ selectedUser!.admin ? t('admin.users.removeAdmin') : t('admin.users.grantAdmin') }}
              </n-button>
              <n-button
                size="small"
                :type="selectedUser!.deactivated ? 'success' : 'error'"
                @click="handleToggleDeactivate(selectedUser!)">
                {{ selectedUser!.deactivated ? t('admin.users.reactivate') : t('admin.users.deactivate') }}
              </n-button>
            </n-space>
          </n-tab-pane>
        </n-tabs>
      </template>
      <template #action>
        <n-button @click="showUserDetail = false">{{ t('admin.common.close') }}</n-button>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showRateLimitDialog"
      :title="t('admin.users.setRateLimit')"
      preset="dialog"
      style="width: 400px">
      <n-form :model="rateLimitForm">
        <n-form-item :label="t('admin.users.messagesPerSecond')">
          <n-input-number v-model:value="rateLimitForm.messagesPerSecond" :min="0" :max="1000" style="width: 100%" />
        </n-form-item>
        <n-form-item :label="t('admin.users.burstCount')">
          <n-input-number v-model:value="rateLimitForm.burstCount" :min="0" :max="10000" style="width: 100%" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showRateLimitDialog = false">{{ t('admin.common.cancel') }}</n-button>
        <n-button type="primary" :loading="settingRateLimit" @click="handleSetRateLimit">
          {{ t('admin.common.confirm') }}
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NSpace, NTag, useMessage, useDialog } from 'naive-ui'
import type { UserInfo, UserDevice } from '@/services/matrix/admin/MatrixAdminService'
import { useAdminUsers } from '@/composables/admin'
import { useAdminStore } from '@/stores/domains/admin/admin'
import { useAdminErrorHandler } from './useAdminError'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const adminStore = useAdminStore()
const { handleAdminError } = useAdminErrorHandler()

const admin = useAdminUsers()
// View-only local state (UI affordances, not business data)
const showCreateDialog = ref(false)
const creating = ref(false)
const createFormRef = ref()
const showUserDetail = ref(false)
const showRateLimitDialog = ref(false)
const settingRateLimit = ref(false)

// Alias refs from composable so existing template bindings keep working
const users = admin.users
const loading = admin.loading
const searchQuery = admin.searchQuery
const filteredUsers = admin.filteredUsers
const selectedUser = admin.selectedUser
const userDevices = admin.userDevices
const devicesLoading = admin.devicesLoading
const rateLimit = admin.rateLimit
const rateLimitLoading = admin.rateLimitLoading
const shadowBanStatus = admin.shadowBanStatus
const shadowBanLoading = admin.shadowBanLoading

const createForm = ref({
  username: '',
  password: '',
  displayName: '',
  isAdmin: false
})

const rateLimitForm = ref({
  messagesPerSecond: 10,
  burstCount: 20
})

const createRules = {
  username: { required: true, message: t('admin.users.usernameRequired') },
  password: { required: true, message: t('admin.users.passwordRequired') }
}

const columns = computed(() => [
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

const deviceColumns = computed(() => [
  { title: t('admin.users.deviceId'), key: 'deviceId', ellipsis: { tooltip: true }, width: 140 },
  { title: t('admin.users.deviceName'), key: 'displayName', width: 140 },
  { title: t('admin.users.lastSeenIp'), key: 'lastSeenIp', width: 130 },
  {
    title: t('admin.users.lastSeenTime'),
    key: 'lastSeenTs',
    width: 160,
    render(row: UserDevice) {
      return row.lastSeenTs ? new Date(row.lastSeenTs).toLocaleString() : '-'
    }
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 80,
    render(row: UserDevice) {
      return h(NButton, { size: 'small', type: 'error', onClick: () => handleDeleteDevice(row.deviceId) }, () =>
        t('admin.users.deleteDevice')
      )
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
      message.success(t('admin.users.createSuccess'))
      showCreateDialog.value = false
      createForm.value = { username: '', password: '', displayName: '', isAdmin: false }
    } else {
      message.error(t('admin.users.createFailed'))
    }
  } catch (err) {
    if (handleAdminError(err)) message.error(t('admin.users.createFailed'))
  } finally {
    creating.value = false
  }
}

async function handleResetPassword(userId: string) {
  const newPassword = prompt(t('admin.users.enterNewPassword'))
  if (!newPassword) return
  try {
    await admin.resetPassword(userId, newPassword)
    message.success(t('admin.users.resetSuccess'))
  } catch (err) {
    if (handleAdminError(err)) message.error(t('admin.users.resetFailed'))
  }
}

async function handleToggleDeactivate(user: UserInfo) {
  if (!user.deactivated) {
    dialog.warning({
      title: t('admin.users.deactivate'),
      content: t('admin.users.deactivateConfirm', { userId: user.userId }),
      positiveText: t('admin.common.confirm'),
      negativeText: t('admin.common.cancel'),
      onPositiveClick: async () => {
        try {
          await admin.deactivateUser(user.userId)
          message.success(t('admin.users.deactivateSuccess'))
        } catch (err) {
          if (handleAdminError(err)) message.error(t('admin.users.deactivateFailed'))
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
        message.success(t('admin.users.adminUpdateSuccess'))
      } catch (err) {
        if (handleAdminError(err)) message.error(t('admin.users.adminUpdateFailed'))
      }
    }
  })
}

async function handleDeleteDevice(deviceId: string) {
  if (!selectedUser.value) return
  dialog.warning({
    title: t('admin.users.deleteDevice'),
    content: t('admin.users.deleteDeviceConfirm', { deviceId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await admin.deleteUserDevice(selectedUser.value!.userId, deviceId)
        message.success(t('admin.users.deleteDeviceSuccess'))
      } catch (err) {
        if (handleAdminError(err)) message.error(t('admin.users.deleteDeviceFailed'))
      }
    }
  })
}

async function handleSetRateLimit() {
  if (!selectedUser.value) return
  settingRateLimit.value = true
  try {
    await admin.setRateLimit(selectedUser.value.userId, {
      messagesPerSecond: rateLimitForm.value.messagesPerSecond,
      burstCount: rateLimitForm.value.burstCount
    })
    message.success(t('admin.users.rateLimitSetSuccess'))
    showRateLimitDialog.value = false
  } catch (err) {
    if (handleAdminError(err)) message.error(t('admin.users.rateLimitSetFailed'))
  } finally {
    settingRateLimit.value = false
  }
}

async function handleDeleteRateLimit() {
  if (!selectedUser.value) return
  try {
    await admin.deleteRateLimit(selectedUser.value.userId)
    message.success(t('admin.users.rateLimitDeleteSuccess'))
  } catch (err) {
    if (handleAdminError(err)) message.error(t('admin.users.rateLimitDeleteFailed'))
  }
}

async function handleShadowBan() {
  if (!selectedUser.value) return
  dialog.warning({
    title: t('admin.users.shadowBan'),
    content: t('admin.users.shadowBanConfirm', { userId: selectedUser.value.userId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await admin.shadowBanUser(selectedUser.value!.userId)
        message.success(t('admin.users.shadowBanSuccess'))
      } catch (err) {
        if (handleAdminError(err)) message.error(t('admin.users.shadowBanFailed'))
      }
    }
  })
}

async function handleUnshadowBan() {
  if (!selectedUser.value) return
  try {
    await admin.unshadowBanUser(selectedUser.value.userId)
    message.success(t('admin.users.unshadowBanSuccess'))
  } catch (err) {
    if (handleAdminError(err)) message.error(t('admin.users.unshadowBanFailed'))
  }
}

onMounted(loadUsers)
</script>

<style scoped lang="scss">
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

.shadow-ban-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.ban-time {
  font-size: 13px;
  color: var(--color-text-quaternary);
}

@media (max-width: 768px) {
  .admin-users-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
