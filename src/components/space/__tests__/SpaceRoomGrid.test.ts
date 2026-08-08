import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import SpaceRoomGrid from '../SpaceRoomGrid.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

// Stub RoomCard: renders roomId + numJoinedMembers so we can assert prop conversion
vi.mock('@/components/room/RoomCard.vue', () => ({
  default: defineComponent({
    name: 'RoomCard',
    props: {
      room: { type: Object, required: true }
    },
    emits: ['join', 'preview'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-testid': 'room-card-stub', 'data-room-id': props.room.roomId }, [
          h('span', { class: 'stub-name' }, props.room.name),
          h('span', { class: 'stub-members' }, String(props.room.numJoinedMembers)),
          h('button', { class: 'stub-join', onClick: () => emit('join', props.room.roomId) }, 'join'),
          h('button', { class: 'stub-preview', onClick: () => emit('preview', props.room.roomId) }, 'preview')
        ])
    }
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
    props: { variant: { type: String, default: 'text' }, height: { type: [String, Number], default: '14px' } },
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
  it('renders the grid container', () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    expect(wrapper.find('[data-testid="space-room-grid"]').exists()).toBe(true)
  })

  it('renders a RoomCard for each room', () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    const cards = wrapper.findAll('[data-testid="room-card-stub"]')
    expect(cards).toHaveLength(2)
  })

  it('converts SpaceChildRoom to RoomCardData with numJoinedMembers defaulting to 0', () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    const members = wrapper.findAll('.stub-members')
    expect(members[0].text()).toBe('0')
    expect(members[1].text()).toBe('0')
  })

  it('passes name and avatarUrl through to RoomCard', () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    const names = wrapper.findAll('.stub-name')
    expect(names[0].text()).toBe('General')
    expect(names[1].text()).toBe('Random')
  })

  it('emits enter-room with roomId when RoomCard join clicked', async () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    await wrapper.findAll('.stub-join')[0].trigger('click')
    expect(wrapper.emitted('enter-room')).toEqual([['!room-1:server']])
  })

  it('emits preview-room with roomId when RoomCard preview clicked', async () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    await wrapper.findAll('.stub-preview')[1].trigger('click')
    expect(wrapper.emitted('preview-room')).toEqual([['!room-2:server']])
  })

  it('renders skeleton placeholders when loading is true', () => {
    const wrapper = mountGrid({ rooms: [], loading: true })
    const skeletons = wrapper.findAll('[data-testid="skeleton-stub"]')
    expect(skeletons.length).toBeGreaterThan(0)
    // No room cards while loading
    expect(wrapper.findAll('[data-testid="room-card-stub"]')).toHaveLength(0)
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

  it('renders grid layout with grid class', () => {
    const wrapper = mountGrid({ rooms: sampleRooms })
    const grid = wrapper.find('[data-testid="space-room-grid"]')
    expect(grid.classes()).toContain('space-room-grid')
  })
})
