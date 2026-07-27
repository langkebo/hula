import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PublicRoomDiscovery from '../PublicRoomDiscovery.vue'

interface RoomData {
  roomId: string
  name: string
  topic?: string
  numJoinedMembers: number
  avatarUrl?: string
}

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const NInput = defineComponent({
    name: 'NInput',
    props: {
      value: { type: String, default: '' },
      placeholder: { type: String, default: '' },
      clearable: { type: Boolean, default: false }
    },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          type: 'text',
          value: props.value,
          placeholder: props.placeholder,
          onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
        })
    }
  })

  const NSpin = defineComponent({
    name: 'NSpin',
    props: { show: { type: Boolean, default: false } },
    setup(props, { slots }) {
      return () => h('div', { class: ['n-spin', { 'n-spin--loading': props.show }] }, slots.default?.())
    }
  })

  const NEmpty = defineComponent({
    name: 'NEmpty',
    props: { description: { type: String, default: '' } },
    setup(props) {
      return () => h('div', { class: 'n-empty', 'data-testid': 'empty-state' }, props.description)
    }
  })

  const NCard = defineComponent({
    name: 'NCard',
    props: { size: { type: String, default: 'medium' } },
    setup(_, { slots }) {
      return () => h('div', { class: 'n-card' }, slots.default?.())
    }
  })

  const NButton = defineComponent({
    name: 'NButton',
    props: {
      type: { type: String, default: 'default' },
      size: { type: String, default: 'medium' },
      secondary: { type: Boolean, default: false }
    },
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
    }
  })

  return { NInput, NSpin, NEmpty, NCard, NButton }
})

const sampleRooms: RoomData[] = [
  {
    roomId: '!room1:matrix.test',
    name: 'Matrix Chat',
    topic: 'A place to discuss Matrix protocol',
    numJoinedMembers: 42,
    avatarUrl: undefined
  },
  {
    roomId: '!room2:matrix.test',
    name: 'Vue Fans',
    topic: 'Vue.js enthusiasts',
    numJoinedMembers: 128,
    avatarUrl: undefined
  }
]

const mountComponent = (props: Partial<{ rooms: RoomData[]; loading: boolean }> = {}) =>
  mount(PublicRoomDiscovery, {
    props: {
      rooms: sampleRooms,
      loading: false,
      ...props
    }
  })

describe('PublicRoomDiscovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders a search input', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[data-testid="search-input"]').exists()).toBe(true)
  })

  it('renders a list of room cards', () => {
    const wrapper = mountComponent()
    const cards = wrapper.findAll('[data-testid="room-card"]')
    expect(cards).toHaveLength(2)
  })

  it('emits search event with 300ms debounce when typing', async () => {
    vi.useFakeTimers()
    const wrapper = mountComponent()
    const input = wrapper.find('[data-testid="search-input"]')

    await input.setValue('matrix')

    expect(wrapper.emitted('search')).toBeUndefined()

    vi.advanceTimersByTime(299)
    expect(wrapper.emitted('search')).toBeUndefined()

    vi.advanceTimersByTime(1)
    expect(wrapper.emitted('search')).toEqual([['matrix']])
  })

  it('renders room name, member count and topic in each card', () => {
    const wrapper = mountComponent()
    const firstCard = wrapper.findAll('[data-testid="room-card"]')[0]!
    const text = firstCard.text()
    expect(text).toContain('Matrix Chat')
    expect(text).toContain('42')
    expect(text).toContain('A place to discuss Matrix protocol')
  })

  it('emits join event with roomId when join button is clicked', async () => {
    const wrapper = mountComponent()
    const firstCard = wrapper.findAll('[data-testid="room-card"]')[0]!
    await firstCard.find('button').trigger('click')
    expect(wrapper.emitted('join')).toEqual([['!room1:matrix.test']])
  })

  it('renders empty state when rooms list is empty', () => {
    const wrapper = mountComponent({ rooms: [] })
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="room-card"]')).toHaveLength(0)
  })

  it('shows loading state when loading prop is true', () => {
    const wrapper = mountComponent({ loading: true })
    expect(wrapper.find('.n-spin').classes()).toContain('n-spin--loading')
  })

  it('does not show loading state when loading prop is false', () => {
    const wrapper = mountComponent({ loading: false })
    expect(wrapper.find('.n-spin').classes()).not.toContain('n-spin--loading')
  })

  it('has role=region accessibility attribute', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[role="region"]').exists()).toBe(true)
  })
})
