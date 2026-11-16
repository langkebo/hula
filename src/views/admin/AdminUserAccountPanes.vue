<template>
  <n-tab-pane name="accountInfo" :tab="t('admin.users.accountInfo')">
    <n-spin :show="accountInfoLoading">
      <n-space vertical>
        <n-alert :bordered="false" type="info">{{ t('admin.users.accountInfoHint') }}</n-alert>
        <n-input
          v-model:value="accountDisplayName"
          data-testid="admin-user-account-displayname"
          :placeholder="t('admin.users.displayName')" />
        <n-input
          v-model:value="accountAvatarUrl"
          data-testid="admin-user-account-avatar"
          :placeholder="t('admin.users.avatarUrl')" />
        <n-button
          data-testid="admin-user-account-save"
          size="small"
          type="primary"
          :loading="accountInfoSaving"
          :disabled="!selectedUser"
          @click="handleSaveAccountInfo">
          {{ t('admin.users.saveAccountInfo') }}
        </n-button>
        <n-collapse>
          <n-collapse-item :title="t('admin.users.rawJson')" name="raw">
            <pre class="raw-json">{{ accountInfoJson }}</pre>
          </n-collapse-item>
        </n-collapse>
      </n-space>
    </n-spin>
  </n-tab-pane>

  <n-tab-pane name="whois" :tab="t('admin.users.whois')">
    <n-space vertical>
      <n-button
        data-testid="admin-user-whois-load"
        size="small"
        :loading="whoisLoading"
        :disabled="!selectedUser"
        @click="handleLoadWhois">
        {{ t('admin.users.whoisLoad') }}
      </n-button>
      <pre v-if="whois" data-testid="admin-user-whois-result" class="raw-json">{{ whoisJson }}</pre>
      <n-empty v-else :description="t('admin.users.whoisEmpty')" size="small" />
    </n-space>
  </n-tab-pane>
</template>

<script setup lang="ts">
import { NAlert, NButton, NCollapse, NCollapseItem, NEmpty, NInput, NSpace, NSpin, NTabPane } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UseAdminUsersResult } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAdminErrorHandler } from './useAdminError'

const props = defineProps<{
  /** 父级持有的用户管理 composable 实例；本组件不自行创建，避免状态分叉。 */
  admin: UseAdminUsersResult
  /** 父级 Tabs 当前激活项，用于 whois 首次进入时自动加载。 */
  activeTab: string
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { handleAdminError } = useAdminErrorHandler()
const { accountInfo, accountInfoLoading, accountInfoSaving, whois, whoisLoading, selectedUser } = props.admin

const accountDisplayName = ref('')
const accountAvatarUrl = ref('')

const accountInfoJson = computed(() => (accountInfo.value ? JSON.stringify(accountInfo.value, null, 2) : '-'))
const whoisJson = computed(() => (whois.value ? JSON.stringify(whois.value, null, 2) : ''))

watch(
  accountInfo,
  (value) => {
    const record = value ?? {}
    accountDisplayName.value = typeof record.displayname === 'string' ? record.displayname : ''
    accountAvatarUrl.value = typeof record.avatar_url === 'string' ? record.avatar_url : ''
  },
  { immediate: true }
)

watch(
  () => props.activeTab,
  (name) => {
    if (name === 'whois' && !whois.value) void handleLoadWhois()
  }
)

async function handleLoadWhois(): Promise<void> {
  try {
    await props.admin.loadWhois()
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.users.whoisLoadFailed'), 'error')
  }
}

async function handleSaveAccountInfo(): Promise<void> {
  if (!selectedUser.value) return
  try {
    await props.admin.updateAccountInfo({
      displayname: accountDisplayName.value.trim(),
      avatar_url: accountAvatarUrl.value.trim()
    })
    showFeedback(t('admin.users.accountInfoSaved'), 'success')
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.users.accountInfoSaveFailed'), 'error')
  }
}
</script>

<style scoped lang="scss">
.raw-json {
  max-height: 320px;
  margin: 0;
  overflow: auto;
  font-size: 12px;
  line-height: 1.5;
  color: var(--tjg-text-secondary);
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
