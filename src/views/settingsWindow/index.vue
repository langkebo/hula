<template>
  <div class="settings-window-page">
    <SettingsPage :standalone="isStandalone" />
  </div>
</template>

<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { hasTauriRuntime } from '@/utils/AppHarness'
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

const isStandalone = ref(false)

function detectStandalone() {
  if (!hasTauriRuntime()) {
    isStandalone.value = false
    return
  }
  const label = WebviewWindow.getCurrent().label
  isStandalone.value = label === 'settings'
}

function syncRouteTab() {
  const tab = typeof route.query.tab === 'string' ? (route.query.tab as SettingsTabInput) : undefined
  const normalizedTab = normalizeSettingsTab(tab)
  settingsTabStore.setActiveTab(normalizedTab ?? 'account')
}

onMounted(() => {
  detectStandalone()
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
  box-sizing: border-box;
}
</style>
