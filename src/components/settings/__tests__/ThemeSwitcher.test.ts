import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeSwitcher from '../ThemeSwitcher.vue'

const toggleThemeMock = vi.fn()
const showFeedbackMock = vi.fn()

const translationMap: Record<string, string> = {
  'setting.appearance.theme_light': '浅色模式',
  'setting.appearance.theme_dark': '深色模式',
  'setting.appearance.theme_auto': '跟随系统',
  'setting.appearance.feedback.theme_changed': '主题已切换'
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => translationMap[key] ?? key
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    toggleTheme: toggleThemeMock
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染三个主题选项（light/dark/os），每个含图标与文字标签', () => {
    const wrapper = mount(ThemeSwitcher, {
      props: { modelValue: 'light' }
    })

    const options = wrapper.findAll('[data-test="theme-option"]')
    expect(options).toHaveLength(3)

    const values = options.map((o) => o.attributes('data-value'))
    expect(values).toEqual(['light', 'dark', 'os'])

    // 每个选项都包含 SVG 图标
    for (const option of options) {
      expect(option.find('svg').exists()).toBe(true)
    }

    // 文字标签存在
    expect(wrapper.text()).toContain('浅色模式')
    expect(wrapper.text()).toContain('深色模式')
    expect(wrapper.text()).toContain('跟随系统')
  })

  it('根据 modelValue 高亮当前选中选项', () => {
    const wrapper = mount(ThemeSwitcher, {
      props: { modelValue: 'dark' }
    })

    const options = wrapper.findAll('[data-test="theme-option"]')
    const darkOption = options.find((o) => o.attributes('data-value') === 'dark')
    const lightOption = options.find((o) => o.attributes('data-value') === 'light')

    expect(darkOption?.classes()).toContain('theme-switcher__option--active')
    expect(lightOption?.classes()).not.toContain('theme-switcher__option--active')
  })

  it('点击选项时调用 settingStore.toggleTheme 并触发 update:modelValue', async () => {
    const wrapper = mount(ThemeSwitcher, {
      props: { modelValue: 'light' }
    })

    const darkOption = wrapper.find('[data-test="theme-option"][data-value="dark"]')
    await darkOption.trigger('click')

    expect(toggleThemeMock).toHaveBeenCalledWith('dark')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['dark'])
  })

  it('切换主题后显示成功反馈', async () => {
    const wrapper = mount(ThemeSwitcher, {
      props: { modelValue: 'light' }
    })

    const osOption = wrapper.find('[data-test="theme-option"][data-value="os"]')
    await osOption.trigger('click')

    expect(showFeedbackMock).toHaveBeenCalledWith('主题已切换', 'success')
  })

  it('选项使用 button 元素并带 aria-pressed 可访问性属性', () => {
    const wrapper = mount(ThemeSwitcher, {
      props: { modelValue: 'light' }
    })

    const options = wrapper.findAll('[data-test="theme-option"]')
    for (const option of options) {
      expect(option.element.tagName.toLowerCase()).toBe('button')
      expect(option.attributes('aria-pressed')).toBeDefined()
    }
  })

  it('选项分组容器带 role="group" 可访问性属性', () => {
    const wrapper = mount(ThemeSwitcher, {
      props: { modelValue: 'light' }
    })

    const group = wrapper.find('[data-test="theme-switcher-group"]')
    expect(group.attributes('role')).toBe('group')
  })

  it('SVG 图标使用 1.5px stroke-width', () => {
    const wrapper = mount(ThemeSwitcher, {
      props: { modelValue: 'light' }
    })

    const svgs = wrapper.findAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(3)
    for (const svg of svgs) {
      expect(svg.attributes('stroke-width')).toBe('1.5')
    }
  })

  it('选中 light 时不调用 store（仅当点击不同选项才触发）', async () => {
    const wrapper = mount(ThemeSwitcher, {
      props: { modelValue: 'dark' }
    })

    const darkOption = wrapper.find('[data-test="theme-option"][data-value="dark"]')
    await darkOption.trigger('click')

    // 点击当前已选中项不应触发切换
    expect(toggleThemeMock).not.toHaveBeenCalled()
  })
})
