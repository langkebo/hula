<template>
  <n-config-provider
    :theme-overrides="settingStore.themeContent === ThemeEnum.DARK ? darkThemeOverrides : lightThemeOverrides"
    :theme="globalTheme"
    :locale="currentNaiveLocale"
    :date-locale="currentNaiveDateLocale">
    <n-loading-bar-provider>
      <n-dialog-provider>
        <n-notification-provider :max="notificMax">
          <n-message-provider :max="messageMax">
            <n-modal-provider>
              <slot></slot>
              <naive-provider-content />
            </n-modal-provider>
          </n-message-provider>
        </n-notification-provider>
      </n-dialog-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import {
  darkTheme,
  dateEnUS,
  dateZhCN,
  enUS,
  type GlobalTheme,
  type GlobalThemeOverrides,
  lightTheme,
  type MessageApi,
  type NDateLocale,
  type NLocale,
  zhCN
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { ThemeEnum } from '@/enums'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { naiveColorsFor, type ThemeName, withAlpha } from '@/styles/naiveTokenSource'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('NaiveProvider')

const { notificMax, messageMax } = defineProps<{
  notificMax?: number
  messageMax?: number
}>()
defineOptions({ name: 'NaiveProvider' })
const settingStore = useSettingStore()
const { locale } = useI18n()

type NaiveLocalePack = {
  locale: NLocale
  dateLocale: NDateLocale
}

const naiveLocaleMap: Record<string, NaiveLocalePack> = {
  'zh-CN': { locale: zhCN, dateLocale: dateZhCN },
  zh: { locale: zhCN, dateLocale: dateZhCN },
  'en-US': { locale: enUS, dateLocale: dateEnUS },
  en: { locale: enUS, dateLocale: dateEnUS }
}

const defaultNaiveLocalePack = naiveLocaleMap['zh-CN']
const resolveNaiveLocale = (lang: string): NaiveLocalePack => naiveLocaleMap[lang] ?? defaultNaiveLocalePack
const currentNaiveLocale = computed(() => resolveNaiveLocale(locale.value).locale)
const currentNaiveDateLocale = computed(() => resolveNaiveLocale(locale.value).dateLocale)
/**监听深色主题颜色变化*/
const globalTheme = ref<GlobalTheme | null>(settingStore.themeContent === ThemeEnum.DARK ? darkTheme : lightTheme)
const prefers = matchMedia('(prefers-color-scheme: dark)')
const mutedMessageWindowLabels = new Set(['tray', 'notify', 'capture', 'update', 'checkupdate'])

const isValidContent = (theme?: string): theme is ThemeEnum => theme === ThemeEnum.DARK || theme === ThemeEnum.LIGHT

const applyThemeContent = (theme: ThemeEnum) => {
  globalTheme.value = theme === ThemeEnum.DARK ? darkTheme : lightTheme
  document.documentElement.dataset.theme = theme
  logger.debug('Applied theme content', globalTheme.value)
}

const syncOsTheme = () => {
  if (settingStore.themePattern !== ThemeEnum.OS) return
  settingStore.syncOsTheme()
}

const handlePrefersChange = () => {
  syncOsTheme()
}

let prefersListenerAttached = false
const attachPrefersListener = () => {
  if (prefersListenerAttached) return
  prefers.addEventListener('change', handlePrefersChange)
  prefersListenerAttached = true
}

const detachPrefersListener = () => {
  if (!prefersListenerAttached) return
  prefers.removeEventListener('change', handlePrefersChange)
  prefersListenerAttached = false
}

watch(
  () => settingStore.themePattern,
  (pattern) => {
    if (pattern === ThemeEnum.OS) {
      syncOsTheme()
      attachPrefersListener()
      return
    }
    detachPrefersListener()
    settingStore.normalizeThemeState()
  },
  { immediate: true }
)

watch(
  () => settingStore.themeContent,
  (content) => {
    if (!isValidContent(content)) {
      settingStore.normalizeThemeState()
      return
    }
    applyThemeContent(content)
  },
  { immediate: true }
)

onUnmounted(() => {
  detachPrefersListener()
})

/**
 * Naive UI 内部使用 seemely/rgba() 对颜色做运算（hover/pressed 派生），
 * 无法解析 CSS 变量引用，具体色值经 naiveTokenSource 从 design-tokens.css
 * 镜像取得（唯一 token 源，同步由守护测试锁定）；
 * secondary hover/pressed 透明度（0.18/0.24）由品牌色派生。
 */
const createThemeOverrides = (theme: ThemeName): GlobalThemeOverrides => {
  const c = naiveColorsFor(theme)
  const commonTheme: GlobalThemeOverrides = {
    Badge: {
      color: c.danger500
    },
    Input: {
      borderRadius: '10px',
      borderHover: '0',
      borderDisabled: '0',
      borderFocus: '0',
      boxShadowFocus: '0'
    },
    Checkbox: {
      colorChecked: c.primary500,
      borderChecked: `1px solid ${c.primary500}`,
      borderFocus: `1px solid ${c.primary500}`,
      boxShadowFocus: `0 0 0 2px ${c.primary200}`,
      checkMarkColor: 'var(--tjg-text-inverse)'
    },
    Tag: {
      borderRadius: '4px'
    },
    Button: {
      borderRadiusMedium: '10px',
      borderRadiusSmall: '6px',
      colorPrimary: c.primary500,
      colorHoverPrimary: c.primary400,
      colorPressedPrimary: c.primary600,
      colorFocusPrimary: c.primary400,
      colorDisabledPrimary: c.primary200,
      // 显式提供 secondary 颜色，防止 Naive UI 尝试使用 seemly/rgba 解析 CSS 变量
      colorSecondaryPrimary: c.primary100,
      colorSecondaryHoverPrimary: withAlpha(c.primary500, 0.18),
      colorSecondaryPressedPrimary: withAlpha(c.primary500, 0.24),
      textColorTextPrimary: c.primary500,
      textColorGhostPrimary: c.primary500
    },
    Tabs: {
      tabTextColorSegment: 'var(--tjg-text-secondary)',
      tabPaddingMediumSegment: '4px',
      tabTextColorActiveLine: c.primary500,
      tabTextColorHoverLine: c.primary500,
      tabTextColorActiveBar: c.primary500,
      tabTextColorHoverBar: c.primary500,
      barColor: c.primary500
    },
    Popover: {
      padding: '5px',
      borderRadius: '8px'
    },
    Dropdown: {
      borderRadius: '8px'
    },
    Avatar: {
      border: '1px solid var(--tjg-surface-panel)'
    },
    Switch: {
      railColorActive: c.primary500,
      loadingColor: c.primary500,
      boxShadowFocus: `0 0 0 2px ${c.primary200}`
    },
    Radio: {
      dotColorActive: c.primary500,
      buttonBorderColorActive: c.primary500,
      buttonTextColorActive: c.primary500,
      boxShadowFocus: `0 0 0 2px ${c.primary200}`
    },
    Message: {
      iconColorSuccess: c.primary500,
      iconColorLoading: c.primary500,
      loadingColor: c.primary500,
      borderRadius: '8px'
    },
    Slider: {
      handleSize: '12px',
      fontSize: '10px',
      markFontSize: '8px',
      fillColor: c.primary500,
      fillColorHover: c.primary500,
      indicatorBorderRadius: '8px'
    },
    Notification: {
      borderRadius: '8px'
    },
    Steps: {
      indicatorBorderColorProcess: c.primary500,
      indicatorColorProcess: c.primary500,
      indicatorTextColorProcess: 'var(--tjg-text-inverse)',
      stepHeaderTextColorProcess: c.primary500,
      indicatorIconColorProcess: 'var(--tjg-text-inverse)'
    },
    LoadingBar: {
      colorLoading: c.primary500
    }
  }

  if (theme === 'dark') {
    return {
      ...commonTheme,
      Scrollbar: {
        color: 'color-mix(in srgb, var(--tjg-text-inverse) 20%, transparent)',
        colorHover: 'color-mix(in srgb, var(--tjg-text-inverse) 30%, transparent)'
      },
      Skeleton: {
        color: 'color-mix(in srgb, var(--tjg-border-strong) 40%, transparent)',
        colorEnd: 'color-mix(in srgb, var(--tjg-border-default) 15%, transparent)'
      }
    }
  }

  return {
    ...commonTheme,
    Scrollbar: {
      color: 'var(--tjg-border-strong)',
      colorHover: 'var(--tjg-border-default)'
    },
    Skeleton: {
      color: 'color-mix(in srgb, var(--tjg-border-strong) 60%, transparent)',
      colorEnd: 'color-mix(in srgb, var(--tjg-border-default) 20%, transparent)'
    }
  }
}

/** 浅色模式的主题颜色 */
const lightThemeOverrides = createThemeOverrides('light')

/** 深色模式的主题颜色 */
const darkThemeOverrides = createThemeOverrides('dark')

const createMutedMessageApi = (): MessageApi =>
  ({
    info: () => {},
    success: () => {},
    warning: () => {},
    error: () => {},
    loading: () => ({
      destroy: () => {},
      type: 'loading'
    }),
    create: () => ({
      destroy: () => {},
      type: 'info'
    }),
    destroyAll: () => {}
  }) as unknown as MessageApi

const resolveMessageApi = (messageApi: MessageApi): MessageApi => {
  if (!hasTauriRuntime()) {
    return messageApi
  }

  try {
    const currentWindowLabel = getCurrentWebviewWindow().label
    return mutedMessageWindowLabels.has(currentWindowLabel) ? createMutedMessageApi() : messageApi
  } catch (error) {
    logger.warn('Failed to resolve current window label for message bridge:', error)
    return messageApi
  }
}

// 暂时保留全局桥接，供 hooks / mobile / 非组件上下文复用统一反馈能力。
const registerNaiveTools = () => {
  window.$loadingBar = useLoadingBar()
  window.$dialog = useDialog()
  window.$notification = useNotification()
  window.$modal = useModal()
  window.$message = resolveMessageApi(useMessage())
}

const NaiveProviderContent = defineComponent({
  name: 'NaiveProviderContent',
  setup() {
    registerNaiveTools()
  },
  render() {
    return h('div')
  }
})
</script>
<style>
.n-popover {
  zoom: var(--page-scale, 1);
}

.n-dropdown-menu {
  zoom: var(--page-scale, 1);
}

.n-tooltip {
  zoom: var(--page-scale, 1);
}

.n-modal {
  zoom: var(--page-scale, 1);
}

.n-drawer {
  zoom: var(--page-scale, 1);
}

.n-notification {
  zoom: var(--page-scale, 1);
}

.n-message {
  zoom: var(--page-scale, 1);
  /* 统一使用品牌动效令牌 */
  --n-bezier: var(--tjg-motion-ease-standard);
}

/* P1-3.3: 统一 Toast 出场动画为品牌动效（280ms + 品牌缓动） */
.n-message-wrapper.fade-in-height-expand-transition-enter-active,
.n-message-wrapper.fade-in-height-expand-transition-leave-active {
  transition-duration: var(--tjg-motion-duration-overlay);
}

.n-message-wrapper.fade-in-height-expand-transition-enter-active {
  transition-timing-function: var(--tjg-motion-ease-enter);
}

.n-message-wrapper.fade-in-height-expand-transition-leave-active {
  transition-timing-function: var(--tjg-motion-ease-exit);
}

/* ==================== P2-Task9: Toast 视觉对齐原型（语义色边条） ====================
 * 对齐 TJG-prototype.html L4260-4283 .toast 设计：
 *   - 暗色主题：暗底 #1a1a1a + 1px 描边（原型 verbatim）
 *   - 语义色左 3px 边条（success/error/warning/info/loading → --tjg-color-*）
 *   - 浅色主题：保留 Naive UI 默认浅底，仅叠加语义色左 3px 边条
 * 入场动画复用 Naive UI 自带 transition（已由 .n-message-wrapper 接入
 * --tjg-motion-duration-overlay 280ms，近似原型 toastIn .25s），不另设 keyframes。
 * reduced-motion 用户由 design-tokens.css 全局 0.01ms 覆盖自动禁用运动感。
 * ==================================================================== */

/* 暗色主题：暗底 + 1px 描边（原型 .toast 的 #1a1a1a / rgba(255,255,255,0.1) 已 token 化：
   --tjg-surface-dark 与 --tjg-text-inverse 10% 派生，视觉等值） */
html[data-theme='dark'] .n-message {
  background: var(--tjg-surface-dark);
  border: 1px solid color-mix(in srgb, var(--tjg-text-inverse) 10%, transparent);
}

/* 语义色左 3px 边条 — 浅色主题（Naive UI 默认浅底）下叠加。
   使用复合选择器 .n-message.n-message--xxx-type（特异性 0,2,0）以胜过 Naive UI 运行时注入的
   .n-message { border: var(--n-border) }（0,1,0，浅色主题默认 '0'）—— 否则 border shorthand
   会覆盖 border-left longhand，使 3px 语义色边条在浅色主题下不可见。 */
.n-message.n-message--success-type {
  border-left: 3px solid var(--tjg-color-primary-500);
}

.n-message.n-message--error-type {
  border-left: 3px solid var(--tjg-color-danger-500);
}

.n-message.n-message--warning-type {
  border-left: 3px solid var(--tjg-color-warning-500);
}

.n-message.n-message--info-type {
  border-left: 3px solid var(--tjg-color-info-500);
}

.n-message.n-message--loading-type {
  border-left: 3px solid var(--tjg-color-primary-500);
}

/* 暗色主题：上面 .n-message 的 border shorthand 会重置 border-left，
   需用更特异的选择器重新叠加语义色左 3px 边条（对应原型 .toast.success/error/warn） */
html[data-theme='dark'] .n-message.n-message--success-type {
  border-left: 3px solid var(--tjg-color-primary-500);
}

html[data-theme='dark'] .n-message.n-message--error-type {
  border-left: 3px solid var(--tjg-color-danger-500);
}

html[data-theme='dark'] .n-message.n-message--warning-type {
  border-left: 3px solid var(--tjg-color-warning-500);
}

html[data-theme='dark'] .n-message.n-message--info-type {
  border-left: 3px solid var(--tjg-color-info-500);
}

html[data-theme='dark'] .n-message.n-message--loading-type {
  border-left: 3px solid var(--tjg-color-primary-500);
}

.n-date-picker-panel {
  zoom: var(--page-scale, 1);
}

.n-time-picker-panel {
  zoom: var(--page-scale, 1);
}

.n-cascader-menu {
  zoom: var(--page-scale, 1);
}

.n-select-menu {
  zoom: var(--page-scale, 1);
}

.n-popselect {
  zoom: var(--page-scale, 1);
}

.n-popselect-panel {
  zoom: var(--page-scale, 1);
}

.n-base-select-menu {
  zoom: var(--page-scale, 1);
}
</style>
