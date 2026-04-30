import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentPublicInstance } from 'vue'
import AppearanceSettings from '../AppearanceSettings.vue'

const messageSuccessMock = vi.fn()
const toggleThemeMock = vi.fn()

const translationMap: Record<string, string> = {
  'setting.appearance.theme_section': '主题',
  'setting.appearance.theme_light': '浅色',
  'setting.appearance.theme_dark': '深色',
  'setting.appearance.theme_auto': '跟随系统',
  'setting.appearance.font_section': '字体',
  'setting.appearance.font_label': '界面字体',
  'setting.appearance.font_desc': '设置应用使用的字体',
  'setting.appearance.font_size_label': '字体大小',
  'setting.appearance.font_size_desc': '调整界面基础字体大小',
  'setting.appearance.font_default': '默认字体',
  'setting.appearance.font_microsoft_yahei': '微软雅黑',
  'setting.appearance.font_pingfang_sc': '苹方',
  'setting.appearance.font_source_han_sans': '思源黑体',
  'setting.appearance.effects_section': '界面效果',
  'setting.appearance.window_shadow_label': '窗口阴影',
  'setting.appearance.window_shadow_desc': '显示窗口外阴影效果',
  'setting.appearance.blur_label': '模糊效果',
  'setting.appearance.blur_desc': '启用毛玻璃模糊效果',
  'setting.appearance.bubble_section': '气泡样式',
  'setting.appearance.bubble_style_label': '消息气泡圆角',
  'setting.appearance.bubble_style_desc': '切换圆角或方角消息气泡',
  'setting.appearance.bubble_rounded': '圆角气泡',
  'setting.appearance.bubble_square': '方角气泡',
  'setting.appearance.feedback.theme_changed': '主题已切换',
  'setting.appearance.feedback.font_changed': '字体已更新',
  'setting.appearance.feedback.font_size_changed': '字体大小已调整为 {size}px',
  'setting.appearance.feedback.window_shadow_enabled': '窗口阴影已启用',
  'setting.appearance.feedback.window_shadow_disabled': '窗口阴影已关闭',
  'setting.appearance.feedback.blur_enabled': '模糊效果已启用',
  'setting.appearance.feedback.blur_disabled': '模糊效果已关闭',
  'setting.appearance.feedback.bubble_rounded': '圆角气泡',
  'setting.appearance.feedback.bubble_square': '方角气泡'
}

type AppearanceSettingsVm = ComponentPublicInstance & {
  currentTheme: string
  fontFamily: string
  fontSize: number
  windowShadow: boolean
  blurEffect: boolean
  bubbleStyle: boolean
  themeOptions: Array<{ value: string; label: string }>
  fontOptions: Array<{ value: string; label: string }>
  handleThemeChange: (theme: string) => void
  handleFontChange: (value: string) => void
  handleFontSizeChange: (value: number) => void
  handleShadowChange: (value: boolean) => void
  handleBlurChange: (value: boolean) => void
  handleBubbleStyleChange: (value: boolean) => void
}

type MockSettingStore = {
  themePattern: string
  themeContent: string
  pageFontFamily: string
  pageShadowEnabled: boolean
  pageBlurEnabled: boolean
  toggleTheme: (theme: string) => void
  setPageFont: (font: string) => void
  setPageShadowEnabled: (enabled: boolean) => void
  setPageBlurEnabled: (enabled: boolean) => void
}

let mockStore: MockSettingStore

vi.mock('naive-ui', () => ({
  NSlider: { name: 'NSlider', template: '<div class="n-slider" />', props: ['value', 'min', 'max', 'step'] },
  NSwitch: {
    name: 'NSwitch',
    template: '<div class="n-switch"><slot name="checked" /><slot name="unchecked" /></div>',
    props: ['value']
  },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NSelect: { name: 'NSelect', template: '<select><slot /></select>', props: ['value', 'options'] },
  useMessage: () => ({ success: messageSuccessMock })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const template = translationMap[key] ?? key
      if (!params) return template
      return Object.entries(params).reduce(
        (message, [name, value]) => message.replace(new RegExp(`\\{${name}\\}`, 'g'), value),
        template
      )
    }
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => mockStore
}))

describe('AppearanceSettings', () => {
  const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as AppearanceSettingsVm

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    document.documentElement.style.removeProperty('--font-family')
    document.documentElement.style.removeProperty('--font-size-base')

    mockStore = {
      themePattern: 'dark',
      themeContent: 'dark',
      pageFontFamily: 'PingFang',
      pageShadowEnabled: true,
      pageBlurEnabled: true,
      toggleTheme: (theme: string) => {
        toggleThemeMock(theme)
        mockStore.themePattern = theme
        mockStore.themeContent = theme === 'os' ? 'dark' : theme
      },
      setPageFont: (font: string) => {
        mockStore.pageFontFamily = font
      },
      setPageShadowEnabled: (enabled: boolean) => {
        mockStore.pageShadowEnabled = enabled
      },
      setPageBlurEnabled: (enabled: boolean) => {
        mockStore.pageBlurEnabled = enabled
      }
    }
  })

  it('renders translated sections and computed options', () => {
    const wrapper = mount(AppearanceSettings)
    const vm = getVm(wrapper)

    expect(wrapper.find('.appearance-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('主题')
    expect(wrapper.text()).toContain('字体')
    expect(wrapper.text()).toContain('界面效果')
    expect(vm.themeOptions.map((option) => option.value)).toEqual(['light', 'dark', 'os'])
    expect(vm.fontOptions).toHaveLength(4)
  })

  it('derives current theme from store state', () => {
    mockStore.themePattern = 'os'
    mockStore.themeContent = 'dark'

    const wrapper = mount(AppearanceSettings)
    expect(getVm(wrapper).currentTheme).toBe('os')
  })

  it('loads saved font size and bubble style on mount', () => {
    localStorage.setItem('hula-font-size', '18')
    localStorage.setItem('hula-bubble-style', 'false')

    const wrapper = mount(AppearanceSettings)
    const vm = getVm(wrapper)

    expect(vm.fontSize).toBe(18)
    expect(vm.bubbleStyle).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--font-size-base')).toBe('18px')
  })

  it('updates theme through store and shows feedback', () => {
    const wrapper = mount(AppearanceSettings)
    const vm = getVm(wrapper)

    vm.handleThemeChange('light')

    expect(toggleThemeMock).toHaveBeenCalledWith('light')
    expect(messageSuccessMock).toHaveBeenCalledWith('主题已切换')
  })

  it('updates font family in store and document style', () => {
    const wrapper = mount(AppearanceSettings)
    const vm = getVm(wrapper)

    vm.handleFontChange('Source Han Sans')

    expect(mockStore.pageFontFamily).toBe('Source Han Sans')
    expect(document.documentElement.style.getPropertyValue('--font-family')).toBe('Source Han Sans')
    expect(messageSuccessMock).toHaveBeenCalledWith('字体已更新')
  })

  it('persists font size and shows translated feedback', () => {
    const wrapper = mount(AppearanceSettings)
    const vm = getVm(wrapper)

    vm.handleFontSizeChange(16)

    expect(localStorage.getItem('hula-font-size')).toBe('16')
    expect(document.documentElement.style.getPropertyValue('--font-size-base')).toBe('16px')
    expect(messageSuccessMock).toHaveBeenCalledWith('字体大小已调整为 16px')
  })

  it('writes effect switches back to store', () => {
    const wrapper = mount(AppearanceSettings)
    const vm = getVm(wrapper)

    vm.handleShadowChange(false)
    vm.handleBlurChange(false)

    expect(mockStore.pageShadowEnabled).toBe(false)
    expect(mockStore.pageBlurEnabled).toBe(false)
    expect(messageSuccessMock).toHaveBeenNthCalledWith(1, '窗口阴影已关闭')
    expect(messageSuccessMock).toHaveBeenNthCalledWith(2, '模糊效果已关闭')
  })

  it('persists bubble style selection', () => {
    const wrapper = mount(AppearanceSettings)
    const vm = getVm(wrapper)

    vm.handleBubbleStyleChange(false)

    expect(localStorage.getItem('hula-bubble-style')).toBe('false')
    expect(messageSuccessMock).toHaveBeenCalledWith('方角气泡')
  })
})
