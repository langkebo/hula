import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ErrorState from '../ErrorState.vue'

describe('ErrorState', () => {
  it('renders the title', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '加载失败' }
    })
    expect(wrapper.text()).toContain('加载失败')
  })

  it('renders the message when provided', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '加载失败', message: '请检查网络后重试' }
    })
    expect(wrapper.text()).toContain('请检查网络后重试')
  })

  it('does not render message element when message is omitted', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '加载失败' }
    })
    expect(wrapper.find('.error-state__message').exists()).toBe(false)
  })

  it('renders generic-error illustration by default', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '出错了' }
    })
    const svg = wrapper.find('[data-illustration="generic-error"]')
    expect(svg.exists()).toBe(true)
    expect(svg.element.tagName.toLowerCase()).toBe('svg')
  })

  it('renders network-error illustration', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '网络异常', illustration: 'network-error' }
    })
    expect(wrapper.find('[data-illustration="network-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-illustration="generic-error"]').exists()).toBe(false)
  })

  it('renders server-error illustration', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '服务异常', illustration: 'server-error' }
    })
    expect(wrapper.find('[data-illustration="server-error"]').exists()).toBe(true)
  })

  it('each illustration SVG contains drawable shapes', () => {
    const types = ['generic-error', 'network-error', 'server-error'] as const
    for (const type of types) {
      const wrapper = mount(ErrorState, {
        props: { title: '出错了', illustration: type }
      })
      const svg = wrapper.find(`[data-illustration="${type}"]`)
      expect(svg.findAll('path, circle, rect, line').length).toBeGreaterThan(0)
    }
  })

  it('uses 1.5 stroke-width on illustrations', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '出错了', illustration: 'generic-error' }
    })
    const svg = wrapper.find('[data-illustration="generic-error"]')
    expect(svg.attributes('stroke-width')).toBe('1.5')
  })

  it('renders retry button when retryText is provided', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '加载失败', retryText: '重试' }
    })
    const btn = wrapper.find('[data-testid="error-retry"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('重试')
  })

  it('does not render retry button when retryText is omitted', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '加载失败' }
    })
    expect(wrapper.find('[data-testid="error-retry"]').exists()).toBe(false)
  })

  it('emits retry event when retry button is clicked', async () => {
    const wrapper = mount(ErrorState, {
      props: { title: '加载失败', retryText: '重试' }
    })
    const btn = wrapper.find('[data-testid="error-retry"]')
    await btn.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('renders actions slot content', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '加载失败' },
      slots: {
        actions: '<a class="custom-link" href="#">联系客服</a>'
      }
    })
    expect(wrapper.find('.custom-link').exists()).toBe(true)
    expect(wrapper.text()).toContain('联系客服')
  })

  it('applies compact class when compact prop is true', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '加载失败', compact: true }
    })
    expect(wrapper.classes()).toContain('error-state--compact')
  })

  it('does not apply compact class by default', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '加载失败' }
    })
    expect(wrapper.classes()).not.toContain('error-state--compact')
  })

  it('sets role="alert" for accessibility', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '加载失败' }
    })
    expect(wrapper.attributes('role')).toBe('alert')
  })

  it('sets aria-live="assertive" for screen readers', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '加载失败' }
    })
    expect(wrapper.attributes('aria-live')).toBe('assertive')
  })

  it('uses --tjg-color-danger-500 token for illustration stroke color', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '出错了', illustration: 'generic-error' }
    })
    const svg = wrapper.find('[data-illustration="generic-error"]')
    expect(svg.attributes('stroke')).toBe('var(--tjg-color-danger-500)')
  })

  it('renders both retry button and actions slot when both are provided', () => {
    const wrapper = mount(ErrorState, {
      props: { title: '加载失败', retryText: '重试' },
      slots: {
        actions: '<a class="custom-link" href="#">联系客服</a>'
      }
    })
    const btn = wrapper.find('[data-testid="error-retry"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('重试')
    expect(wrapper.find('.custom-link').exists()).toBe(true)
    expect(wrapper.text()).toContain('联系客服')
  })
})
