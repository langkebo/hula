<template>
  <div class="admin-notifications">
    <n-tabs v-model:value="activeTab" type="line" animated>
      <n-tab-pane name="settings" :tab="t('admin.notifications.settings')">
        <div class="tab-header">
          <n-space align="center">
            <n-input
              v-model:value="userId"
              :placeholder="t('admin.notifications.userIdPlaceholder')"
              clearable
              style="width: 300px" />
            <n-button type="primary" :loading="settingsLoading" @click="handleLoadSettings">
              {{ t('admin.notifications.load') }}
            </n-button>
          </n-space>
        </div>

        <template v-if="notificationSettings">
          <n-card :title="t('admin.notifications.settingsTitle', { userId })" style="margin-bottom: 16px">
            <n-spin :show="settingsLoading">
              <div class="settings-grid">
                <template v-for="(value, key) in flattenedSettings" :key="key">
                  <div class="settings-item">
                    <span class="settings-label">{{ key }}</span>
                    <n-switch
                      v-if="typeof value === 'boolean'"
                      :value="value"
                      @update:value="(val: boolean) => updateSetting(key, val)" />
                    <span v-else class="settings-value">{{ value }}</span>
                  </div>
                </template>
              </div>
            </n-spin>
          </n-card>
          <n-space>
            <n-button type="primary" :loading="saving" @click="handleSaveSettings">
              {{ t('admin.notifications.save') }}
            </n-button>
          </n-space>
        </template>
        <n-empty v-else-if="userId && !settingsLoading" :description="t('admin.notifications.noSettings')" />
      </n-tab-pane>

      <n-tab-pane name="pushers" :tab="t('admin.notifications.pushers')">
        <div class="tab-header">
          <n-space align="center">
            <n-input
              v-model:value="pusherUserId"
              :placeholder="t('admin.notifications.userIdPlaceholder')"
              clearable
              style="width: 300px" />
            <n-button type="primary" :loading="pushersLoading" @click="handleLoadPushers">
              {{ t('admin.notifications.load') }}
            </n-button>
          </n-space>
        </div>

        <n-spin :show="pushersLoading">
          <n-data-table
            :columns="pusherColumns"
            :data="pushers"
            :pagination="{ pageSize: 20 }"
            :bordered="false"
            striped
            :row-key="(_: any, index: number) => String(index)" />
        </n-spin>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { NButton, NPopconfirm, NSpace, NTag } from 'naive-ui'
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminNotifications } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAdminStore } from '@/stores/domains/admin/admin'
import { useAdminErrorHandler } from './useAdminError'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const adminStore = useAdminStore()
const { handleAdminError } = useAdminErrorHandler()

const notifications = useAdminNotifications()

const activeTab = ref('settings')
const userId = ref('')
const pusherUserId = ref('')
const editableSettings = ref<Record<string, unknown>>({})

const notificationSettings = notifications.notificationSettings
const settingsLoading = notifications.settingsLoading
const pushers = notifications.pushers
const pushersLoading = notifications.pushersLoading
const saving = notifications.saving

const flattenedSettings = computed(() => {
  const settings = notificationSettings.value
  if (!settings) return {}
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(settings)) {
    if (key === 'global') {
      const global = value as Record<string, unknown>
      for (const [gk, gv] of Object.entries(global)) {
        result[`global.${gk}`] = gv
      }
    } else {
      result[key] = value
    }
  }
  return result
})

function updateSetting(key: string, value: unknown) {
  editableSettings.value = { ...editableSettings.value, [key]: value }
}

const pusherColumns = computed(() => [
  {
    title: t('admin.notifications.pusherId'),
    key: 'pushkey',
    ellipsis: { tooltip: true },
    width: 200
  },
  {
    title: t('admin.notifications.appId'),
    key: 'app_id',
    width: 150,
    render(row: Record<string, unknown>) {
      return (row.app_id as string) || '-'
    }
  },
  {
    title: t('admin.notifications.deviceName'),
    key: 'device_display_name',
    width: 150,
    render(row: Record<string, unknown>) {
      return (row.device_display_name as string) || '-'
    }
  },
  {
    title: t('admin.notifications.kind'),
    key: 'kind',
    width: 100,
    render(row: Record<string, unknown>) {
      const kind = row.kind as string
      return h(NTag, { size: 'small', type: kind === 'http' ? 'info' : 'default' }, () => kind || '-')
    }
  },
  {
    title: t('admin.notifications.lang'),
    key: 'lang',
    width: 80,
    render(row: Record<string, unknown>) {
      return (row.lang as string) || '-'
    }
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 100,
    render(row: Record<string, unknown>) {
      return h(
        NPopconfirm,
        { onPositiveClick: () => handleDeletePusher(row) },
        {
          trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('admin.notifications.deletePusher')),
          default: () => t('admin.notifications.deletePusherConfirm')
        }
      )
    }
  }
])

async function handleLoadSettings() {
  if (!userId.value) {
    showFeedback(t('admin.notifications.userIdRequired'), 'error')
    return
  }
  if (!adminStore.isAdmin) return
  editableSettings.value = {}
  await notifications.loadNotificationSettings(userId.value)
  if (notificationSettings.value) {
    editableSettings.value = { ...flattenedSettings.value }
  }
}

async function handleSaveSettings() {
  if (!userId.value) return
  try {
    const merged = { ...flattenedSettings.value, ...editableSettings.value }
    const success = await notifications.saveNotificationSettings(userId.value, merged)
    if (success) {
      showFeedback(t('admin.notifications.saveSuccess'), 'success')
    }
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.notifications.saveFailed'), 'error')
  }
}

async function handleLoadPushers() {
  if (!pusherUserId.value) {
    showFeedback(t('admin.notifications.userIdRequired'), 'error')
    return
  }
  if (!adminStore.isAdmin) return
  await notifications.loadPushers(pusherUserId.value)
}

async function handleDeletePusher(pusher: Record<string, unknown>) {
  if (!pusherUserId.value) return
  try {
    await notifications.deletePusher(pusherUserId.value, pusher.pushkey as string, (pusher.app_id as string) || '')
    showFeedback(t('admin.notifications.deletePusherSuccess'), 'success')
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.notifications.deletePusherFailed'), 'error')
  }
}
</script>

<style scoped lang="scss">
.admin-notifications {
  max-width: 1200px;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--n-color-modal);
}

.settings-label {
  font-size: 13px;
  color: var(--n-text-color-2);
  margin-right: 12px;
  word-break: break-all;
}

.settings-value {
  font-size: 13px;
  color: var(--n-text-color);
}

@media (max-width: 768px) {
  .tab-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
