<template>
  <aside class="settings-sidebar" role="navigation" :aria-label="t('setting.dialog.nav_aria_label')">
    <div class="settings-sidebar-search">
      <n-input
        v-model:value="searchQuery"
        clearable
        :placeholder="t('setting.dialog.search_placeholder')"
        :aria-label="t('setting.dialog.search_aria_label')"
        size="small"
        @keydown.enter="$emit('search-enter')">
        <template #prefix>
          <n-icon :size="16">
            <Icon icon="mdi:magnify" />
          </n-icon>
        </template>
      </n-input>
    </div>

    <div class="settings-sidebar-groups" role="tablist">
      <template v-if="groupedTabs.length > 0">
        <div v-for="grp in groupedTabs" :key="grp.group" class="settings-tab-group">
          <div class="settings-tab-group-title">{{ grp.label }}</div>
          <button
            v-for="tab in grp.tabs"
            :id="`settings-tab-${tab.id}`"
            :key="tab.id"
            type="button"
            class="settings-tab-item"
            :class="{
              'settings-tab-item-active': tab.id === activeTab,
              'settings-tab-item-hit': hasSearchQuery && tab.id !== activeTab
            }"
            role="tab"
            :aria-selected="tab.id === activeTab"
            :aria-controls="contentId"
            :tabindex="tab.id === activeTab ? 0 : -1"
            @click="$emit('change', tab.id)"
            @keydown="handleKeydown($event, tab.id)">
            <span class="settings-tab-icon">
              <Icon :icon="getIcon(tab.icon)" :width="18" />
            </span>
            <span class="settings-tab-label">{{ tab.label }}</span>
          </button>
        </div>
      </template>
      <EmptyState
        v-else
        illustration="no-results"
        compact
        :title="t('setting.dialog.nav_empty')"
        :description="t('setting.dialog.nav_empty_desc')"
        :action-text="t('setting.dialog.nav_clear_search')"
        @action="clearSearch" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NIcon, NInput } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import {
  getGroupedSettingsTabs,
  getSettingsTabGroupLabel,
  type SettingsTab,
  type SettingsTabGroup,
  type SettingsTabType
} from '@/stores/domains/settings/settingsTab'

defineOptions({
  name: 'SettingsSidebar'
})

interface Props {
  tabs: SettingsTab[]
  activeTab: SettingsTabType
  searchQuery: string
  contentId?: string
}

const props = withDefaults(defineProps<Props>(), {
  contentId: 'settings-tab-panel'
})

const emit = defineEmits<{
  (e: 'change', tabId: SettingsTabType): void
  (e: 'update:searchQuery', value: string): void
  (e: 'search-enter'): void
}>()

const { t } = useI18n()

const searchQuery = computed({
  get: () => props.searchQuery,
  set: (val: string) => emit('update:searchQuery', val)
})

const hasSearchQuery = computed(() => props.searchQuery.trim().length > 0)

const groupedTabs = computed(() => {
  const grouped = getGroupedSettingsTabs(props.tabs)
  return grouped.map((g) => ({
    ...g,
    label: getSettingsTabGroupLabel(g.group as SettingsTabGroup, t)
  }))
})

function clearSearch() {
  emit('update:searchQuery', '')
}

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
  robot: 'mdi:robot',
  'help-circle': 'mdi:help-circle'
}

function getIcon(iconName: string): string {
  return iconMap[iconName] || 'mdi:cog'
}

function handleKeydown(event: KeyboardEvent, tabId: SettingsTabType) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
    return
  }
  event.preventDefault()

  const allTabs = props.tabs
  const currentIndex = allTabs.findIndex((tab) => tab.id === tabId)
  if (currentIndex === -1) return

  let nextIndex = currentIndex
  if (event.key === 'Home') {
    nextIndex = 0
  } else if (event.key === 'End') {
    nextIndex = allTabs.length - 1
  } else {
    const direction = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1
    nextIndex = (currentIndex + direction + allTabs.length) % allTabs.length
  }

  const nextTab = allTabs[nextIndex]
  if (!nextTab) return

  const nextButton = document.getElementById(`settings-tab-${nextTab.id}`)
  nextButton?.focus()
  if (nextTab.id !== props.activeTab) {
    emit('change', nextTab.id)
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;

.settings-sidebar {
  display: flex;
  flex-direction: column;
  width: var(--tjg-settings-sidebar-width, 260px);
  flex-shrink: 0;
  background: color-mix(in srgb, var(--tjg-surface-panel) 78%, var(--tjg-surface-subtle) 22%);
  border-right: 1px solid var(--tjg-border-default);
  overflow: hidden;

  @include responsive.respond-to-max('md') {
    width: 100%;
    max-width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--tjg-border-default);
  }
}

.settings-sidebar-search {
  padding: var(--tjg-space-3) var(--tjg-space-3);
  border-bottom: 1px solid var(--tjg-border-default);
}

.settings-sidebar-groups {
  flex: 1;
  // 滚动容器必须 min-height: 0，否则标签项多时会把侧边栏撑高溢出，
  // 触发与内容栏的堆叠/重叠。
  min-height: 0;
  overflow-y: auto;
  padding: var(--tjg-space-2) 0;
}

.settings-tab-group {
  margin-bottom: var(--tjg-space-2);
}

.settings-tab-group-title {
  padding: var(--tjg-space-2) var(--tjg-space-4);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  color: var(--tjg-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.settings-tab-item {
  display: flex;
  align-items: center;
  width: calc(100% - var(--tjg-space-4));
  height: 36px;
  padding: 0 var(--tjg-space-4);
  cursor: pointer;
  color: var(--tjg-text-secondary);
  transition:
    background-color var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard),
    color var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard),
    box-shadow var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard);
  border-radius: var(--tjg-radius-sm);
  margin: 2px var(--tjg-space-2);
  border: none;
  background: transparent;
  text-align: left;
  font: inherit;
}

.settings-tab-item:hover,
.settings-tab-item:focus-visible {
  background-color: var(--tjg-surface-sidebar-hover);
  color: var(--tjg-text-primary);
  outline: none;
}

.settings-tab-item-active {
  background-color: var(--tjg-color-primary-100);
  color: var(--tjg-color-primary-500);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tjg-color-primary-500) 10%, transparent);
}

// 搜索命中高亮：非选中态的命中项用浅色背景 + 左侧强调条标识
.settings-tab-item-hit {
  background-color: color-mix(in srgb, var(--tjg-color-primary-500) 6%, transparent);
  box-shadow: inset 2px 0 0 var(--tjg-color-primary-500);
  color: var(--tjg-text-primary);
}

.settings-tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  margin-right: var(--tjg-space-2);
}

.settings-tab-label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
}
</style>
