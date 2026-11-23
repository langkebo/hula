import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import LoginBottomBar from '../LoginBottomBar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    NPopover: defineComponent({
      name: 'NPopover',
      setup(_, { slots }) {
        return () => h('div', [slots.trigger?.(), slots.default?.()])
      }
    }),
    NFlex: defineComponent({
      name: 'NFlex',
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      }
    })
  }
})

const mountComponent = (props: Record<string, unknown> = {}) =>
  mount(LoginBottomBar, {
    props: { mode: 'manual', ...props }
  })

describe('LoginBottomBar guest entry', () => {
  it('renders the guest entry when the homeserver supports guests', () => {
    const wrapper = mountComponent({ guestSupported: true })

    expect(wrapper.find('[data-test="guest-login-btn"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="guest-login-btn"]').text()).toBe('login.guest')
  })

  it('hides the guest entry when guests are unsupported', () => {
    const wrapper = mountComponent({ guestSupported: false })

    expect(wrapper.find('[data-test="guest-login-btn"]').exists()).toBe(false)
  })

  it('hides the guest entry when support is not yet known', () => {
    const wrapper = mountComponent()

    expect(wrapper.find('[data-test="guest-login-btn"]').exists()).toBe(false)
  })

  it('emits guest-login when the entry is clicked', async () => {
    const wrapper = mountComponent({ guestSupported: true })

    await wrapper.find('[data-test="guest-login-btn"]').trigger('click')

    expect(wrapper.emitted('guest-login')).toHaveLength(1)
  })
})

describe('LoginBottomBar register entry', () => {
  it('renders exactly one register entry in manual mode', () => {
    const wrapper = mountComponent({ mode: 'manual' })

    // 注册入口必须直接可见（曾长期藏在"更多"下拉里，用户反映"没有注册按钮"）
    const entries = wrapper.findAll('[data-test="login-register-entry"]')
    expect(entries).toHaveLength(1)
    // 文字经 formatBottomText 截断（mock 下为 login.r...），真实中文"注册账号"不截；只校验非空
    expect(entries[0].text()).toContain('login')
  })

  it('emits open-register when the entry is clicked', async () => {
    const wrapper = mountComponent({ mode: 'manual' })

    await wrapper.find('[data-test="login-register-entry"]').trigger('click')

    expect(wrapper.emitted('open-register')).toHaveLength(1)
  })

  it('does not render the register entry in auto mode', () => {
    const wrapper = mountComponent({ mode: 'auto' })

    expect(wrapper.find('[data-test="login-register-entry"]').exists()).toBe(false)
  })
})
