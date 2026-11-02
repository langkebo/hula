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
