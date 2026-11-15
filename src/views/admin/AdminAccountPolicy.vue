<template>
  <div class="admin-account-policy">
    <n-alert :bordered="false" type="info">{{ t('admin.accountPolicy.hint') }}</n-alert>

    <n-tabs v-model:value="activeTab" type="line" animated class="tabs">
      <n-tab-pane name="validity" :tab="t('admin.accountPolicy.tabs.validity')">
        <AccountValidityPanel />
      </n-tab-pane>
      <n-tab-pane name="providers" :tab="t('admin.accountPolicy.tabs.providers')">
        <PasswordProviderPanel />
      </n-tab-pane>
      <n-tab-pane name="policy" :tab="t('admin.accountPolicy.tabs.policy')">
        <PolicyServerPanel />
      </n-tab-pane>
      <n-tab-pane name="rate-limit" :tab="t('admin.accountPolicy.tabs.rateLimit')">
        <RateLimitPanel />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NTabPane, NTabs } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AccountValidityPanel from './accountPolicy/AccountValidityPanel.vue'
import PasswordProviderPanel from './accountPolicy/PasswordProviderPanel.vue'
import PolicyServerPanel from './accountPolicy/PolicyServerPanel.vue'
import RateLimitPanel from './accountPolicy/RateLimitPanel.vue'

defineOptions({ name: 'AdminAccountPolicy' })

const { t } = useI18n()
const activeTab = ref('validity')
</script>

<style scoped>
.admin-account-policy {
  max-width: 1200px;
}

.tabs {
  margin-top: 16px;
}
</style>
