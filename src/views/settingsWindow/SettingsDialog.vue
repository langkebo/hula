<template>
  <div v-if="visible" class="settings-dialog">
    <div class="settings-sidebar">
      <SettingsTabNav
        v-if="filteredTabs.length > 0"
        :tabs="filteredTabs"
        :active-tab="activeTab"
        :aria-label="t('setting.dialog.nav_aria_label')"
        :content-id="SETTINGS_CONTENT_ID"
        @change="handleTabChange" />
      <div v-else class="settings-nav-empty">{{ t('setting.dialog.nav_empty') }}</div>
    </div>
    <div class="settings-main">
      <div class="settings-header">
        <div class="settings-header-main">
          <h2 class="settings-title">{{ currentTabLabel || t('setting.dialog.title') }}</h2>
          <div v-if="hasDirtyTabs" class="settings-status" role="status" aria-live="polite">
            {{ t('setting.dialog.dirty_status') }}
          </div>
          <n-input
            v-model:value="searchQuery"
            clearable
            :placeholder="t('setting.dialog.search_placeholder')"
            :aria-label="t('setting.dialog.search_aria_label')"
            size="small"
            class="settings-search">
            <template #prefix>
              <n-icon :size="16">
                <Icon icon="mdi:magnify" />
              </n-icon>
            </template>
          </n-input>
        </div>
        <n-button
          quaternary
          circle
          size="small"
          :aria-label="t('setting.dialog.close_aria_label')"
          @click="handleClose">
          <template #icon>
            <n-icon :size="20">
              <Icon icon="mdi:close" />
            </n-icon>
          </template>
        </n-button>
      </div>
      <div
        :id="SETTINGS_CONTENT_ID"
        class="settings-content"
        role="tabpanel"
        tabindex="0"
        :aria-label="t('setting.dialog.content_aria_label', { label: currentTabLabel })"
        :aria-labelledby="currentTabId">
        <component :is="currentTabComponent" :key="activeTab" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { NButton, NIcon, NInput, useDialog } from 'naive-ui'
import { computed, defineAsyncComponent, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createSettingsDirtyRegistry,
  provideSettingsDirtyRegistry
} from '@/composables/settings/useSettingsDirtyRegistry'
import { useSettingsShell } from '@/composables/settings/useSettingsShell'
import { usePlatform } from '@/composables/usePlatform'
import {
  getSettingsTabLabel,
  type SettingsTabType,
  useSettingsDialogStore
} from '@/stores/domains/settings/settingsDialog'
import SettingsTabNav from './SettingsTabNav.vue'
import { SETTINGS_TAB_COMPONENT_LOADERS } from './tabComponentLoaders'

defineOptions({
  name: 'SettingsDialog'
})

const props = withDefaults(
  defineProps<{
    standalone?: boolean
  }>(),
  {
    standalone: false
  }
)

const settingsDialogStore = useSettingsDialogStore()
const { isDesktop } = usePlatform()
const { t, tm } = useI18n()
const resolveSearchKeywords = (tabId: SettingsTabType): string[] => {
  const value = tm(`setting.dialog.search_terms.${tabId}`)
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
const { searchQuery, filteredTabs } = useSettingsShell({
  isDesktop,
  translate: t,
  resolveSearchKeywords
})
const dialog = useDialog()
const SETTINGS_CONTENT_ID = 'settings-tab-panel'

const visible = computed(() => props.standalone || settingsDialogStore.isOpen)
const activeTab = computed(() => settingsDialogStore.activeTab)
const currentTabLabel = computed(() => getSettingsTabLabel(activeTab.value, t) || t('setting.dialog.current_tab'))
const currentTabId = computed(() => `settings-tab-${activeTab.value}`)

const dirtyRegistry = createSettingsDirtyRegistry(async ({ scope, currentTabLabel: label }) => {
  return await new Promise<boolean>((resolve) => {
    dialog.warning({
      title: scope === 'close' ? t('setting.dialog.close_title') : t('setting.dialog.switch_title'),
      content: t('setting.dialog.leave_content', {
        label: label || t('setting.dialog.current_tab')
      }),
      positiveText: t('setting.dialog.leave_confirm'),
      negativeText: t('setting.dialog.leave_cancel'),
      onPositiveClick: () => {
        resolve(true)
      },
      onNegativeClick: () => {
        resolve(false)
      },
      onClose: () => {
        resolve(false)
      }
    })
  })
})

provideSettingsDirtyRegistry(dirtyRegistry)

const currentTabComponent = computed(() => {
  const loader = SETTINGS_TAB_COMPONENT_LOADERS[activeTab.value]
  return defineAsyncComponent(loader)
})

const hasDirtyTabs = computed(() => dirtyRegistry.hasDirtyTabs.value)

async function handleTabChange(tabId: SettingsTabType) {
  if (tabId === activeTab.value) return

  const canLeave = await dirtyRegistry.confirmIfNeeded({
    scope: 'switch',
    tabId: activeTab.value,
    currentTabLabel: currentTabLabel.value
  })
  if (!canLeave) return

  settingsDialogStore.setActiveTab(tabId)
}

async function handleClose() {
  const canClose = await dirtyRegistry.confirmIfNeeded({
    scope: 'close',
    tabId: activeTab.value,
    currentTabLabel: currentTabLabel.value
  })
  if (!canClose) return

  dirtyRegistry.clearDirtyTabs()
  if (props.standalone) {
    await WebviewWindow.getCurrent().close()
    return
  }
  settingsDialogStore.closeDialog()
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasDirtyTabs.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>

<style scoped>
.settings-dialog {
  display: flex;
  height: 100%;
  color: var(--hula-text-primary);
  background: linear-gradient(180deg, var(--hula-surface-panel) 0%, var(--hula-surface-panel-muted) 100%);
  border: 1px solid var(--hula-border-default);
  border-radius: var(--hula-radius-lg);
  box-shadow: var(--hula-shadow-border), var(--hula-shadow-md);
  overflow: hidden;
}

.settings-sidebar {
  width: var(--hula-settings-sidebar-width);
  background: color-mix(in srgb, var(--hula-surface-panel) 78%, var(--hula-surface-subtle) 22%);
  border-right: 1px solid var(--hula-border-default);
  overflow-y: auto;
}

.settings-nav-empty {
  padding: var(--hula-space-5) var(--hula-space-4);
  color: var(--hula-text-tertiary);
  font-size: 13px;
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
  gap: var(--hula-space-4);
  min-height: var(--hula-settings-header-height);
  padding: var(--hula-space-4) var(--hula-space-5);
  background: color-mix(in srgb, var(--hula-surface-panel) 88%, transparent);
  border-bottom: 1px solid var(--hula-border-default);
}

.settings-header-main {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-3);
  min-width: 0;
  flex: 1;
}

.settings-title {
  font-size: var(--hula-font-size-xl);
  font-weight: var(--hula-font-weight-semibold);
  line-height: 1.4;
  margin: 0;
}

.settings-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  font-size: var(--hula-font-size-sm);
  color: var(--hula-color-warning-600);
  background: var(--hula-color-warning-100);
  border: 1px solid color-mix(in srgb, var(--hula-color-warning-500) 20%, transparent);
  border-radius: var(--hula-radius-full);
  padding: 4px 10px;
}

.settings-search {
  max-width: 320px;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--hula-space-5);
  background: var(--hula-surface-panel);
}
</style>
