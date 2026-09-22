import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentPublicInstance } from 'vue'
import { FONT_SCALE_STEPS } from '@/utils/fontScale'
import AppearanceSettings from '../AppearanceSettings.vue'

const messageSuccessMock = vi.fn()
const toggleThemeMock = vi.fn()

const translationMap: Record<string, string> = {
  'setting.appearance.theme_section': '主题',
  'setting.appearance.theme_light': '浅色',
  'setting.appearance.theme_dark': '深色',
  'setting.appearance.theme_auto': '跟随系统',
  'setting.appearance.preview.title': '实时预览',
  'setting.appearance.preview.sample_text': '示例文字',
  'setting.appearance.preview.button': '按钮',
  'setting.appearance.preview.input_placeholder': '输入框',
  'setting.appearance.preview.current_theme': '当前主题',
  'setting.appearance.font_section': '字体',
  'setting.appearance.font_label': '界面字体',
  'setting.appearance.font_desc': '设置应用使用的字体',
  'setting.appearance.font_size_label': '字体大小',
  'setting.appearance.font_size_desc': '调整界面基础字体大小',
  'setting.appearance.font_default': '默认字体',
  'setting.appearance.font_microsoft_yahei': '微软雅黑',
  'setting.appearance.font_pingfang_sc': '苹方',
  'setting.appearance.font_source_han_sans': '思源黑体',
  'setting.appearance.font_size_small': '小',
  'setting.appearance.font_size_standard': '标准',
  'setting.appearance.font_size_large': '大',
  'setting.appearance.font_size_extra_large': '超大',
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
  'setting.appearance.feedback.font_size_changed': '字体大小已调整为 {size}',
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
  fontScale: number
  windowShadow: boolean
  blurEffect: boolean
  bubbleStyle: boolean
  fontOptions: Array<{ value: string; label: string }>
  fontScaleOptions: Array<{ value: number; label: string }>
  handleFontChange: (value: string) => void
  handleFontScaleChange: (value: number) => void
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
  NModal: {
    name: 'NModal',
    template: '<div class="n-modal"><slot /></div>',
    props: ['show', 'title', 'positiveText', 'negativeText', 'maskClosable'],
    emits: ['update:show', 'positiveClick', 'negativeClick']
  },
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
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(window as any).$message = { success: messageSuccessMock }
    localStorage.clear()
    document.documentElement.style.removeProperty('--font-family')
    document.documentElement.style.removeProperty('--tjg-font-scale')
    document.documentElement.removeAttribute('data-bubble-style')

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
    expect(vm.fontOptions).toHaveLength(4)
  })

  it('renders ThemeSwitcher and AppearancePreview components', () => {
    const wrapper = mount(AppearanceSettings)

    expect(wrapper.findComponent({ name: 'ThemeSwitcher' }).exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'AppearancePreview' }).exists()).toBe(true)
  })

  it('does not render inline theme-preview divs after extraction', () => {
    const wrapper = mount(AppearanceSettings)

    expect(wrapper.find('.theme-preview').exists()).toBe(false)
    expect(wrapper.find('.theme-options').exists()).toBe(false)
  })

  it('derives current theme from store state', () => {
    mockStore.themePattern = 'os'
    mockStore.themeContent = 'dark'

    const wrapper = mount(AppearanceSettings)
    expect(getVm(wrapper).currentTheme).toBe('os')
  })

  it('loads saved font scale and bubble style on mount', () => {
    localStorage.setItem('tjg-font-scale', '1.25')
    localStorage.setItem('tjg-bubble-style', 'square')

    const wrapper = mount(AppearanceSettings)
    const vm = getVm(wrapper)

    expect(vm.fontScale).toBe(1.25)
    expect(vm.bubbleStyle).toBe(false)
  })

  it('migrates the legacy boolean bubble style on mount', () => {
    localStorage.setItem('tjg-bubble-style', 'false')

    const wrapper = mount(AppearanceSettings)

    expect(getVm(wrapper).bubbleStyle).toBe(false)
  })

  it('falls back to the standard step when the stored font scale is corrupted', () => {
    localStorage.setItem('tjg-font-scale', '{broken')

    const wrapper = mount(AppearanceSettings)

    expect(getVm(wrapper).fontScale).toBe(1)
  })

  it('offers exactly the font scale steps as selector options', () => {
    const wrapper = mount(AppearanceSettings)
    const vm = getVm(wrapper)

    expect(vm.fontScaleOptions.map((option) => option.value)).toEqual([...FONT_SCALE_STEPS])
    expect(vm.fontScaleOptions.map((option) => option.label)).toEqual(['小', '标准', '大', '超大'])
  })

  it('updates theme through ThemeSwitcher child calling store toggleTheme', async () => {
    const wrapper = mount(AppearanceSettings)

    const switcher = wrapper.findComponent({ name: 'ThemeSwitcher' })
    expect(switcher.exists()).toBe(true)
    // ThemeSwitcher 内部调用 store.toggleTheme
    const lightOption = switcher.find('[data-test="theme-option"][data-value="light"]')
    await lightOption.trigger('click')

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

  it('persists the font scale, applies it to :root, and shows translated feedback', () => {
    const wrapper = mount(AppearanceSettings)
    const vm = getVm(wrapper)

    vm.handleFontScaleChange(1.125)

    expect(localStorage.getItem('tjg-font-scale')).toBe('1.125')
    expect(document.documentElement.style.getPropertyValue('--tjg-font-scale')).toBe('1.125')
    expect(messageSuccessMock).toHaveBeenCalledWith('字体大小已调整为 大')
    // 旧机制的死 key 不再写入：它从来没有消费方
    expect(localStorage.getItem('tjg-font-size')).toBeNull()
  })

  it('wires the font scale selector to the persist/apply handler', async () => {
    const wrapper = mount(AppearanceSettings)
    const scaleSelect = wrapper
      .findAllComponents({ name: 'NSelect' })
      .find((component) => component.classes().includes('font-scale-select'))
    if (!scaleSelect) throw new Error('font-scale-select 未渲染')

    await scaleSelect.vm.$emit('update:value', 1.25)

    expect(localStorage.getItem('tjg-font-scale')).toBe('1.25')
    expect(document.documentElement.style.getPropertyValue('--tjg-font-scale')).toBe('1.25')
  })

  it('clamps an out-of-range font scale back to the standard step', () => {
    const wrapper = mount(AppearanceSettings)
    const vm = getVm(wrapper)

    vm.handleFontScaleChange(9)

    expect(vm.fontScale).toBe(1)
    expect((FONT_SCALE_STEPS as readonly number[]).includes(vm.fontScale)).toBe(true)
    expect(localStorage.getItem('tjg-font-scale')).toBe('1')
    expect(document.documentElement.style.getPropertyValue('--tjg-font-scale')).toBe('1')
    expect(messageSuccessMock).toHaveBeenCalledWith('字体大小已调整为 标准')
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

  it('persists bubble style, applies it to the root, and shows translated feedback', () => {
    const wrapper = mount(AppearanceSettings)
    const vm = getVm(wrapper)

    vm.handleBubbleStyleChange(false)

    expect(localStorage.getItem('tjg-bubble-style')).toBe('square')
    expect(document.documentElement.getAttribute('data-bubble-style')).toBe('square')
    expect(messageSuccessMock).toHaveBeenCalledWith('方角气泡')

    vm.handleBubbleStyleChange(true)

    expect(localStorage.getItem('tjg-bubble-style')).toBe('rounded')
    expect(document.documentElement.getAttribute('data-bubble-style')).toBe('rounded')
    expect(messageSuccessMock).toHaveBeenLastCalledWith('圆角气泡')
  })
})
