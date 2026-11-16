import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PartialStateBanner from '../PartialStateBanner.vue'

describe('PartialStateBanner', () => {
  it('renders the message', () => {
    const wrapper = mount(PartialStateBanner, {
      props: { message: '2 项数据获取失败，可稍后重试' }
    })
    expect(wrapper.text()).toContain('2 项数据获取失败，可稍后重试')
  })

  it('renders detail when provided', () => {
    const wrapper = mount(PartialStateBanner, {
      props: { message: '部分数据缺失', detail: '成员列表加载失败' }
    })
    expect(wrapper.text()).toContain('成员列表加载失败')
  })

  it('does not render detail element when detail is omitted', () => {
    const wrapper = mount(PartialStateBanner, {
      props: { message: '部分数据缺失' }
    })
    expect(wrapper.find('.partial-state__detail').exists()).toBe(false)
  })

  it('uses role="status" and aria-live="polite" because main content stays usable', () => {
    const wrapper = mount(PartialStateBanner, {
      props: { message: '部分数据缺失' }
    })
    expect(wrapper.attributes('role')).toBe('status')
    expect(wrapper.attributes('aria-live')).toBe('polite')
  })

  it('renders retry button when retryText is provided', () => {
    const wrapper = mount(PartialStateBanner, {
      props: { message: '部分数据缺失', retryText: '重试' }
    })
    const btn = wrapper.find('[data-testid="partial-retry"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('重试')
  })

  it('does not render retry button when retryText is omitted', () => {
    const wrapper = mount(PartialStateBanner, {
      props: { message: '部分数据缺失' }
    })
    expect(wrapper.find('[data-testid="partial-retry"]').exists()).toBe(false)
  })

  it('emits retry when the retry button is clicked', async () => {
    const wrapper = mount(PartialStateBanner, {
      props: { message: '部分数据缺失', retryText: '重试' }
    })
    await wrapper.find('[data-testid="partial-retry"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('applies compact class when compact is true', () => {
    const wrapper = mount(PartialStateBanner, {
      props: { message: '部分数据缺失', compact: true }
    })
    expect(wrapper.classes()).toContain('partial-state--compact')
  })

  it('does not apply compact class by default', () => {
    const wrapper = mount(PartialStateBanner, {
      props: { message: '部分数据缺失' }
    })
    expect(wrapper.classes()).not.toContain('partial-state--compact')
  })

  it('renders a 1.5px stroke SVG using warning token', () => {
    const wrapper = mount(PartialStateBanner, {
      props: { message: '部分数据缺失' }
    })
    const svg = wrapper.find('[data-illustration="partial-warning"]')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('stroke-width')).toBe('1.5')
    expect(svg.attributes('stroke')).toBe('var(--tjg-color-warning-700)')
    expect(svg.findAll('path, circle, line').length).toBeGreaterThan(0)
  })
})
