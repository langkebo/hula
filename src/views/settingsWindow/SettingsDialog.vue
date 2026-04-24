<template>
  <div class="settings-dialog">
    <SettingsTabNav :tabs="filteredTabs" :active-tab="activeTab" @change="handleTabChange" />
    <div class="settings-main">
      <div class="settings-header">
        <h2 class="settings-title">{{ currentTab?.label || '设置' }}</h2>
        <n-button quaternary circle size="small" @click="handleClose">
          <template #icon>
            <n-icon :size="20">
              <Icon icon="mdi:close" />
            </n-icon>
          </template>
        </n-button>
      </div>
      <div class="settings-content">
        <component :is="currentTabComponent" :key="activeTab" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, type Component } from 'vue'
import { NButton, NIcon } from 'naive-ui'
import { Icon } from '@iconify/vue'
import SettingsTabNav from './SettingsTabNav.vue'
import { useSettingsDialogStore, SETTINGS_TABS, type SettingsTabType } from '@/stores/domains/settings/settingsDialog'
import { usePlatform } from '@/composables/usePlatform'

defineOptions({
  name: 'SettingsDialog'
})

const settingsDialogStore = useSettingsDialogStore()
const { isDesktop } = usePlatform()

const activeTab = computed(() => settingsDialogStore.activeTab)
const currentTab = computed(() => {
  return SETTINGS_TABS.find((tab) => tab.id === activeTab.value)
})

const filteredTabs = computed(() => {
  return SETTINGS_TABS.filter((tab) => {
    if (tab.desktopOnly && !isDesktop) return false
    return true
  })
})

const tabComponentMap: Record<SettingsTabType, () => Promise<Component>> = {
  account: () => import('./tabs/AccountSettings.vue'),
  sessions: () => import('./tabs/SessionSettings.vue'),
  appearance: () => import('./tabs/AppearanceSettings.vue'),
  notifications: () => import('./tabs/NotificationSettings.vue'),
  push: () => import('./tabs/PushSettings.vue'),
  voiceVideo: () => import('./tabs/VoiceVideoSettings.vue'),
  integrations: () => import('./tabs/IntegrationsSettings.vue'),
  preferences: () => import('./tabs/PreferencesSettings.vue'),
  keyboard: () => import('./tabs/KeyboardSettings.vue'),
  sidebar: () => import('./tabs/SidebarSettings.vue'),
  security: () => import('./tabs/SecuritySettings.vue'),
  encryption: () => import('./tabs/EncryptionSettings.vue'),
  labs: () => import('./tabs/LabsSettings.vue'),
  mjolnir: () => import('./tabs/MjolnirSettings.vue'),
  friends: () => import('./tabs/FriendsSettings.vue'),
  burnAfterRead: () => import('./tabs/BurnAfterReadSettings.vue'),
  help: () => import('./tabs/HelpSettings.vue')
}

const currentTabComponent = computed(() => {
  const loader = tabComponentMap[activeTab.value]
  return defineAsyncComponent(loader)
})

function handleTabChange(tabId: SettingsTabType) {
  settingsDialogStore.setActiveTab(tabId)
}

function handleClose() {
  settingsDialogStore.closeDialog()
}
</script>

<style scoped>
.settings-dialog {
  display: flex;
  height: 100%;
  background-color: var(--bg-color, #fff);
  border-radius: 8px;
  overflow: hidden;
}

:deep(.dark) .settings-dialog {
  background-color: #1a1a1a;
}

.settings-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--n-border-color, #e0e0e0);
}

:deep(.dark) .settings-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.settings-title {
  font-size: 18px;
  font-weight: 500;
  margin: 0;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>
