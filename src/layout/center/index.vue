<template>
  <main
    ref="centerEl"
    data-tauri-drag-region
    id="center"
    :class="{ 'rounded-r-8px': isShrink }"
    class="resizable select-none flex flex-col border-r-(1px solid [--hula-border-layout-divider])"
    :style="centerStyle">
    <!-- 分隔条（shrink 模式下隐藏） -->
    <div v-show="!isShrink" class="resize-handle" style="touch-action: none">
      <div class="drag-icon opacity-0 transition-all duration-600 ease-in-out">
        <div
          style="border-radius: 8px 0 0 8px"
          class="h-60px w-14px absolute top-50% -translate-y-1/2 right-0 drag-icon bg-[--hula-surface-sidebar-selected]">
          <svg class="size-16px absolute top-1/2 right--2px transform -translate-y-1/2 color-[--hula-text-tertiary]">
            <use href="#sliding"></use>
          </svg>
        </div>
      </div>
    </div>

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
import { useResponsiveBreakpoint } from '@/composables/layout/useResponsiveBreakpoint'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { hasTauriRuntime } from '@/utils/AppHarness'

const settingStore = useSettingStore()
const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const centerEl = shallowRef<HTMLElement | null>(null)

// Step 2.3：响应式断点派生中间栏宽度与收缩状态
const { centerWidth, isShrink } = useResponsiveBreakpoint()

// 中间栏样式：shrink 模式下 flex 自适应，否则按断点宽度
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
    width: `${centerWidth.value}px`,
    minWidth: `${centerWidth.value}px`,
    maxWidth: `${centerWidth.value}px`
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
