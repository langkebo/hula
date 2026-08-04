<template>
  <SkeletonSettings v-if="loading" />
  <div v-else-if="visible" class="settings-dialog">
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
            class="settings-search"
            @keydown.enter="handleSearchEnter">
            <template #prefix>
              <n-icon :size="16">
                <Icon icon="mdi:magnify" />
              </n-icon>
            </template>
          </n-input>
        </div>
        <n-button
          circle
          :aria-label="t('setting.dialog.close_aria_label')"
          class="settings-close-btn"
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
import { useRouter } from 'vue-router'
import SkeletonSettings from '@/components/common/SkeletonSettings.vue'
import {
  createSettingsDirtyRegistry,
  provideSettingsDirtyRegistry
} from '@/composables/settings/useSettingsDirtyRegistry'
import { findFirstMatchingSettingsTab, useSettingsShell } from '@/composables/settings/useSettingsShell'
import { usePlatform } from '@/composables/usePlatform'
import {
  getSettingsTabLabel,
  type SettingsTabType,
  useSettingsDialogStore
} from '@/stores/domains/settings/settingsDialog'
import { hasTauriRuntime } from '@/utils/AppHarness'
import SettingsTabNav from './SettingsTabNav.vue'
import { SETTINGS_TAB_COMPONENT_LOADERS } from './tabComponentLoaders'

defineOptions({
  name: 'SettingsDialog'
})

const props = withDefaults(
  defineProps<{
    standalone?: boolean
    loading?: boolean
  }>(),
  {
    standalone: false,
    loading: false
  }
)

const settingsDialogStore = useSettingsDialogStore()
const { isDesktop } = usePlatform()
const { t, tm } = useI18n()
const router = useRouter()
const resolveSearchKeywords = (tabId: SettingsTabType): string[] => {
  const value = tm(`setting.dialog.search_terms.${tabId}`) as unknown
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
    if (hasTauriRuntime()) {
      await WebviewWindow.getCurrent().close()
    } else {
      // 浏览器 dev 模式下无法关闭窗口，回退到路由返回
      router.back()
    }
    return
  }
  settingsDialogStore.closeDialog()
}

async function handleSearchEnter() {
  const matchId = findFirstMatchingSettingsTab(searchQuery.value, isDesktop, t, resolveSearchKeywords)
  if (!matchId) return
  await handleTabChange(matchId)
}

function focusSettingsSearch() {
  const el = document.querySelector('.settings-search') as HTMLElement | null
  if (!el) return
  if (el.tagName === 'INPUT') {
    el.focus()
  } else {
    el.querySelector('input')?.focus()
  }
}

function handleShortcutKey(event: KeyboardEvent) {
  if (event.ctrlKey && event.key === ',') {
    event.preventDefault()
    focusSettingsSearch()
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasDirtyTabs.value) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('keydown', handleShortcutKey)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('keydown', handleShortcutKey)
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/responsive.scss' as responsive;

.settings-dialog {
  display: flex;
  height: 100%;
  min-height: 0;
  color: var(--tjg-text-primary);
  background: linear-gradient(180deg, var(--tjg-surface-panel) 0%, var(--tjg-surface-panel-muted) 100%);
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-lg);
  box-shadow: var(--tjg-shadow-border), var(--tjg-shadow-md);
  overflow: hidden;

  @include responsive.respond-to-max('md') {
    flex-direction: column;
  }
}

.settings-sidebar {
  width: var(--tjg-settings-sidebar-width);
  flex-shrink: 0;
  background: color-mix(in srgb, var(--tjg-surface-panel) 78%, var(--tjg-surface-subtle) 22%);
  border-right: 1px solid var(--tjg-border-default);
  overflow-y: auto;

  @include responsive.respond-to-max('md') {
    width: 100%;
    max-width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--tjg-border-default);
    overflow-x: auto;
    overflow-y: hidden;
  }
}

.settings-nav-empty {
  padding: var(--tjg-space-5) var(--tjg-space-4);
  color: var(--tjg-text-tertiary);
  font-size: var(--text-sm);
}

.settings-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.settings-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--tjg-space-4);
  min-height: var(--tjg-settings-header-height);
  padding: var(--tjg-space-4) var(--tjg-space-5);
  background: color-mix(in srgb, var(--tjg-surface-panel) 88%, transparent);
  border-bottom: 1px solid var(--tjg-border-default);
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

.settings-header-main {
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-3);
  min-width: 0;
  flex: 1;
}

.settings-title {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  line-height: var(--leading-snug);
  margin: 0;
}

.settings-status {
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

.settings-search {
  max-width: 320px;

  @include responsive.respond-to-max('md') {
    max-width: 100%;
  }
}

.settings-content {
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
