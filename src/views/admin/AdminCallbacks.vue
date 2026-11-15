<template>
  <div class="admin-callbacks">
    <n-alert :bordered="false" type="info">{{ t('admin.callbacks.hint') }}</n-alert>

    <n-tabs v-model:value="activeTab" type="line" animated class="tabs">
      <n-tab-pane name="media" :tab="t('admin.callbacks.tabs.media')">
        <MediaCallbacksPanel />
      </n-tab-pane>
      <n-tab-pane name="accountData" :tab="t('admin.callbacks.tabs.accountData')">
        <AccountDataCallbacksPanel />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NTabPane, NTabs } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AccountDataCallbacksPanel from './callbacks/AccountDataCallbacksPanel.vue'
import MediaCallbacksPanel from './callbacks/MediaCallbacksPanel.vue'

defineOptions({ name: 'AdminCallbacks' })

const { t } = useI18n()
const activeTab = ref<'media' | 'accountData'>('media')
</script>

<style scoped>
.admin-callbacks {
  max-width: 1200px;
}

.tabs {
  margin-top: 16px;
}
</style>
