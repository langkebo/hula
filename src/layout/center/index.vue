<template>
  <main
    ref="centerEl"
    data-tauri-drag-region
    id="center"
    :class="{ 'rounded-r-8px': isShrink }"
    class="resizable select-none flex flex-col min-h-0"
    style="background: var(--hula-bg-deep); border-right: 1px solid var(--hula-border-layout-divider)"
    :style="centerStyle">
    <!-- 分隔条（shrink 模式下隐藏） -->
    <PanelResizeHandle v-show="!isShrink" side="left" style="touch-action: none" />

    <ActionBar
      class="absolute right-0 w-full"
      v-show="isShrink"
      :shrink-status="!isShrink"
      :max-w="false"
      :current-label="appWindow?.label" />

    <!-- Center panel header -->
    <div class="list-header">
      <h2>{{ title }}</h2>
      <div class="list-actions">
        <div class="icon-btn">
          <svg><use href="#i-plus" /></svg>
        </div>
        <div class="icon-btn">
          <svg><use href="#i-more" /></svg>
        </div>
      </div>
    </div>

    <!-- Space shortcuts -->
    <div class="space-shortcuts">
      <div v-for="space in spaces" :key="space.id" class="space-shortcut" :title="space.name">
        <svg><use :href="space.icon" /></svg>
      </div>
      <div class="space-shortcut add">
        <svg><use href="#i-plus" /></svg>
      </div>
    </div>

    <!-- Session filter tabs -->
    <div class="session-filter">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="session-filter-tab"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key">
        {{ tab.label }}
        <span v-if="tab.badge" class="filter-badge show">{{ tab.badge }}</span>
      </button>
    </div>

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

// Center panel structural data
const title = ref('消息')
const activeTab = ref('all')
const tabs = ref([
  { key: 'all', label: '全部', badge: 0 },
  { key: 'unread', label: '未读', badge: 3 },
  { key: 'mentions', label: '提及', badge: 0 },
  { key: 'spaces', label: '空间', badge: 0 }
])
const spaces = ref([
  { id: '1', name: '工作空间', icon: '#i-work' },
  { id: '2', name: '家庭', icon: '#i-home' }
])

const props = defineProps<{
  shrinkStatus?: boolean
}>()

// Step 2.3：响应式断点派生收缩状态；非 shrink 模式宽度由 store 持久化
const { isShrink: responsiveShrink } = useResponsiveBreakpoint()

// 使用 prop 传入的 shrinkStatus（如果有），否则使用响应式的
const isShrink = computed(() => props.shrinkStatus ?? responsiveShrink.value)

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
