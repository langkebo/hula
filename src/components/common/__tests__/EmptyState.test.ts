import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import EmptyState from '../EmptyState.vue'

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    template: '<svg class="iconify-icon" />'
  }
}))

describe('EmptyState', () => {
  it('renders iconify icon by default', () => {
    const wrapper = mount(EmptyState, {
      props: { icon: 'mdi:inbox-outline', title: '暂无数据' }
    })
    expect(wrapper.find('.iconify-icon').exists()).toBe(true)
    expect(wrapper.find('[data-illustration]').exists()).toBe(false)
  })

  it('renders inline SVG illustration when illustration prop is set', () => {
    const wrapper = mount(EmptyState, {
      props: { illustration: 'no-conversations', title: '开始新对话' }
    })
    expect(wrapper.find('.iconify-icon').exists()).toBe(false)
    const svg = wrapper.find('[data-illustration="no-conversations"]')
    expect(svg.exists()).toBe(true)
    expect(svg.element.tagName.toLowerCase()).toBe('svg')
  })

  it('renders no-conversations illustration with chat bubble SVG', () => {
    const wrapper = mount(EmptyState, {
      props: { illustration: 'no-conversations' }
    })
    const svg = wrapper.find('[data-illustration="no-conversations"]')
    expect(svg.exists()).toBe(true)
    // Should contain a path or shape representing a chat bubble
    expect(svg.findAll('path, circle, rect').length).toBeGreaterThan(0)
  })

  it('renders no-friends illustration', () => {
    const wrapper = mount(EmptyState, {
      props: { illustration: 'no-friends' }
    })
    expect(wrapper.find('[data-illustration="no-friends"]').exists()).toBe(true)
  })

  it('renders no-spaces illustration', () => {
    const wrapper = mount(EmptyState, {
      props: { illustration: 'no-spaces' }
    })
    expect(wrapper.find('[data-illustration="no-spaces"]').exists()).toBe(true)
  })

  it('renders no-results illustration with magnifier SVG', () => {
    const wrapper = mount(EmptyState, {
      props: { illustration: 'no-results' }
    })
    const svg = wrapper.find('[data-illustration="no-results"]')
    expect(svg.exists()).toBe(true)
    expect(svg.findAll('path, circle, line').length).toBeGreaterThan(0)
  })

  it('renders action slot content', () => {
    const wrapper = mount(EmptyState, {
      props: { illustration: 'no-conversations', title: '无会话' },
      slots: {
        actions: '<button class="test-btn">开始新对话</button>'
      }
    })
    expect(wrapper.find('.test-btn').exists()).toBe(true)
    expect(wrapper.text()).toContain('开始新对话')
  })

  it('uses brand quaternary text color for illustration stroke', () => {
    const wrapper = mount(EmptyState, {
      props: { illustration: 'no-conversations' }
    })
    const svg = wrapper.find('[data-illustration="no-conversations"]')
    expect(svg.attributes('stroke')).toBe('var(--hula-text-quaternary)')
  })
})
