<template>
  <main class="settings-content-wrapper">
    <header class="settings-content-header">
      <div class="settings-content-header-main">
        <h2 class="settings-content-title">{{ currentTabLabel }}</h2>
        <div v-if="hasDirtyTabs" class="settings-dirty-status" role="status" aria-live="polite">
          {{ t('setting.dialog.dirty_status') }}
        </div>
      </div>
      <n-button
        v-if="standalone"
        circle
        :aria-label="t('setting.dialog.close_aria_label')"
        class="settings-close-btn"
        @click="$emit('close')">
        <template #icon>
          <n-icon :size="20">
            <Icon icon="mdi:close" />
          </n-icon>
        </template>
      </n-button>
    </header>
    <div
      :id="contentId"
      class="settings-content-body"
      role="tabpanel"
      tabindex="0"
      :aria-label="t('setting.dialog.content_aria_label', { label: currentTabLabel })"
      :aria-labelledby="`settings-tab-${activeTab}`">
      <component :is="currentTabComponent" :key="activeTab" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NIcon } from 'naive-ui'
import type { Component } from 'vue'
import { computed, defineAsyncComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { getSettingsTabLabel, type SettingsTabType } from '@/stores/domains/settings/settingsTab'
import { SETTINGS_TAB_COMPONENT_LOADERS } from './tabComponentLoaders'

defineOptions({
  name: 'SettingsContent'
})

interface Props {
  activeTab: SettingsTabType
  hasDirtyTabs?: boolean
  standalone?: boolean
  contentId?: string
}

const props = withDefaults(defineProps<Props>(), {
  hasDirtyTabs: false,
  standalone: false,
  contentId: 'settings-tab-panel'
})

defineEmits<(e: 'close') => void>()

const { t } = useI18n()

const currentTabLabel = computed(() => getSettingsTabLabel(props.activeTab, t) || t('setting.dialog.current_tab'))

const currentTabComponent = computed(() => {
  const loader = SETTINGS_TAB_COMPONENT_LOADERS[props.activeTab]
  return defineAsyncComponent(loader as () => Promise<Component>)
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;

.settings-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  // 关键：flex 列容器必须约束最小高度，避免内容超高时把 header/body 撑破
  // 并与其他栏位发生重叠（组件堆叠）。
  min-height: 0;
}

.settings-content-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-4);
  min-height: var(--tjg-settings-header-height, 56px);
  padding: var(--tjg-space-4) var(--tjg-space-5);
  background: color-mix(in srgb, var(--tjg-surface-panel) 88%, transparent);
  border-bottom: 1px solid var(--tjg-border-default);
}

.settings-content-header-main {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
  min-width: 0;
  flex: 1;
}

.settings-content-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  margin: 0;
}

.settings-dirty-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  font-size: var(--text-sm);
  color: var(--tjg-color-warning-600);
  background: var(--tjg-color-warning-100);
  border: 1px solid color-mix(in srgb, var(--tjg-color-warning-500) 20%, transparent);
  border-radius: var(--tjg-radius-full);
  padding: 4px 10px;
}

.settings-close-btn {
  flex-shrink: 0;
  color: var(--tjg-text-secondary);
  background-color: var(--tjg-surface-subtle);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.settings-close-btn:hover {
  color: var(--tjg-text-primary);
  background-color: var(--tjg-surface-sidebar-hover);
}

.settings-content-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--tjg-space-5);
  background: var(--tjg-surface-panel);

  @include responsive.respond-to-max('md') {
    padding: var(--tjg-space-4);
  }
}
</style>
