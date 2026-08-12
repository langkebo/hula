import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import SpaceRoomGrid from '../SpaceRoomGrid.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/components/common/EmptyState.vue', () => ({
  default: defineComponent({
    name: 'EmptyState',
    props: { illustration: { type: String, default: '' }, title: { type: String, default: '' } },
    setup(props) {
      return () => h('div', { 'data-testid': 'empty-state-stub', 'data-illustration': props.illustration }, props.title)
    }
  })
}))

vi.mock('@/components/common/SkeletonBase.vue', () => ({
  default: defineComponent({
    name: 'SkeletonBase',
    props: {
      variant: { type: String, default: 'text' },
      width: { type: [String, Number], default: '100%' },
      height: { type: [String, Number], default: '14px' }
    },
    setup(props) {
      return () => h('div', { 'data-testid': 'skeleton-stub', 'data-variant': props.variant })
    }
  })
}))

const mountGrid = (props: Record<string, unknown> = {}) =>
  mount(SpaceRoomGrid, {
    props: {
      rooms: [],
      ...props
    }
  })

const sampleRooms = [
  { roomId: '!room-1:server', name: 'General', avatarUrl: undefined },
  { roomId: '!room-2:server', name: 'Random', avatarUrl: 'https://example.com/a.png' }
]

describe('SpaceRoomGrid', () => {
  it('renders the list container', () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    expect(wrapper.find('[data-testid="space-room-grid"]').exists()).toBe(true)
  })

  it('renders a list item for each room', () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    const items = wrapper.findAll('[data-testid="space-room-grid"] .space-room-grid__item')
    expect(items).toHaveLength(2)
  })

  it('renders room name in each item', () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    const names = wrapper.findAll('.space-room-grid__name')
    expect(names[0].text()).toBe('General')
    expect(names[1].text()).toBe('Random')
  })

  it('emits enter-room with roomId when item clicked', async () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    const items = wrapper.findAll('.space-room-grid__item')
    await items[0].trigger('click')
    expect(wrapper.emitted('enter-room')).toEqual([['!room-1:server']])
  })

  it('emits enter-room with roomId when enter button clicked', async () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    const buttons = wrapper.findAll('.space-room-grid__enter-btn')
    await buttons[1].trigger('click')
    expect(wrapper.emitted('enter-room')).toEqual([['!room-2:server']])
  })

  it('renders skeleton placeholders when loading is true', () => {
    const wrapper = mountGrid({ rooms: [], loading: true })
    const skeletons = wrapper.findAll('[data-testid="skeleton-stub"]')
    expect(skeletons.length).toBeGreaterThan(0)
    // No room items while loading
    expect(wrapper.findAll('.space-room-grid__item')).toHaveLength(0)
  })

  it('renders EmptyState with no-results illustration when rooms empty and not loading', () => {
    const wrapper = mountGrid({ rooms: [], loading: false })
    const empty = wrapper.find('[data-testid="empty-state-stub"]')
    expect(empty.exists()).toBe(true)
    expect(empty.attributes('data-illustration')).toBe('no-results')
  })

  it('does not render EmptyState when rooms present', () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    expect(wrapper.find('[data-testid="empty-state-stub"]').exists()).toBe(false)
  })

  it('does not render skeletons when not loading', () => {
    const wrapper = mountGrid({ rooms: sampleRooms, loading: false })
    expect(wrapper.findAll('[data-testid="skeleton-stub"]')).toHaveLength(0)
  })

  it('renders list layout with space-room-grid class', () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    const grid = wrapper.find('[data-testid="space-room-grid"]')
    expect(grid.classes()).toContain('space-room-grid')
  })

  it('renders avatar placeholder when no avatarUrl', () => {
    const wrapper = mountGrid({ rooms: [sampleRooms[0]] })
    const placeholder = wrapper.find('.space-room-grid__avatar-placeholder')
    expect(placeholder.exists()).toBe(true)
    expect(placeholder.text()).toBe('G')
  })

  it('renders avatar image when avatarUrl provided', () => {
    const wrapper = mountGrid({ rooms: [sampleRooms[1]] })
    const img = wrapper.find('.space-room-grid__avatar-img')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/a.png')
  })

  it('emits enter-room on Enter keydown', async () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    const items = wrapper.findAll('.space-room-grid__item')
    await items[0].trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('enter-room')).toEqual([['!room-1:server']])
  })
})
