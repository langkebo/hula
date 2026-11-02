<template>
  <aside
    class="settings-sidebar"
    role="navigation"
    :aria-label="t('setting.dialog.nav_aria_label')"
    :aria-busy="!capabilitiesLoaded">
    <div class="settings-sidebar-search">
      <n-input
        v-model:value="searchQuery"
        clearable
        :disabled="!capabilitiesLoaded"
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

    <div class="settings-sidebar-groups">
      <div v-if="!capabilitiesLoaded" class="settings-sidebar-skeleton" data-testid="settings-sidebar-skeleton">
        <div v-for="group in skeletonGroups" :key="group" class="settings-sidebar-skeleton-group">
          <SkeletonBase width="42%" height="10px" compact />
          <div class="settings-sidebar-skeleton-items">
            <div
              v-for="(item, index) in skeletonItems"
              :key="`${group}-${index}`"
              class="settings-sidebar-skeleton-item">
              <SkeletonBase variant="rect" width="24px" height="18px" />
              <SkeletonBase :width="item.width" height="12px" />
            </div>
          </div>
        </div>
      </div>
      <div v-else-if="hasSearchQuery && searchResults.length > 0" class="settings-search-results" role="list">
        <button
          v-for="result in searchResults"
          :key="`${result.tabId}-${result.anchorId ?? 'tab'}`"
          type="button"
          class="settings-search-result"
          :class="{
            'settings-search-result-active': result.tabId === activeTab,
            'settings-search-result-unsupported': !result.available
          }"
          :aria-disabled="!result.available"
          @click="$emit('select-result', result)">
          <span class="settings-search-result-path">
            <template v-for="(segment, index) in result.path" :key="`${index}-${segment}`">
              <span v-if="index > 0" class="settings-search-result-separator" aria-hidden="true">›</span>
              <span :class="{ 'settings-search-result-leaf': index === result.path.length - 1 }">{{ segment }}</span>
            </template>
          </span>
          <span v-if="!result.available" class="settings-search-result-badge">
            {{ t('setting.dialog.search_result_unavailable_badge') }}
          </span>
        </button>
      </div>
      <div v-else-if="!hasSearchQuery && groupedTabs.length > 0" role="tablist">
        <div v-for="grp in groupedTabs" :key="grp.group" class="settings-tab-group">
          <div class="settings-tab-group-title">{{ grp.label }}</div>
          <button
            v-for="tab in grp.tabs"
            :id="`settings-tab-${tab.id}`"
            :key="tab.id"
            type="button"
            class="settings-tab-item"
            :class="{ 'settings-tab-item-active': tab.id === activeTab }"
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
      </div>
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
import SkeletonBase from '@/components/common/SkeletonBase.vue'
import type { SettingsSearchResult } from '@/composables/settings/settingsSearchIndex'
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
  searchResults?: SettingsSearchResult[]
  activeTab: SettingsTabType
  searchQuery: string
  contentId?: string
  capabilitiesLoaded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  searchResults: () => [],
  contentId: 'settings-tab-panel',
  capabilitiesLoaded: true
})

const emit = defineEmits<{
  (e: 'change', tabId: SettingsTabType): void
  (e: 'update:searchQuery', value: string): void
  (e: 'search-enter'): void
  (e: 'select-result', result: SettingsSearchResult): void
}>()

const { t } = useI18n()

const searchQuery = computed({
  get: () => props.searchQuery,
  set: (val: string) => emit('update:searchQuery', val)
})

const hasSearchQuery = computed(() => props.searchQuery.trim().length > 0)

// 能力未加载时的骨架占位：按固定分组模拟 Tab 列表，避免「先显示后隐藏」闪烁。
// 探测失败（isLoaded=true 但能力为空）不进入本分支 —— 由 capabilitiesLoaded=false 保证只在加载中停留。
const skeletonGroups = ['settings', 'preferences', 'tools'] as const
const skeletonItems = [{ width: '55%' }, { width: '45%' }, { width: '60%' }, { width: '40%' }] as const

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
@use '@/styles/scss/mixins/liquid-glass' as *;

.settings-sidebar {
  display: flex;
  flex-direction: column;
  width: var(--tjg-settings-sidebar-width, 260px);
  flex-shrink: 0;
  background: color-mix(in srgb, var(--tjg-surface-panel) 78%, var(--tjg-surface-subtle) 22%);
  border-right: 1px solid var(--tjg-border-default);
  overflow: hidden;

  /* 液态玻璃面板（阶段 2.2 — 首个应用场景） */
  @include liquid-glass-panel;

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

// 搜索结果：展示「设置 › 页签 › 分区」两级路径
.settings-search-results {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--tjg-space-1) 0;
}

.settings-search-result {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: calc(100% - var(--tjg-space-4));
  padding: var(--tjg-space-2) var(--tjg-space-3);
  margin: 0 var(--tjg-space-2);
  border: none;
  border-radius: var(--tjg-radius-sm);
  background: transparent;
  color: var(--tjg-text-secondary);
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: background-color var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard);
}

.settings-search-result:hover,
.settings-search-result:focus-visible {
  background-color: var(--tjg-surface-sidebar-hover);
  color: var(--tjg-text-primary);
  outline: none;
}

.settings-search-result-active {
  background-color: var(--tjg-color-primary-100);
  color: var(--tjg-color-primary-500);
}

.settings-search-result-unsupported {
  cursor: not-allowed;
  opacity: 0.72;
}

.settings-search-result-path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  font-size: var(--text-sm);
  line-height: var(--leading-snug);
}

.settings-search-result-separator {
  color: var(--tjg-text-quaternary);
}

.settings-search-result-leaf {
  font-weight: var(--font-medium);
}

.settings-search-result-badge {
  font-size: var(--text-xs);
  color: var(--tjg-color-warning-600);
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
.settings-sidebar-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
  padding: var(--tjg-space-2) var(--tjg-space-4);

  &-group,
  &-items {
    display: flex;
    flex-direction: column;
    gap: var(--tjg-space-2);
  }
  &-item {
    display: flex;
    align-items: center;
    gap: var(--tjg-space-2);
  }
}
</style>
