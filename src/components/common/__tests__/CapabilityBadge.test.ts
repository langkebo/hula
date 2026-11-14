import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CapabilityBadge from '../CapabilityBadge.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('CapabilityBadge', () => {
  it('renders the label and state text for a ready capability', () => {
    const wrapper = mount(CapabilityBadge, {
      props: { state: 'ready', label: 'Voice message' }
    })

    expect(wrapper.find('[data-test="capability-badge"]').text()).toContain('Voice message')
    expect(wrapper.find('[data-test="capability-badge"]').text()).toContain('common.capability.ready')
    expect(wrapper.find('[data-test="capability-badge-details"]').exists()).toBe(false)
  })

  it('exposes the badge as a status region with an inline SVG marker', () => {
    const wrapper = mount(CapabilityBadge, { props: { state: 'degraded', label: 'Search' } })

    const badge = wrapper.find('[data-test="capability-badge"]')
    expect(badge.attributes('role')).toBe('status')
    expect(badge.find('svg').exists()).toBe(true)
  })

  it('only offers details expansion when the capability is unavailable', async () => {
    const wrapper = mount(CapabilityBadge, { props: { state: 'unavailable', label: 'Calls' } })

    expect(wrapper.find('[data-test="capability-badge-hint"]').exists()).toBe(false)

    const details = wrapper.find('[data-test="capability-badge-details"]')
    expect(details.attributes('aria-expanded')).toBe('false')

    await details.trigger('click')

    const hint = wrapper.find('[data-test="capability-badge-hint"]')
    expect(hint.exists()).toBe(true)
    expect(hint.text()).toBe('common.capability.unavailable_hint')
    expect(details.attributes('aria-expanded')).toBe('true')
    expect(details.attributes('aria-controls')).toBe(hint.attributes('id'))
  })

  it('renders slot content as the hint when provided', async () => {
    const wrapper = mount(CapabilityBadge, {
      props: { state: 'unavailable', label: 'Calls' },
      slots: { hint: 'Homeserver disabled calls' }
    })

    await wrapper.find('[data-test="capability-badge-details"]').trigger('click')

    expect(wrapper.find('[data-test="capability-badge-hint"]').text()).toBe('Homeserver disabled calls')
  })

  it('applies the compact modifier when asked', () => {
    const wrapper = mount(CapabilityBadge, { props: { state: 'ready', label: 'Voice', compact: true } })

    expect(wrapper.find('[data-test="capability-badge"]').classes()).toContain('capability-badge--compact')
  })
})
