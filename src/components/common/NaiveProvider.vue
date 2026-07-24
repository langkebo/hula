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

/**
 * 品牌色具体色值（供 Naive UI 颜色运算使用）。
 * Naive UI 内部使用 seemly/rgba() 对颜色做运算（如计算 hover/pressed 状态），
 * 无法解析 CSS 变量引用，必须传入具体色值。
 * 注意：暗色模式下 primary 色值不变，danger 变为 #ff7875（在 darkThemeOverrides 中覆盖）。
 */
const primaryColors = {
  500: '#13987f',
  400: '#1ab292',
  600: '#0f7a66',
  200: 'rgba(19, 152, 127, 0.2)',
  100: 'rgba(19, 152, 127, 0.1)'
}

const dangerColors = {
  500: '#ff4d4f'
}

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

const commonTheme: GlobalThemeOverrides = {
  Badge: {
    color: dangerColors[500]
  },
  Input: {
    borderRadius: '10px',
    borderHover: '0',
    borderDisabled: '0',
    borderFocus: '0',
    boxShadowFocus: '0'
  },
  Checkbox: {
    colorChecked: primaryColors[500],
    borderChecked: `1px solid ${primaryColors[500]}`,
    borderFocus: `1px solid ${primaryColors[500]}`,
    boxShadowFocus: `0 0 0 2px ${primaryColors[200]}`,
    checkMarkColor: 'var(--hula-text-inverse)'
  },
  Tag: {
    borderRadius: '4px'
  },
  Button: {
    borderRadiusMedium: '10px',
    borderRadiusSmall: '6px',
    colorPrimary: primaryColors[500],
    colorHoverPrimary: primaryColors[400],
    colorPressedPrimary: primaryColors[600],
    colorFocusPrimary: primaryColors[400],
    colorDisabledPrimary: primaryColors[200],
    // 显式提供 secondary 颜色，防止 Naive UI 尝试使用 seemly/rgba 解析 CSS 变量
    colorSecondaryPrimary: primaryColors[100],
    colorSecondaryHoverPrimary: 'rgba(19, 152, 127, 0.18)',
    colorSecondaryPressedPrimary: 'rgba(19, 152, 127, 0.24)',
    textColorTextPrimary: primaryColors[500],
    textColorGhostPrimary: primaryColors[500]
  },
  Tabs: {
    tabTextColorSegment: 'var(--hula-text-secondary)',
    tabPaddingMediumSegment: '4px',
    tabTextColorActiveLine: primaryColors[500],
    tabTextColorHoverLine: primaryColors[500],
    tabTextColorActiveBar: primaryColors[500],
    tabTextColorHoverBar: primaryColors[500],
    barColor: primaryColors[500]
  },
  Popover: {
    padding: '5px',
    borderRadius: '8px'
  },
  Dropdown: {
    borderRadius: '8px'
  },
  Avatar: {
    border: '1px solid var(--hula-surface-panel)'
  },
  Switch: {
    railColorActive: primaryColors[500],
    loadingColor: primaryColors[500],
    boxShadowFocus: `0 0 0 2px ${primaryColors[200]}`
  },
  Radio: {
    dotColorActive: primaryColors[500],
    buttonBorderColorActive: primaryColors[500],
    buttonTextColorActive: primaryColors[500],
    boxShadowFocus: `0 0 0 2px ${primaryColors[200]}`
  },
  Message: {
    iconColorSuccess: primaryColors[500],
    iconColorLoading: primaryColors[500],
    loadingColor: primaryColors[500],
    borderRadius: '8px'
  },
  Slider: {
    handleSize: '12px',
    fontSize: '10px',
    markFontSize: '8px',
    fillColor: primaryColors[500],
    fillColorHover: primaryColors[500],
    indicatorBorderRadius: '8px'
  },
  Notification: {
    borderRadius: '8px'
  },
  Steps: {
    indicatorBorderColorProcess: primaryColors[500],
    indicatorColorProcess: primaryColors[500],
    indicatorTextColorProcess: 'var(--hula-text-inverse)',
    stepHeaderTextColorProcess: primaryColors[500],
    indicatorIconColorProcess: 'var(--hula-text-inverse)'
  },
  LoadingBar: {
    colorLoading: primaryColors[500]
  }
}

/** 浅色模式的主题颜色 */
const lightThemeOverrides: GlobalThemeOverrides = {
  ...commonTheme,
  Scrollbar: {
    color: 'var(--hula-border-strong)',
    colorHover: 'var(--hula-border-default)'
  },
  Skeleton: {
    color: 'color-mix(in srgb, var(--hula-border-strong) 60%, transparent)',
    colorEnd: 'color-mix(in srgb, var(--hula-border-default) 20%, transparent)'
  }
}

/** 深色模式的主题颜色 */
const darkThemeOverrides: GlobalThemeOverrides = {
  ...commonTheme,
  Badge: {
    color: '#ff7875'
  },
  Scrollbar: {
    color: 'color-mix(in srgb, var(--hula-text-inverse) 20%, transparent)',
    colorHover: 'color-mix(in srgb, var(--hula-text-inverse) 30%, transparent)'
  },
  Skeleton: {
    color: 'color-mix(in srgb, var(--hula-border-strong) 40%, transparent)',
    colorEnd: 'color-mix(in srgb, var(--hula-border-default) 15%, transparent)'
  }
}

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
  --n-bezier: var(--hula-motion-ease-standard);
}

/* P1-3.3: 统一 Toast 出场动画为品牌动效（280ms + 品牌缓动） */
.n-message-wrapper.fade-in-height-expand-transition-enter-active,
.n-message-wrapper.fade-in-height-expand-transition-leave-active {
  transition-duration: var(--hula-motion-duration-overlay);
}

.n-message-wrapper.fade-in-height-expand-transition-enter-active {
  transition-timing-function: var(--hula-motion-ease-enter);
}

.n-message-wrapper.fade-in-height-expand-transition-leave-active {
  transition-timing-function: var(--hula-motion-ease-exit);
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
