<template>
  <SkeletonSettings v-if="loading" />
  <div v-else-if="shellError" class="settings-page-error" role="alert" data-test="settings-shell-error">
    <n-icon size="22" color="var(--tjg-color-danger-500)">
      <svg><use href="#warning" /></svg>
    </n-icon>
    <p class="settings-page-error__title">{{ t('setting.dialog.shell_error_title') }}</p>
    <p class="settings-page-error__detail">{{ shellError.message }}</p>
    <n-button size="small" type="primary" @click="shellError = null">{{ t('setting.dialog.shell_retry') }}</n-button>
  </div>
  <div v-else class="settings-page" :class="{ 'settings-page-standalone': standalone }">
    <LeftNav v-if="!standalone" class="settings-page-left" />
    <SettingsSidebar
      :tabs="filteredTabs"
      :search-results="searchResults"
      :active-tab="activeTab"
      :search-query="searchQuery"
      :content-id="SETTINGS_CONTENT_ID"
      :capabilities-loaded="isCapabilityLoaded"
      @change="handleTabChange"
      @update:search-query="searchQuery = $event"
      @search-enter="handleSearchEnter"
      @select-result="handleSearchResultSelect" />
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
import { computed, defineAsyncComponent, nextTick, onErrorCaptured, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import SkeletonSettings from '@/components/common/SkeletonSettings.vue'
import { useWindowSessionReady } from '@/composables/common/useWindowSessionReady'
import { locateSettingsAnchor } from '@/composables/settings/settingsAnchorNavigation'
import { findSettingsSearchResults, type SettingsSearchResult } from '@/composables/settings/settingsSearchIndex'
import {
  createSettingsDirtyRegistry,
  provideSettingsDirtyRegistry
} from '@/composables/settings/useSettingsDirtyRegistry'
import { useSettingsShell } from '@/composables/settings/useSettingsShell'
import { usePlatform } from '@/composables/usePlatform'
import { SETTINGS_TABS } from '@/stores/domains/settings/settingsSchema'
import { getSettingsTabLabel, type SettingsTabType, useSettingsTabStore } from '@/stores/domains/settings/settingsTab'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import SettingsContent from './SettingsContent.vue'
import SettingsSidebar from './SettingsSidebar.vue'
import { SETTINGS_TAB_COMPONENT_LOADERS } from './tabComponentLoaders'

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

const settingsTabStore = useSettingsTabStore()
const { isDesktop } = usePlatform()
const { t, tm } = useI18n()
const router = useRouter()
const dialog = useDialog()
const SETTINGS_CONTENT_ID = 'settings-tab-panel'

// 窗口级会话入口：设置窗口是独立 Tauri WebView，各页签的 MatrixClient 需要先恢复。
// 这里在壳层挂载时**抢跑**一次（幂等，不 await 以免拖慢首帧），各页签随后调用
// `ensureSessionReady()` 只会 await 同一次 in-flight。
const { ensureSessionReady } = useWindowSessionReady()

// ── 页面级错误兜底 ──
// SettingsContent 内部已有 tab 级错误边界（onErrorCaptured 返回 false，错误不冒泡到此处）。
// 这里捕获壳层组件（LeftNav / SettingsSidebar，含异步加载失败）的渲染异常，
// 避免整页静默空白；提供重试入口。错误被吞掉后仍向全局 errorHandler 上报。
const shellError = ref<Error | null>(null)
const logger = createLogger('SettingsPage')

onErrorCaptured((err) => {
  shellError.value =
    err instanceof Error ? err : new Error(typeof err === 'string' ? err : t('setting.dialog.shell_error_default'))
  logger.error('[SettingsPage] Shell component render error:', err)
  // 返回 false：阻止继续冒泡，由本页 fallback 承接
  return false
})

const resolveSearchKeywords = (tabId: SettingsTabType): string[] => {
  const value = tm(`setting.dialog.search_terms.${tabId}`) as unknown
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

const { searchQuery, filteredTabs, isCapabilityLoaded, isTabAvailable } = useSettingsShell({
  isDesktop,
  translate: t,
  resolveSearchKeywords
})

const searchResults = computed(() =>
  findSettingsSearchResults(searchQuery.value, t, resolveSearchKeywords, isTabAvailable)
)

const activeTab = computed(() => settingsTabStore.activeTab)

// 能力探测完成后，若深链指向的页签在当前服务器不可用，回退到偏好设置并提示。
// 探测未完成（isCapabilityLoaded=false）时不做判断，避免登录初期误回退。
watch(
  [activeTab, isCapabilityLoaded],
  ([tabId, capabilityLoaded]) => {
    if (!capabilityLoaded) return
    const tab = SETTINGS_TABS.find((item) => item.id === tabId)
    if (!tab || isTabAvailable(tab)) return

    settingsTabStore.setActiveTab('preferences')
    router.replace({ path: '/settings', query: { tab: 'preferences' } })
    window.$message?.warning?.(t('setting.dialog.tab_unavailable', { tab: getSettingsTabLabel(tabId, t) }))
  },
  { immediate: true }
)

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

  settingsTabStore.setActiveTab(tabId)
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
  // 非独立窗口模式：优先返回上一页，无历史记录时回退到消息页
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/message')
  }
}

async function handleSearchResultSelect(result: SettingsSearchResult) {
  const tab = SETTINGS_TABS.find((item) => item.id === result.tabId)
  if (!tab || !isTabAvailable(tab)) {
    window.$message?.warning?.(
      t('setting.dialog.search_result_unavailable', { tab: getSettingsTabLabel(result.tabId, t) })
    )
    return
  }

  if (result.tabId !== activeTab.value) {
    // 先预取目标页签组件，避免切换后异步挂载尚未完成导致锚点两次查询全部落空
    try {
      await SETTINGS_TAB_COMPONENT_LOADERS[result.tabId]()
    } catch {
      logger.warn('[SettingsPage] failed to preload settings tab:', result.tabId)
    }
    await handleTabChange(result.tabId)
    // 用户取消离开（存在未保存更改）时不再定位锚点
    if (activeTab.value !== result.tabId) return
  }

  if (!result.anchorId) return

  await nextTick()
  if (!(await locateSettingsAnchor(result.anchorId))) {
    logger.warn('[SettingsPage] settings anchor missed twice, fallback to tab switch:', result.anchorId)
  }
}

async function handleSearchEnter() {
  const firstResult = searchResults.value[0]
  if (!firstResult) return
  await handleSearchResultSelect(firstResult)
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

// A-1: 路由守卫，LeftNav 导航离开设置页时确认未保存更改
onBeforeRouteLeave(async () => {
  if (!hasDirtyTabs.value) return true
  const canLeave = await dirtyRegistry.confirmIfNeeded({
    scope: 'close',
    tabId: activeTab.value,
    currentTabLabel: getSettingsTabLabel(activeTab.value, t)
  })
  if (canLeave) {
    dirtyRegistry.clearDirtyTabs()
  }
  return canLeave
})

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  window.addEventListener('keydown', handleShortcutKey)
  // 入口调用：尽早启动会话恢复，避免页签各自等到 10s/15s 超时才发现没人触发恢复。
  void ensureSessionReady()
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
  window.removeEventListener('keydown', handleShortcutKey)
})
</script>

<style scoped lang="scss">
.settings-page {
  display: flex;
  height: 100%;
  min-height: 0;
  background: var(--tjg-surface-app);
  color: var(--tjg-text-primary);
  // 设置页为桌面端专属路由，移动端使用 /mobile/mobileMy/... 独立栈式导航。
  // 不在窄屏下纵向堆叠三栏，避免破坏桌面端布局语义。
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

.settings-page-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--tjg-space-3);
  height: 100%;
  padding: var(--tjg-space-6);
  background: var(--tjg-surface-app);
  color: var(--tjg-text-primary);
  text-align: center;

  &__title {
    font-size: var(--tjg-font-size-lg);
    font-weight: 600;
  }

  &__detail {
    max-width: 480px;
    font-size: var(--tjg-font-size-sm);
    color: var(--tjg-text-secondary);
    word-break: break-all;
  }
}
</style>

<style lang="scss">
/* 搜索锚点：滚动定位时避开吸顶头部，并给出短暂高亮（见 UI 优化方案 §5.4） */
[data-settings-anchor] {
  scroll-margin-top: calc(var(--tjg-settings-header-height, 56px) + var(--tjg-space-3));
}

[data-settings-anchor].settings-anchor-highlight {
  outline: 2px solid var(--tjg-color-primary-500);
  outline-offset: 4px;
  border-radius: var(--tjg-radius-md);
}

@media (prefers-reduced-motion: no-preference) {
  [data-settings-anchor].settings-anchor-highlight {
    animation: settings-anchor-ring var(--tjg-motion-duration-normal) var(--tjg-motion-ease-standard);
  }
}

@keyframes settings-anchor-ring {
  from {
    outline-offset: 12px;
  }

  to {
    outline-offset: 4px;
  }
}
</style>
