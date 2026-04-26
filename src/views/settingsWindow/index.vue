<template>
  <div class="settings-window-page">
    <SettingsDialog standalone />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import SettingsDialog from './SettingsDialog.vue'
import {
  normalizeSettingsTab,
  useSettingsDialogStore,
  type SettingsTabInput
} from '../../stores/domains/settings/settingsDialog'

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
  background: var(--bg-color, #fff);
}
</style>
