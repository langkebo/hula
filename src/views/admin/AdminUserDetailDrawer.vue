<template>
  <n-drawer :show="show" placement="right" :width="520" @update:show="emit('update:show', $event)">
    <n-drawer-content :title="t('admin.users.userDetail')" closable>
      <template v-if="selectedUser">
        <n-descriptions bordered :column="2" label-placement="left" class="mb-16px">
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
            <n-space align="center" :size="8">
              <n-tag :type="selectedUser.admin ? 'warning' : 'default'" size="small">
                {{ selectedUser.admin ? t('admin.users.adminRole') : t('admin.users.userRole') }}
              </n-tag>
              <n-switch
                :value="!!selectedUser.admin"
                size="small"
                @update:value="(val: boolean) => handleToggleAdminSwitch(val)">
                <template #checked>{{ t('admin.users.adminRole') }}</template>
                <template #unchecked>{{ t('admin.users.userRole') }}</template>
              </n-switch>
            </n-space>
          </n-descriptions-item>
          <n-descriptions-item v-if="accountStatusData" :label="t('admin.users.accountStatus')" :span="2">
            <n-space :size="8">
              <n-tag :type="accountStatusTagType" size="small">
                {{ accountStatusLabel }}
              </n-tag>
              <span v-if="accountStatusData.suspended" class="account-detail">
                {{ t('admin.users.suspended') }}
              </span>
            </n-space>
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
              <n-empty v-else :description="t('admin.users.noDevices')" class="py-24px" />
            </n-spin>
          </n-tab-pane>

          <n-tab-pane name="sessions" :tab="t('admin.users.sessions')">
            <n-spin :show="sessionsLoading">
              <n-data-table
                v-if="userSessions.length > 0"
                :columns="sessionColumns"
                :data="userSessions"
                :bordered="false"
                size="small"
                :row-key="(row: UserSession) => row.deviceId" />
              <n-empty v-else :description="t('admin.users.noSessions')" class="py-24px" />
            </n-spin>
          </n-tab-pane>

          <AdminUserStatisticsPane :stats="userStats" :loading="statsLoading" />

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
                    {{ t('admin.users.overrideUserRateLimit') }}
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
            </n-space>
          </n-tab-pane>
        </n-tabs>
      </template>
      <template #footer>
        <div class="flex justify-end gap-12px">
          <n-button @click="emit('update:show', false)">{{ t('admin.common.close') }}</n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>

  <AdminUserRateLimitDrawer
    v-model:show="showRateLimitDialog"
    :admin="props.admin"
    :user-id="selectedUser?.userId ?? ''" />
</template>

<script setup lang="ts">
import { NButton, NDrawer, NDrawerContent, NSpace, NSwitch, NTag, useDialog } from 'naive-ui'
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UseAdminUsersResult, UserDevice, UserInfo, UserSession } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import AdminUserRateLimitDrawer from './AdminUserRateLimitDrawer.vue'
import AdminUserStatisticsPane from './AdminUserStatisticsPane.vue'
import { useAdminErrorHandler } from './useAdminError'

const props = defineProps<{
  /** 父级持有的用户管理 composable 实例；本组件不自行创建，避免状态分叉。 */
  admin: UseAdminUsersResult
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'reset-password': [userId: string]
  'toggle-admin': [user: UserInfo]
  'toggle-deactivate': [user: UserInfo]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const dialog = useDialog()
const { handleAdminError } = useAdminErrorHandler()

const {
  selectedUser,
  userDevices,
  devicesLoading,
  rateLimit,
  rateLimitLoading,
  shadowBanStatus,
  shadowBanLoading,
  userSessions,
  sessionsLoading,
  userStats,
  statsLoading,
  accountStatus
} = props.admin

const showRateLimitDialog = ref(false)

const accountStatusData = computed(() => accountStatus.value)

const accountStatusLabel = computed(() => {
  if (!accountStatus.value) return ''
  if (accountStatus.value.suspended) return t('admin.users.suspended')
  if (accountStatus.value.deactivated) return t('admin.users.deactivated')
  return t('admin.users.active')
})

const accountStatusTagType = computed(() => {
  if (!accountStatus.value) return 'default' as const
  if (accountStatus.value.suspended) return 'warning' as const
  if (accountStatus.value.deactivated) return 'error' as const
  return 'success' as const
})

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

const sessionColumns = computed(() => [
  { title: t('admin.users.deviceId'), key: 'deviceId', ellipsis: { tooltip: true }, width: 140 },
  { title: t('admin.users.deviceName'), key: 'deviceName', width: 140 },
  { title: t('admin.users.lastSeenIp'), key: 'lastSeenIp', width: 130 },
  {
    title: t('admin.users.lastSeenTime'),
    key: 'lastSeenTs',
    width: 160,
    render(row: UserSession) {
      return row.lastSeenTs ? new Date(row.lastSeenTs).toLocaleString() : '-'
    }
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 100,
    render() {
      return h(NButton, { size: 'small', type: 'warning', onClick: () => handleInvalidateSingleSession() }, () =>
        t('admin.users.invalidateSession')
      )
    }
  }
])

function handleToggleAdminSwitch(isAdmin: boolean) {
  if (!selectedUser.value) return
  dialog.warning({
    title: isAdmin ? t('admin.users.grantAdmin') : t('admin.users.removeAdmin'),
    content: t('admin.users.adminConfirm', {
      userId: selectedUser.value.userId,
      action: isAdmin ? t('admin.users.grantAdmin') : t('admin.users.removeAdmin')
    }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await props.admin.setAdmin(selectedUser.value!.userId, isAdmin)
        showFeedback(t('admin.users.adminUpdateSuccess'), 'success')
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.users.adminUpdateFailed'), 'error')
      }
    }
  })
}

function handleDeleteDevice(deviceId: string) {
  if (!selectedUser.value) return
  dialog.warning({
    title: t('admin.users.deleteDevice'),
    content: t('admin.users.deleteDeviceConfirm', { deviceId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await props.admin.deleteUserDevice(selectedUser.value!.userId, deviceId)
        showFeedback(t('admin.users.deleteDeviceSuccess'), 'success')
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.users.deleteDeviceFailed'), 'error')
      }
    }
  })
}

async function handleDeleteRateLimit() {
  if (!selectedUser.value) return
  try {
    await props.admin.deleteRateLimit(selectedUser.value.userId)
    showFeedback(t('admin.users.rateLimitDeleteSuccess'), 'success')
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.users.rateLimitDeleteFailed'), 'error')
  }
}

function handleShadowBan() {
  if (!selectedUser.value) return
  dialog.warning({
    title: t('admin.users.shadowBan'),
    content: t('admin.users.shadowBanConfirm', { userId: selectedUser.value.userId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await props.admin.shadowBanUser(selectedUser.value!.userId)
        showFeedback(t('admin.users.shadowBanSuccess'), 'success')
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.users.shadowBanFailed'), 'error')
      }
    }
  })
}

async function handleUnshadowBan() {
  if (!selectedUser.value) return
  try {
    await props.admin.unshadowBanUser(selectedUser.value.userId)
    showFeedback(t('admin.users.unshadowBanSuccess'), 'success')
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.users.unshadowBanFailed'), 'error')
  }
}

async function handleInvalidateSession() {
  if (!selectedUser.value) return
  try {
    await props.admin.invalidateSession(selectedUser.value.userId)
    showFeedback(t('admin.users.invalidateSessionSuccess'), 'success')
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.users.invalidateSessionFailed'), 'error')
  }
}

function handleInvalidateSingleSession() {
  if (!selectedUser.value) return
  // invalidateUserSession invalidates all sessions for the user
  dialog.warning({
    title: t('admin.users.invalidateSession'),
    content: t('admin.users.invalidateSessionConfirm'),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await props.admin.invalidateSession(selectedUser.value!.userId)
        showFeedback(t('admin.users.invalidateSessionSuccess'), 'success')
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.users.invalidateSessionFailed'), 'error')
      }
    }
  })
}
</script>

<style scoped lang="scss">
.shadow-ban-status {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.ban-time {
  font-size: 13px;
  color: var(--tjg-text-tertiary);
}

.account-detail {
  font-size: 13px;
  color: var(--tjg-text-tertiary);
}
</style>
