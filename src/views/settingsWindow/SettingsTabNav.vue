<template>
  <div class="settings-tab-nav">
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="tab-item"
      :class="{ 'tab-item-active': tab.id === activeTab }"
      @click="$emit('change', tab.id)">
      <span class="tab-icon">
        <Icon :icon="getIcon(tab.icon)" :width="18" />
      </span>
      <span class="tab-label">{{ tab.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { SettingsTab, SettingsTabType } from '@/stores/settingsDialog'

defineOptions({
  name: 'SettingsTabNav'
})

interface Props {
  tabs: SettingsTab[]
  activeTab: SettingsTabType
}

defineProps<Props>()

defineEmits<(e: 'change', tabId: SettingsTabType) => void>()

const iconMap: Record<string, string> = {
  user: 'mdi:account',
  devices: 'mdi:devices',
  palette: 'mdi:palette',
  bell: 'mdi:bell',
  'bell-ring': 'mdi:bell-ring',
  settings: 'mdi:cog',
  keyboard: 'mdi:keyboard',
  shield: 'mdi:shield',
  key: 'mdi:key',
  'help-circle': 'mdi:help-circle'
}

function getIcon(iconName: string): string {
  return iconMap[iconName] || 'mdi:cog'
}
</script>

<style scoped>
.settings-tab-nav {
  padding: 8px 0;
}

.tab-item {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-radius: 4px;
  margin: 2px 8px;
}

.tab-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

:deep(.dark) .tab-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.tab-item-active {
  background-color: rgba(24, 144, 255, 0.1);
  color: #1890ff;
}

:deep(.dark) .tab-item-active {
  background-color: rgba(24, 144, 255, 0.2);
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  margin-right: 8px;
}

.tab-label {
  font-size: 14px;
}
</style>
