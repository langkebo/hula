<template>
  <main
    ref="centerEl"
    data-tauri-drag-region
    id="center"
    :class="{ 'rounded-r-8px': isShrink }"
    class="resizable select-none flex flex-col min-h-0"
    style="background: var(--hula-bg-deep); border-right: 1px solid #000"
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

const settingStore = useSettingStore()
const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const centerEl = shallowRef<HTMLElement | null>(null)

// Step 2.3：响应式断点派生收缩状态；非 shrink 模式宽度由 store 持久化
const { isShrink } = useResponsiveBreakpoint()

// 中间栏样式：shrink 模式下 flex 自适应，否则固定 300px
const centerStyle = computed(() => {
  if (isShrink.value) {
    return {
      flex: '1 1 auto',
      width: '64px',
      minWidth: '0',
      maxWidth: '64px'
    }
  }
  return {
    flex: '0 0 auto',
    width: '300px',
    minWidth: '300px',
    maxWidth: '300px'
  }
})

onMounted(() => {
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

<style scoped lang="scss">
@use 'style';
</style>
