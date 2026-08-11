<template>
  <SkeletonSettings v-if="loading" />
  <div v-else class="settings-page" :class="{ 'settings-page-standalone': standalone }">
    <LeftNav v-if="!standalone" class="settings-page-left" />
    <SettingsSidebar
      :tabs="filteredTabs"
      :active-tab="activeTab"
      :search-query="searchQuery"
      :content-id="SETTINGS_CONTENT_ID"
      @change="handleTabChange"
      @update:search-query="searchQuery = $event"
      @search-enter="handleSearchEnter" />
    <SettingsContent
      :active-tab="activeTab"
      :has-dirty-tabs="hasDirtyTabs"
      :standalone="standalone"
      :content-id="SETTINGS_CONTENT_ID"
      @close="handleClose" />
  </div>
</template>

<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useDialog } from 'naive-ui'
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
import SettingsContent from './SettingsContent.vue'
import SettingsSidebar from './SettingsSidebar.vue'

defineOptions({
  name: 'SettingsPage'
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

const LeftNav = defineAsyncComponent(() => import('@/layout/left/index.vue'))

const settingsDialogStore = useSettingsDialogStore()
const { isDesktop } = usePlatform()
const { t, tm } = useI18n()
const router = useRouter()
const dialog = useDialog()
const SETTINGS_CONTENT_ID = 'settings-tab-panel'

const resolveSearchKeywords = (tabId: SettingsTabType): string[] => {
  const value = tm(`setting.dialog.search_terms.${tabId}`) as unknown
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

const { searchQuery, filteredTabs } = useSettingsShell({
  isDesktop,
  translate: t,
  resolveSearchKeywords
})

const activeTab = computed(() => settingsDialogStore.activeTab)

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

const hasDirtyTabs = computed(() => dirtyRegistry.hasDirtyTabs.value)

async function handleTabChange(tabId: SettingsTabType) {
  if (tabId === activeTab.value) return

  const canLeave = await dirtyRegistry.confirmIfNeeded({
    scope: 'switch',
    tabId: activeTab.value,
    currentTabLabel: getSettingsTabLabel(activeTab.value, t)
  })
  if (!canLeave) return

  settingsDialogStore.setActiveTab(tabId)
  router.replace({ path: '/settings', query: { tab: tabId } })
}

async function handleClose() {
  const canClose = await dirtyRegistry.confirmIfNeeded({
    scope: 'close',
    tabId: activeTab.value,
    currentTabLabel: getSettingsTabLabel(activeTab.value, t)
  })
  if (!canClose) return

  dirtyRegistry.clearDirtyTabs()
  if (props.standalone) {
    if (hasTauriRuntime()) {
      await WebviewWindow.getCurrent().close()
    } else {
      router.back()
    }
    return
  }
  router.push('/message')
}

async function handleSearchEnter() {
  const matchId = findFirstMatchingSettingsTab(searchQuery.value, isDesktop, t, resolveSearchKeywords)
  if (!matchId) return
  await handleTabChange(matchId)
}

function focusSettingsSearch() {
  const el = document.querySelector('.settings-sidebar-search input') as HTMLElement | null
  el?.focus()
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

.settings-page {
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--tjg-surface-app);
  color: var(--tjg-text-primary);

  @include responsive.respond-to-max('md') {
    flex-direction: column;
  }
}

.settings-page-left {
  flex-shrink: 0;
}

.settings-page-standalone {
  border: 1px solid var(--tjg-border-default);
  border-radius: var(--tjg-radius-lg);
  box-shadow: var(--tjg-shadow-border), var(--tjg-shadow-md);
  overflow: hidden;
}
</style>
