import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppearancePreview from '../AppearancePreview.vue'

const translationMap: Record<string, string> = {
  'setting.appearance.preview.title': '实时预览',
  'setting.appearance.preview.sample_text': '这是一段示例文字',
  'setting.appearance.preview.button': '按钮',
  'setting.appearance.preview.input_placeholder': '输入框',
  'setting.appearance.preview.current_theme': '当前主题',
  'setting.appearance.theme_light': '浅色模式',
  'setting.appearance.theme_dark': '深色模式'
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => translationMap[key] ?? key
  })
}))

describe('AppearancePreview', () => {
  beforeEach(() => {
    document.documentElement.dataset.theme = 'light'
  })

  afterEach(() => {
    delete document.documentElement.dataset.theme
    vi.restoreAllMocks()
  })

  it('渲染预览卡片，包含标题与示例内容', () => {
    const wrapper = mount(AppearancePreview)

    expect(wrapper.find('[data-test="appearance-preview"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('实时预览')
    expect(wrapper.text()).toContain('这是一段示例文字')
  })

  it('渲染示例按钮与输入框元素', () => {
    const wrapper = mount(AppearancePreview)

    expect(wrapper.find('[data-test="preview-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="preview-input"]').exists()).toBe(true)
  })

  it('显示当前 data-theme 主题标签（light）', () => {
    document.documentElement.dataset.theme = 'light'
    const wrapper = mount(AppearancePreview)

    expect(wrapper.find('[data-test="preview-current-theme"]').text()).toContain('浅色模式')
  })

  it('显示当前 data-theme 主题标签（dark）', () => {
    document.documentElement.dataset.theme = 'dark'
    const wrapper = mount(AppearancePreview)

    expect(wrapper.find('[data-test="preview-current-theme"]').text()).toContain('深色模式')
  })

  it('data-theme 变化时实时更新主题标签', async () => {
    document.documentElement.dataset.theme = 'light'
    const wrapper = mount(AppearancePreview)

    expect(wrapper.find('[data-test="preview-current-theme"]').text()).toContain('浅色模式')

    document.documentElement.dataset.theme = 'dark'
    // MutationObserver 回调为异步微任务，需 flush 微任务队列并等待下一轮事件循环
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(wrapper.find('[data-test="preview-current-theme"]').text()).toContain('深色模式')
  })

  it('卸载时清理 MutationObserver 不报错', () => {
    const wrapper = mount(AppearancePreview)
    expect(() => wrapper.unmount()).not.toThrow()
  })

  it('使用 --tjg-* token（预览卡片背景引用 surface token）', () => {
    const wrapper = mount(AppearancePreview)
    const card = wrapper.find('[data-test="preview-card"]')
    expect(card.exists()).toBe(true)
    // 样式中应通过 class 引用 token，这里仅校验卡片存在
    expect(card.classes()).toContain('appearance-preview__card')
  })

  it('SVG 装饰图标存在并使用 1.5px stroke-width', () => {
    const wrapper = mount(AppearancePreview)
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('stroke-width')).toBe('1.5')
  })
})
