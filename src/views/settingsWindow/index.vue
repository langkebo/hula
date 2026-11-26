<template>
  <div class="settings-window-page">
    <ActionBar :shrink="false" class="shrink-0" />
    <div class="settings-window-content">
      <SettingsPage />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  normalizeSettingsTab,
  type SettingsTabInput,
  useSettingsTabStore
} from '../../stores/domains/settings/settingsTab'
import SettingsPage from './SettingsPage.vue'

defineOptions({
  name: 'SettingsWindowPage'
})

const route = useRoute()
const settingsTabStore = useSettingsTabStore()

function syncRouteTab() {
  const tab = typeof route.query.tab === 'string' ? (route.query.tab as SettingsTabInput) : undefined
  settingsTabStore.setActiveTab(normalizeSettingsTab(tab) ?? 'account')
}

onMounted(syncRouteTab)

watch(() => route.query.tab, syncRouteTab)
</script>

<style scoped>
.settings-window-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--tjg-surface-app);
  box-sizing: border-box;
}

.settings-window-content {
  flex: 1;
  min-height: 0;
}
</style>
