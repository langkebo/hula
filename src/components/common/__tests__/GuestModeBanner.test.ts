import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import GuestModeBanner from '../GuestModeBanner.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('GuestModeBanner', () => {
  it('renders the guest notice and the upgrade entry', () => {
    const wrapper = mount(GuestModeBanner)

    expect(wrapper.find('[data-test="guest-mode-banner"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('guest.banner.text')
    expect(wrapper.find('[data-test="guest-upgrade-entry"]').text()).toBe('guest.banner.upgrade')
  })

  it('emits upgrade when the entry is clicked', async () => {
    const wrapper = mount(GuestModeBanner)

    await wrapper.find('[data-test="guest-upgrade-entry"]').trigger('click')

    expect(wrapper.emitted('upgrade')).toHaveLength(1)
  })

  it('exposes the banner as a polite live region for screen readers', () => {
    const wrapper = mount(GuestModeBanner)

    expect(wrapper.find('[data-test="guest-mode-banner"]').attributes('role')).toBe('status')
    expect(wrapper.find('[data-test="guest-mode-banner"]').attributes('aria-live')).toBe('polite')
  })
})
