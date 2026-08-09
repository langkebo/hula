import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { RoomMembershipFilter } from '@/composables/room/useRoomMembershipFilter'
import RoomMembershipTabs from '../RoomMembershipTabs.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mountTabs = (
  props: Partial<{ modelValue: RoomMembershipFilter; joinedCount: number; createdCount: number }> = {}
) =>
  mount(RoomMembershipTabs, {
    props: { modelValue: 'all' as RoomMembershipFilter, ...props }
  })

describe('RoomMembershipTabs', () => {
  it('renders all three tab buttons', () => {
    const wrapper = mountTabs()
    const tabs = wrapper.findAll('[data-testid="membership-tab"]')
    expect(tabs).toHaveLength(3)
    expect(tabs[0].text()).toContain('room.tab.all')
    expect(tabs[1].text()).toContain('room.tab.joined')
    expect(tabs[2].text()).toContain('room.tab.created')
  })

  it('marks the active tab with aria-selected', () => {
    const wrapper = mountTabs({ modelValue: 'joined' })
    const tabs = wrapper.findAll('[data-testid="membership-tab"]')
    expect(tabs[0].attributes('aria-selected')).toBe('false')
    expect(tabs[1].attributes('aria-selected')).toBe('true')
    expect(tabs[2].attributes('aria-selected')).toBe('false')
  })

  it('emits update:modelValue with "all" when all tab clicked', async () => {
    const wrapper = mountTabs({ modelValue: 'joined' })
    await wrapper.findAll('[data-testid="membership-tab"]')[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['all']])
  })

  it('emits update:modelValue with "joined" when joined tab clicked', async () => {
    const wrapper = mountTabs({ modelValue: 'all' })
    await wrapper.findAll('[data-testid="membership-tab"]')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['joined']])
  })

  it('emits update:modelValue with "created" when created tab clicked', async () => {
    const wrapper = mountTabs({ modelValue: 'all' })
    await wrapper.findAll('[data-testid="membership-tab"]')[2].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['created']])
  })

  it('does not emit when clicking the already active tab', async () => {
    const wrapper = mountTabs({ modelValue: 'all' })
    await wrapper.findAll('[data-testid="membership-tab"]')[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('renders joined count badge when joinedCount > 0', () => {
    const wrapper = mountTabs({ modelValue: 'all', joinedCount: 5 })
    const badges = wrapper.findAll('[data-testid="membership-tab-count"]')
    expect(badges.length).toBeGreaterThanOrEqual(1)
    expect(badges[0].text()).toContain('5')
  })

  it('renders role tablist on the container', () => {
    const wrapper = mountTabs()
    expect(wrapper.find('[data-testid="membership-tabs"]').attributes('role')).toBe('tablist')
  })
})
