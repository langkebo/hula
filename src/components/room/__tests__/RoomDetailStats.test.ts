import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import RoomDetailStats from '../RoomDetailStats.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mountStats = (props: Partial<Record<string, number>> = {}) =>
  mount(RoomDetailStats, {
    props: {
      memberCount: 2032,
      onlineCount: 892,
      announcementCount: 0,
      ...props
    }
  })

describe('RoomDetailStats', () => {
  it('renders three stat cards', () => {
    const wrapper = mountStats()
    const cards = wrapper.findAll('[role="listitem"]')
    expect(cards).toHaveLength(3)
  })

  it('renders member count with correct value and label', () => {
    const wrapper = mountStats()
    const memberCard = wrapper.find('[data-testid="stat-card-members"]')
    expect(memberCard.text()).toContain('2032')
    expect(memberCard.text()).toContain('room.detail.members')
  })

  it('renders online count with correct value and label', () => {
    const wrapper = mountStats()
    const onlineCard = wrapper.find('[data-testid="stat-card-online"]')
    expect(onlineCard.text()).toContain('892')
    expect(onlineCard.text()).toContain('room.detail.online')
  })

  it('renders announcement count with correct value and label', () => {
    const wrapper = mountStats({ announcementCount: 5 })
    const announcementCard = wrapper.find('[data-testid="stat-card-announcements"]')
    expect(announcementCard.text()).toContain('5')
    expect(announcementCard.text()).toContain('room.detail.announcement')
  })

  it('renders zero values correctly', () => {
    const wrapper = mountStats({ memberCount: 0, onlineCount: 0, announcementCount: 0 })
    const cards = wrapper.findAll('[data-testid="stat-card-value"]')
    cards.forEach((card) => {
      expect(card.text()).toContain('0')
    })
  })

  it('renders stat grid container with role', () => {
    const wrapper = mountStats()
    expect(wrapper.find('[data-testid="stat-grid"]').attributes('role')).toBe('list')
  })
})
