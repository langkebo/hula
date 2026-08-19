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
      <!--
        嵌入式设置面板（路由模式）的返回入口：独立窗口模式仍用上面的圆形关闭按钮。
        嵌入式无 standalone 时若只能依赖 LeftNav 切换，用户频繁反馈"进入设置后无法返回"。
      -->
      <n-button
        v-else
        size="small"
        ghost
        class="settings-back-btn"
        :aria-label="t('setting.dialog.back_aria_label')"
        @click="$emit('close')">
        <template #icon>
          <n-icon :size="16">
            <Icon icon="mdi:arrow-left" />
          </n-icon>
        </template>
        {{ t('setting.dialog.back_label') }}
      </n-button>
    </header>
    <div
      :id="contentId"
      class="settings-content-body"
      role="tabpanel"
      tabindex="0"
      :aria-label="t('setting.dialog.content_aria_label', { label: currentTabLabel })"
      :aria-labelledby="`settings-tab-${activeTab}`">
      <div v-if="!renderError" class="settings-tab-wrap" :key="activeTab">
        <component :is="currentTabComponent" />
      </div>
      <TabErrorFallback
        v-else
        :tab-key="renderError.tab"
        :error="renderError.error" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NButton, NIcon, NSpin } from 'naive-ui'
import type { Component } from 'vue'
import { computed, defineAsyncComponent, defineComponent, h, nextTick, onErrorCaptured, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getSettingsTabLabel, type SettingsTabType } from '@/stores/domains/settings/settingsTab'
import { createLogger } from '@/utils/Logger'
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
const logger = createLogger('SettingsContent')

const currentTabLabel = computed(() => getSettingsTabLabel(props.activeTab, t) || t('setting.dialog.current_tab'))

// 在模块作用域一次性创建所有异步组件，避免在 computed 内重复调用 defineAsyncComponent（Vue 3 反模式）
const LoadingFallback = defineComponent({
  setup() {
    return () => h('div', { style: 'display:flex;justify-content:center;padding:40px' }, h(NSpin, { size: 'medium' }))
  }
})

// 错误边界：单个 tab 组件动态导入失败时显示明确报错，而不是静默空白整面板。
const TabErrorFallback = defineComponent({
  props: {
    error: { type: null as unknown as () => Error | null, required: false, default: null },
    tabKey: { type: String, required: false, default: '' }
  },
  setup(props) {
    const message = computed(() => {
      const err = props.error as Error | null
      return err?.message || String(err ?? '') || '组件运行时异常，请查看控制台获取堆栈。'
    })
    return () =>
      h(
        'div',
        {
          class: 'settings-error-fallback',
          style:
            'padding:24px;color:var(--tjg-color-danger-600);font-size:13px;line-height:1.6;display:flex;flex-direction:column;gap:8px'
        },
        [
          h('strong', { style: 'font-size:14px' }, `「${props.tabKey}」设置页加载失败`),
          h('span', {}, message.value)
        ]
      )
  }
})

// 每个 tab 仅允许重试一次，避免持久性失败时无限重试
const tabLoadAttempts = new Map<string, number>()

const tabComponents: Record<SettingsTabType, Component> = Object.fromEntries(
  Object.entries(SETTINGS_TAB_COMPONENT_LOADERS).map(([key, loader]) => [
    key,
    defineAsyncComponent({
      loader: loader as () => Promise<Component>,
      loadingComponent: LoadingFallback,
      errorComponent: TabErrorFallback,
      // 仅在第一次失败时重试一次，避免瞬时时序问题被误判为永久失败，也避免死循环
      onError(_error, retry, fail) {
        const attempts = tabLoadAttempts.get(key) ?? 0
        if (attempts >= 1) {
          fail()
        } else {
          tabLoadAttempts.set(key, attempts + 1)
          retry()
        }
      }
    })
  ])
) as Record<SettingsTabType, Component>

const currentTabComponent = computed(() => tabComponents[props.activeTab])

// 渲染时异常的兜底：errorComponent 只能捕获 dynamic import 拒绝，
// 对于"组件加载成功但 setup/render 抛错"的情况，errorComponent 不会触发，
// 整面板会静默空白。这里用状态手动模拟异步组件错误态：
// 1) 通过 onErrorCaptured 接收子组件渲染异常
// 2) 主动渲染 TabErrorFallback，并允许用户清除错误后切回对应 tab 重试
const renderError = ref<{ tab: SettingsTabType; error: Error } | null>(null)

function captureRenderError(tab: SettingsTabType, err: unknown) {
  // 防止 onError / onErrorCaptured 互相级联触发导致同 tab 多次重渲染
  if (renderError.value?.tab === tab) return
  const wrapped =
    err instanceof Error ? err : new Error(typeof err === 'string' ? err : '组件渲染时发生未知异常')
  renderError.value = { tab, error: wrapped }
}

function clearRenderError() {
  renderError.value = null
}

watch(
  () => props.activeTab,
  () => {
    // 切换 tab 时清掉上一次的渲染异常，避免错误态卡住影响切换
    clearRenderError()
    // 切 tab 时清理残留的 tooltip/popover DOM：
    // 有些 tooltip（如 naive-ui n-tooltip）在异步加载或 DOM 重建场景下
    // 会"卡住"留在屏幕中央，叠加出"重复 UI"的观感。主动销毁一次即可消除。
    nextTick(() => {
      try {
        document
          .querySelectorAll('.n-tooltip, [role="tooltip"], .n-popover, .v-binder-follower-content')
          .forEach((el) => {
            el.parentNode?.removeChild(el)
          })
      } catch (err) {
        // 静默：清理失败不影响主流程
        logger.warn('清理残留 tooltip 失败', err)
      }
    })
  }
)

onErrorCaptured((err) => {
  if (!renderError.value) {
    captureRenderError(props.activeTab, err)
  }
  // 返回 false 阻止错误继续向根组件冒泡，避免整个设置面板崩溃
  return false
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

.settings-back-btn {
  flex-shrink: 0;
  color: var(--tjg-text-secondary);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.settings-back-btn:hover {
  color: var(--tjg-color-primary-600);
}

.settings-content-body {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding: var(--tjg-space-5);
  background: var(--tjg-surface-panel);
  position: relative;

  @include responsive.respond-to-max('md') {
    padding: var(--tjg-space-4);
  }
}


.settings-tab-wrap {
  position: relative;
  z-index: 1;
  min-height: 100%;
  width: 100%;
}

.settings-error-fallback {
  padding: var(--tjg-space-5);
  color: var(--tjg-color-danger-600);
  font-size: 13px;
  line-height: 1.6;
  display: flex;
  flex-direction: column;
  gap: var(--tjg-space-2);
  background: color-mix(in srgb, var(--tjg-color-danger-500) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--tjg-color-danger-500) 24%, transparent);
  border-radius: var(--tjg-radius-md);
}
</style>
