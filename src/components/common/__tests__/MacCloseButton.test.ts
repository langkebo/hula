import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MacCloseButton from '../MacCloseButton.vue'

describe('MacCloseButton', () => {
  it('renders a circular button with SVG close icon', () => {
    const wrapper = mount(MacCloseButton, {
      global: {
        stubs: { 'n-icon': true }
      }
    })
    expect(wrapper.find('.mac-close-button').exists()).toBe(true)
    expect(wrapper.find('svg').exists()).toBe(true)
  })

  it('applies danger color by default', () => {
    const wrapper = mount(MacCloseButton, {
      global: { stubs: { 'n-icon': true } }
    })
    expect(wrapper.classes()).toContain('mac-close-button--danger')
  })

  it('applies primary color when specified', () => {
    const wrapper = mount(MacCloseButton, {
      props: { color: 'primary' },
      global: { stubs: { 'n-icon': true } }
    })
    expect(wrapper.classes()).toContain('mac-close-button--primary')
  })

  it('emits click event when clicked', async () => {
    const wrapper = mount(MacCloseButton, {
      global: { stubs: { 'n-icon': true } }
    })
    await wrapper.trigger('click')
    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('accepts extra class names', () => {
    const wrapper = mount(MacCloseButton, {
      attrs: { class: 'custom-position' },
      global: { stubs: { 'n-icon': true } }
    })
    expect(wrapper.classes()).toContain('custom-position')
  })
})
