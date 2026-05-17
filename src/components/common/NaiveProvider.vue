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
    color: 'var(--hula-color-danger-500)'
  },
  Input: {
    borderRadius: '10px',
    borderHover: '0',
    borderDisabled: '0',
    borderFocus: '0',
    boxShadowFocus: '0'
  },
  Checkbox: {
    colorChecked: 'var(--hula-color-primary-500)',
    borderChecked: '1px solid var(--hula-color-primary-500)',
    borderFocus: '1px solid var(--hula-color-primary-500)',
    boxShadowFocus: '0 0 0 2px color-mix(in srgb, var(--hula-color-primary-500) 20%, transparent)',
    checkMarkColor: 'var(--hula-text-inverse)'
  },
  Tag: {
    borderRadius: '4px'
  },
  Button: {
    borderRadiusMedium: '10px',
    borderRadiusSmall: '6px',
    colorPrimary: 'var(--hula-color-primary-500)',
    colorHoverPrimary: 'var(--hula-color-primary-400)',
    colorPressedPrimary: 'var(--hula-color-primary-600)',
    colorFocusPrimary: 'var(--hula-color-primary-400)',
    colorDisabledPrimary: 'var(--hula-color-primary-200)',
    // 显式提供 secondary 颜色，防止 Naive UI 尝试使用 seemly/rgba 解析 CSS 变量
    colorSecondaryPrimary: 'color-mix(in srgb, var(--hula-color-primary-500) 12%, transparent)',
    colorSecondaryHoverPrimary: 'color-mix(in srgb, var(--hula-color-primary-500) 18%, transparent)',
    colorSecondaryPressedPrimary: 'color-mix(in srgb, var(--hula-color-primary-500) 24%, transparent)',
    textColorTextPrimary: 'var(--hula-color-primary-500)',
    textColorGhostPrimary: 'var(--hula-color-primary-500)'
  },
  Tabs: {
    tabTextColorSegment: 'var(--hula-text-secondary)',
    tabPaddingMediumSegment: '4px',
    tabTextColorActiveLine: 'var(--hula-color-primary-500)',
    tabTextColorHoverLine: 'var(--hula-color-primary-500)',
    tabTextColorActiveBar: 'var(--hula-color-primary-500)',
    tabTextColorHoverBar: 'var(--hula-color-primary-500)',
    barColor: 'var(--hula-color-primary-500)'
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
    railColorActive: 'var(--hula-color-primary-500)',
    loadingColor: 'var(--hula-color-primary-500)',
    boxShadowFocus: '0 0 0 2px color-mix(in srgb, var(--hula-color-primary-500) 20%, transparent)'
  },
  Radio: {
    dotColorActive: 'var(--hula-color-primary-500)',
    buttonBorderColorActive: 'var(--hula-color-primary-500)',
    buttonTextColorActive: 'var(--hula-color-primary-500)',
    boxShadowFocus: '0 0 0 2px color-mix(in srgb, var(--hula-color-primary-500) 20%, transparent)'
  },
  Message: {
    iconColorSuccess: 'var(--hula-color-primary-500)',
    iconColorLoading: 'var(--hula-color-primary-500)',
    loadingColor: 'var(--hula-color-primary-500)',
    borderRadius: '8px'
  },
  Slider: {
    handleSize: '12px',
    fontSize: '10px',
    markFontSize: '8px',
    fillColor: 'var(--hula-color-primary-500)',
    fillColorHover: 'var(--hula-color-primary-500)',
    indicatorBorderRadius: '8px'
  },
  Notification: {
    borderRadius: '8px'
  },
  Steps: {
    indicatorBorderColorProcess: 'var(--hula-color-primary-500)',
    indicatorColorProcess: 'var(--hula-color-primary-500)',
    indicatorTextColorProcess: 'var(--hula-text-inverse)',
    stepHeaderTextColorProcess: 'var(--hula-color-primary-500)',
    indicatorIconColorProcess: 'var(--hula-text-inverse)'
  },
  LoadingBar: {
    colorLoading: 'var(--hula-color-primary-500)'
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
