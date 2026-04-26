<template>
  <div v-if="visible" class="settings-dialog">
    <div class="settings-sidebar">
      <SettingsTabNav
        v-if="filteredTabs.length > 0"
        :tabs="filteredTabs"
        :active-tab="activeTab"
        @change="handleTabChange" />
      <div v-else class="settings-nav-empty">未找到匹配的设置项</div>
    </div>
    <div class="settings-main">
      <div class="settings-header">
        <div class="settings-header-main">
          <h2 class="settings-title">{{ currentTab?.label || '设置' }}</h2>
          <div v-if="hasDirtyTabs" class="settings-status">有未保存的更改</div>
          <n-input v-model:value="searchQuery" clearable placeholder="搜索设置项" size="small" class="settings-search">
            <template #prefix>
              <n-icon :size="16">
                <Icon icon="mdi:magnify" />
              </n-icon>
            </template>
          </n-input>
        </div>
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
import { computed, defineAsyncComponent, onMounted, onUnmounted } from 'vue'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { NButton, NIcon, NInput, useDialog } from 'naive-ui'
import { Icon } from '@iconify/vue'
import SettingsTabNav from './SettingsTabNav.vue'
import { useSettingsDialogStore, SETTINGS_TABS, type SettingsTabType } from '@/stores/domains/settings/settingsDialog'
import { SETTINGS_TAB_COMPONENT_LOADERS } from './tabComponentLoaders'
import {
  createSettingsDirtyRegistry,
  provideSettingsDirtyRegistry
} from '@/composables/settings/useSettingsDirtyRegistry'
import { useSettingsShell } from '@/composables/settings/useSettingsShell'
import { usePlatform } from '@/composables/usePlatform'

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
const { searchQuery, filteredTabs } = useSettingsShell({ isDesktop })
const dialog = useDialog()

const visible = computed(() => props.standalone || settingsDialogStore.isOpen)
const activeTab = computed(() => settingsDialogStore.activeTab)
const currentTab = computed(() => {
  return SETTINGS_TABS.find((tab) => tab.id === activeTab.value)
})
const currentTabLabel = computed(() => currentTab.value?.label || '当前设置')

const dirtyRegistry = createSettingsDirtyRegistry(async ({ scope, currentTabLabel: label }) => {
  return await new Promise<boolean>((resolve) => {
    dialog.warning({
      title: scope === 'close' ? '关闭设置' : '切换设置项',
      content: `${label || '当前设置'}存在未保存的更改，继续后这些内容将会丢失。`,
      positiveText: '继续离开',
      negativeText: '继续编辑',
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
  background-color: var(--bg-color, #fff);
  border-radius: 8px;
  overflow: hidden;
}

:deep(.dark) .settings-dialog {
  background-color: #1a1a1a;
}

.settings-sidebar {
  width: 240px;
  border-right: 1px solid var(--n-border-color, #e0e0e0);
  overflow-y: auto;
}

:deep(.dark) .settings-sidebar {
  border-right-color: rgba(255, 255, 255, 0.1);
}

.settings-nav-empty {
  padding: 20px 16px;
  color: var(--n-text-color-3, #999);
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
  gap: 16px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--n-border-color, #e0e0e0);
}

:deep(.dark) .settings-header {
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.settings-header-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.settings-title {
  font-size: 18px;
  font-weight: 500;
  margin: 0;
}

.settings-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  font-size: 12px;
  color: #d46b08;
  background: rgba(250, 173, 20, 0.12);
  border-radius: 999px;
  padding: 4px 10px;
}

.settings-search {
  max-width: 320px;
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>
