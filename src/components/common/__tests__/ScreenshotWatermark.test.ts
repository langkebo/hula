import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ScreenshotWatermark from '../ScreenshotWatermark.vue'

describe('ScreenshotWatermark', () => {
  it('does not render when disabled', () => {
    const wrapper = mount(ScreenshotWatermark, {
      props: { userId: '@alice:server', userName: 'Alice', enabled: false }
    })
    expect(wrapper.find('[data-test="screenshot-watermark"]').exists()).toBe(false)
  })

  it('renders watermark layer when enabled', () => {
    const wrapper = mount(ScreenshotWatermark, {
      props: { userId: '@alice:server', userName: 'Alice', enabled: true }
    })
    expect(wrapper.find('[data-test="screenshot-watermark"]').exists()).toBe(true)
  })

  it('contains user name in watermark text', () => {
    const wrapper = mount(ScreenshotWatermark, {
      props: { userId: '@alice:server', userName: 'Alice', enabled: true }
    })
    expect(wrapper.text()).toContain('Alice')
  })
})
