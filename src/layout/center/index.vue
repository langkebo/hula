<template>
  <main
    ref="centerEl"
    data-tauri-drag-region
    id="center"
    :class="{ 'rounded-r-8px': isShrink }"
    class="resizable relative select-none flex flex-col border-r-(1px solid [--tjg-border-layout-divider])"
    :style="centerStyle">
    <!-- 分隔条（shrink 模式下隐藏） -->
    <PanelResizeHandle v-show="!isShrink" side="left" style="touch-action: none" />

    <ActionBar
      class="absolute right-0 w-full"
      v-show="isShrink"
      :shrink-status="!isShrink"
      :max-w="false"
      :current-label="appWindow?.label" />

    <!-- 列表 -->
    <div id="centerList" class="h-full" :class="{ 'shadow-inner': settingStore.pageShadowEnabled }">
      <router-view v-slot="{ Component }">
        <keep-alive :include="['message', 'friendsList']">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>
  </main>
</template>

<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import PanelResizeHandle from '@/components/common/PanelResizeHandle.vue'
import { useResponsiveBreakpoint } from '@/composables/layout/useResponsiveBreakpoint'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { hasTauriRuntime } from '@/utils/AppHarness'

const MIN_CENTER_WIDTH = 280
const MAX_CENTER_WIDTH = 400
const DEFAULT_CENTER_WIDTH = MIN_CENTER_WIDTH
const CENTER_WIDTH_STORAGE_KEY = 'tjg-center-panel-width'

function loadStoredWidth(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_CENTER_WIDTH
  const raw = localStorage.getItem(CENTER_WIDTH_STORAGE_KEY)
  if (!raw) return DEFAULT_CENTER_WIDTH
  const num = Number.parseInt(raw, 10)
  if (!Number.isFinite(num)) {
    localStorage.removeItem(CENTER_WIDTH_STORAGE_KEY)
    return DEFAULT_CENTER_WIDTH
  }
  // 旧值迁移：存储值低于新 MIN_CENTER_WIDTH 时清除并回退默认值
  if (num < MIN_CENTER_WIDTH) {
    localStorage.removeItem(CENTER_WIDTH_STORAGE_KEY)
    return DEFAULT_CENTER_WIDTH
  }
  return Math.min(MAX_CENTER_WIDTH, num)
}

const settingStore = useSettingStore()
const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const centerEl = shallowRef<HTMLElement | null>(null)

// Step 2.3：响应式断点派生收缩状态；非 shrink 模式宽度由 store 持久化
const { isShrink } = useResponsiveBreakpoint()

// 中间栏样式：shrink 模式下 flex 自适应，否则按 store 持久化的面板宽度
const centerStyle = computed(() => {
  if (isShrink.value) {
    return {
      flex: '1 1 auto',
      width: '64px',
      minWidth: '0',
      maxWidth: '64px'
    }
  }
  const w = settingStore.panelWidth.left
  return {
    flex: '0 0 auto',
    width: `${w}px`,
    minWidth: `${MIN_CENTER_WIDTH}px`,
    maxWidth: `${MAX_CENTER_WIDTH}px`
  }
})

onMounted(() => {
  // 迁移旧的中间栏宽度值（< MIN_CENTER_WIDTH 时重置为默认）
  const migrated = loadStoredWidth()
  if (migrated !== settingStore.panelWidth.left) {
    settingStore.setPanelWidth('left', migrated)
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CENTER_WIDTH_STORAGE_KEY, String(settingStore.panelWidth.left))
  }
  // 阶段 3：监听全局搜索快捷键 Ctrl+F，聚焦当前中间栏搜索框
  window.addEventListener('search:focus', focusActiveSearchInput)
})

// 阶段 3：聚焦当前可见的中间栏搜索输入框
const focusActiveSearchInput = () => {
  nextTick(() => {
    const center = centerEl.value ?? document.getElementById('center')
    // 优先聚焦搜索框 input，回退到任意 input
    const input =
      (center?.querySelector('[data-search-input]') as HTMLInputElement | null) ??
      (center?.querySelector('input[type="text"], input:not([type])') as HTMLInputElement | null)
    input?.focus()
    input?.select?.()
  })
}

onUnmounted(() => {
  // 阶段 3：移除搜索聚焦监听
  window.removeEventListener('search:focus', focusActiveSearchInput)
})
</script>
