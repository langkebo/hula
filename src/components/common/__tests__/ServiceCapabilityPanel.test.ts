import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { CapabilityItem } from '@/types/capability'
import ServiceCapabilityPanel from '../ServiceCapabilityPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    template: '<svg class="iconify-icon" />'
  }
}))

const items: CapabilityItem[] = [
  { key: 'voice', label: 'Voice message', state: 'ready' },
  { key: 'search', label: 'Search', state: 'degraded', hint: 'Partial index' },
  { key: 'calls', label: 'Calls', state: 'unavailable' }
]

describe('ServiceCapabilityPanel', () => {
  it('renders one row per capability item', () => {
    const wrapper = mount(ServiceCapabilityPanel, { props: { items } })

    expect(wrapper.findAll('.capability-panel__item')).toHaveLength(3)
    expect(wrapper.find('[data-key="search"]').text()).toContain('Partial index')
  })

  it('only offers retry for non-ready capabilities', async () => {
    const wrapper = mount(ServiceCapabilityPanel, { props: { items } })

    expect(wrapper.find('[data-key="voice"] [data-test="capability-retry"]').exists()).toBe(false)

    await wrapper.find('[data-key="search"] [data-test="capability-retry"]').trigger('click')
    expect(wrapper.emitted('retry')).toEqual([['search']])
  })

  it('emits openSettings with the capability key', async () => {
    const wrapper = mount(ServiceCapabilityPanel, { props: { items } })

    await wrapper.find('[data-key="calls"] [data-test="capability-settings"]').trigger('click')

    expect(wrapper.emitted('openSettings')).toEqual([['calls']])
  })

  it('renders the error state and emits a whole-list retry', async () => {
    const wrapper = mount(ServiceCapabilityPanel, { props: { items, error: 'network down' } })

    expect(wrapper.text()).toContain('common.capability.error_title')
    expect(wrapper.text()).toContain('network down')

    await wrapper.find('[data-testid="error-retry"]').trigger('click')
    expect(wrapper.emitted('retry')).toEqual([['']])
  })

  it('renders the empty state when no capability is provided', () => {
    const wrapper = mount(ServiceCapabilityPanel)

    expect(wrapper.find('[data-test="service-capability-panel"]').text()).toContain('common.capability.empty_title')
    expect(wrapper.find('[data-illustration="no-results"]').exists()).toBe(true)
  })

  it('collapses long lists behind a toggle', async () => {
    const many: CapabilityItem[] = Array.from({ length: 7 }, (_, index) => ({
      key: `cap-${index}`,
      label: `Capability ${index}`,
      state: 'ready' as const
    }))
    const wrapper = mount(ServiceCapabilityPanel, { props: { items: many } })

    expect(wrapper.findAll('.capability-panel__item')).toHaveLength(5)
    expect(wrapper.find('[data-test="capability-toggle"]').text()).toBe('common.capability.expand')

    await wrapper.find('[data-test="capability-toggle"]').trigger('click')

    expect(wrapper.findAll('.capability-panel__item')).toHaveLength(7)
    expect(wrapper.find('[data-test="capability-toggle"]').text()).toBe('common.capability.collapse')
  })
})
