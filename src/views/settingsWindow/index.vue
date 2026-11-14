<template>
  <div class="settings-window-page">
    <ActionBar :shrink="false" class="shrink-0" />
    <div class="settings-window-content">
      <SettingsPage :standalone="isStandalone" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

let unlistenNavigate: UnlistenFn | undefined

onMounted(async () => {
  detectStandalone()
  syncRouteTab()
  if (!isStandalone.value) return
  // 独立窗口已存在时，打开方通过事件同步 tab，避免复用旧窗口后停留在旧页面
  unlistenNavigate = await listen<{ tab?: SettingsTabInput }>('settings-window:navigate', (event) => {
    const normalizedTab = normalizeSettingsTab(event.payload?.tab)
    if (normalizedTab) {
      settingsTabStore.setActiveTab(normalizedTab)
    }
  })
})

onBeforeUnmount(() => {
  unlistenNavigate?.()
  unlistenNavigate = undefined
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
