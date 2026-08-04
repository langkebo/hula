<template>
  <div class="settings-window-page">
    <SettingsDialog standalone />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  normalizeSettingsTab,
  type SettingsTabInput,
  useSettingsDialogStore
} from '../../stores/domains/settings/settingsDialog'
import SettingsDialog from './SettingsDialog.vue'

defineOptions({
  name: 'SettingsWindowPage'
})

const route = useRoute()
const settingsDialogStore = useSettingsDialogStore()

function syncRouteTab() {
  const tab = typeof route.query.tab === 'string' ? (route.query.tab as SettingsTabInput) : undefined
  const normalizedTab = normalizeSettingsTab(tab)
  settingsDialogStore.setActiveTab(normalizedTab ?? 'account')
}

onMounted(() => {
  syncRouteTab()
})

watch(
  () => route.query.tab,
  () => {
    syncRouteTab()
  }
)
</script>

<style scoped>
.settings-window-page {
  width: 100%;
  height: 100%;
  background: var(--tjg-surface-app);
  padding: var(--tjg-space-3);
  box-sizing: border-box;
}
</style>
