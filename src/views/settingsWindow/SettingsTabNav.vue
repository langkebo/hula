<template>
  <div class="settings-tab-nav" role="tablist" :aria-label="ariaLabel">
    <button
      v-for="tab in tabs"
      :id="getTabId(tab.id)"
      :key="tab.id"
      type="button"
      class="tab-item"
      :class="{ 'tab-item-active': tab.id === activeTab }"
      role="tab"
      :aria-selected="tab.id === activeTab"
      :aria-controls="contentId"
      :tabindex="tab.id === activeTab ? 0 : -1"
      @click="$emit('change', tab.id)"
      @keydown="handleKeydown($event, tab.id)">
      <span class="tab-icon">
        <Icon :icon="getIcon(tab.icon)" :width="18" />
      </span>
      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { SettingsTab, SettingsTabType } from '@/stores/domains/settings/settingsDialog'

defineOptions({
  name: 'SettingsTabNav'
})

interface Props {
  tabs: SettingsTab[]
  activeTab: SettingsTabType
  ariaLabel?: string
  contentId?: string
}

const props = withDefaults(defineProps<Props>(), {
  ariaLabel: '',
  contentId: 'settings-tab-panel'
})

const emit = defineEmits<(e: 'change', tabId: SettingsTabType) => void>()

const iconMap: Record<string, string> = {
  user: 'mdi:account',
  devices: 'mdi:devices',
  palette: 'mdi:palette',
  bell: 'mdi:bell',
  'bell-ring': 'mdi:bell-ring',
  settings: 'mdi:cog',
  keyboard: 'mdi:keyboard',
  sidebar: 'mdi:view-sidebar',
  shield: 'mdi:shield',
  key: 'mdi:key',
  flask: 'mdi:flask',
  'block-helper': 'mdi:block-helper',
  'account-group': 'mdi:account-group',
  'timer-outline': 'mdi:timer-outline',
  microphone: 'mdi:microphone',
  puzzle: 'mdi:puzzle',
  'help-circle': 'mdi:help-circle'
}

function getIcon(iconName: string): string {
  return iconMap[iconName] || 'mdi:cog'
}

function getTabId(tabId: SettingsTabType): string {
  return `settings-tab-${tabId}`
}

function handleKeydown(event: KeyboardEvent, tabId: SettingsTabType) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    return
  }

  event.preventDefault()

  const currentIndex = props.tabs.findIndex((tab) => tab.id === tabId)
  if (currentIndex === -1) return

  let nextIndex = currentIndex
  if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = props.tabs.length - 1
  } else {
    const direction = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1
    nextIndex = (currentIndex + direction + props.tabs.length) % props.tabs.length
  }

  const nextTab = props.tabs[nextIndex]
  if (!nextTab) return

  const nextButton = document.getElementById(getTabId(nextTab.id))
  nextButton?.focus()
  if (nextTab.id !== props.activeTab) {
    emit('change', nextTab.id)
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;

.settings-tab-nav {
  padding: var(--hula-space-2) 0;

  @include responsive.respond-to-max('md') {
    display: flex;
    gap: var(--hula-space-2);
    padding: var(--hula-space-2);
    min-width: max-content;
  }
}

.tab-item {
  display: flex;
  align-items: center;
  width: calc(100% - var(--hula-space-4));
  height: 40px;
  padding: 0 var(--hula-space-4);
  cursor: pointer;
  color: var(--hula-text-secondary);
  transition:
    background-color var(--hula-motion-duration-normal) var(--hula-motion-ease-standard),
    color var(--hula-motion-duration-normal) var(--hula-motion-ease-standard);
  border-radius: var(--hula-radius-sm);
  margin: 2px var(--hula-space-2);
  border: none;
  background: transparent;
  text-align: left;
  font: inherit;

  @include responsive.respond-to-max('md') {
    width: auto;
    min-width: max-content;
    margin: 0;
    padding: 0 var(--hula-space-4);
  }
}

.tab-item:hover,
.tab-item:focus-visible {
  background-color: var(--hula-surface-sidebar-hover);
  color: var(--hula-text-primary);
  outline: none;
}

.tab-item-active {
  background-color: var(--hula-color-primary-100);
  color: var(--hula-color-primary-500);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hula-color-primary-500) 10%, transparent);
}

.tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  margin-right: var(--hula-space-2);
}

.tab-label {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
}
</style>
