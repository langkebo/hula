import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import GuestModeBanner from '../GuestModeBanner.vue'

describe('GuestModeBanner — 访客模式横幅 (§8.6)', () => {
  it('visible=true 时渲染横幅', () => {
    const wrapper = mount(GuestModeBanner, {
      props: { visible: true }
    })
    expect(wrapper.find('.guest-mode-banner').exists()).toBe(true)
  })

  it('visible=false 时不渲染横幅', () => {
    const wrapper = mount(GuestModeBanner, {
      props: { visible: false }
    })
    expect(wrapper.find('.guest-mode-banner').exists()).toBe(false)
  })

  it('显示访客模式提示文案', () => {
    const wrapper = mount(GuestModeBanner, {
      props: { visible: true }
    })
    expect(wrapper.text()).toContain('访客')
    expect(wrapper.text()).toContain('功能受限')
  })

  it('点击登录按钮触发 upgrade 事件', async () => {
    const wrapper = mount(GuestModeBanner, {
      props: { visible: true }
    })
    await wrapper.find('[data-testid="guest-upgrade-btn"]').trigger('click')
    expect(wrapper.emitted('upgrade')).toBeTruthy()
  })

  it('点击退出按钮触发 exit 事件', async () => {
    const wrapper = mount(GuestModeBanner, {
      props: { visible: true }
    })
    await wrapper.find('[data-testid="guest-exit-btn"]').trigger('click')
    expect(wrapper.emitted('exit')).toBeTruthy()
  })

  it('横幅有可访问性 role=banner', () => {
    const wrapper = mount(GuestModeBanner, {
      props: { visible: true }
    })
    expect(wrapper.find('.guest-mode-banner').attributes('role')).toBe('banner')
  })

  it('显示访客 userId（当提供时）', () => {
    const wrapper = mount(GuestModeBanner, {
      props: { visible: true, guestUserId: '@guest123:server' }
    })
    expect(wrapper.text()).toContain('@guest123:server')
  })

  it('横幅使用警告色背景', () => {
    const wrapper = mount(GuestModeBanner, {
      props: { visible: true }
    })
    const banner = wrapper.find('.guest-mode-banner')
    expect(banner.attributes('style') ?? '').toContain('--hula-color-warning-100')
  })
})
