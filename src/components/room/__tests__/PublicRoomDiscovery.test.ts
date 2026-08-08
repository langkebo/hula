import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import PublicRoomDiscovery from '../PublicRoomDiscovery.vue'

interface RoomData {
  roomId: string
  name: string
  topic?: string
  numJoinedMembers: number
  avatarUrl?: string
  isFederated?: boolean
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

// Stub RoomCard: renders a room-card node with a join button; emits join/preview
vi.mock('../RoomCard.vue', () => ({
  default: defineComponent({
    name: 'RoomCard',
    props: { room: { type: Object as () => RoomData, required: true } },
    emits: ['join', 'preview'],
    setup(props, { emit }) {
      return () =>
        h(
          'div',
          {
            'data-testid': 'room-card',
            onClick: () => emit('preview', props.room.roomId)
          },
          [
            h('span', { class: 'room-card__name' }, props.room.name),
            h('span', { class: 'room-card__members' }, String(props.room.numJoinedMembers)),
            props.room.topic ? h('span', { class: 'room-card__topic' }, props.room.topic) : null,
            h(
              'button',
              {
                'data-testid': 'room-join-btn',
                onClick: (event: Event) => {
                  event.stopPropagation()
                  emit('join', props.room.roomId)
                }
              },
              'join'
            )
          ]
        )
    }
  })
}))

// Stub RoomPreviewDialog: renders dialog node with join/cancel buttons
vi.mock('../RoomPreviewDialog.vue', () => ({
  default: defineComponent({
    name: 'RoomPreviewDialog',
    props: {
      visible: { type: Boolean, default: false },
      room: { type: Object as () => RoomData | null, default: null },
      requireReason: { type: Boolean, default: false },
      loading: { type: Boolean, default: false }
    },
    emits: ['update:visible', 'join', 'cancel'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-testid': 'room-preview-dialog' }, [
          h(
            'button',
            { 'data-testid': 'dialog-join-btn', onClick: () => emit('join', props.room?.roomId, undefined) },
            'join'
          ),
          h(
            'button',
            {
              'data-testid': 'dialog-cancel-btn',
              onClick: () => {
                emit('cancel')
                emit('update:visible', false)
              }
            },
            'cancel'
          )
        ])
    }
  })
}))

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
          'data-testid': 'search-input',
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

  return { NInput, NSpin, NEmpty }
})

const sampleRooms: RoomData[] = [
  {
    roomId: '!room1:matrix.test',
    name: 'Matrix Chat',
    topic: 'A place to discuss Matrix protocol',
    numJoinedMembers: 42,
    avatarUrl: undefined,
    isFederated: false
  },
  {
    roomId: '!room2:matrix.test',
    name: 'Vue Fans',
    topic: 'Vue.js enthusiasts',
    numJoinedMembers: 128,
    avatarUrl: undefined,
    isFederated: true
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

  it('opens preview dialog when a card join button is clicked', async () => {
    const wrapper = mountComponent()
    const dialog = wrapper.findComponent({ name: 'RoomPreviewDialog' })
    // initially not visible
    expect(dialog.props('visible')).toBe(false)

    const firstCard = wrapper.findAll('[data-testid="room-card"]')[0]!
    await firstCard.find('[data-testid="room-join-btn"]').trigger('click')

    expect(dialog.props('visible')).toBe(true)
    expect(dialog.props('room')?.roomId).toBe('!room1:matrix.test')
  })

  it('emits join with roomId when preview dialog confirms join', async () => {
    const wrapper = mountComponent()
    const firstCard = wrapper.findAll('[data-testid="room-card"]')[0]!
    await firstCard.find('[data-testid="room-join-btn"]').trigger('click')

    await wrapper.find('[data-testid="dialog-join-btn"]').trigger('click')
    expect(wrapper.emitted('join')).toEqual([['!room1:matrix.test', undefined]])
  })

  it('closes preview dialog without emitting join when cancel clicked', async () => {
    const wrapper = mountComponent()
    const dialog = wrapper.findComponent({ name: 'RoomPreviewDialog' })
    const firstCard = wrapper.findAll('[data-testid="room-card"]')[0]!
    await firstCard.find('[data-testid="room-join-btn"]').trigger('click')

    await wrapper.find('[data-testid="dialog-cancel-btn"]').trigger('click')
    expect(wrapper.emitted('join')).toBeUndefined()
    expect(dialog.props('visible')).toBe(false)
  })

  it('passes requireReason based on room federation flag', async () => {
    const wrapper = mountComponent()
    const dialog = wrapper.findComponent({ name: 'RoomPreviewDialog' })
    // second room is federated
    const secondCard = wrapper.findAll('[data-testid="room-card"]')[1]!
    await secondCard.find('[data-testid="room-join-btn"]').trigger('click')
    expect(dialog.props('requireReason')).toBe(true)
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

  it('uses a responsive minmax grid for the room list', () => {
    const wrapper = mountComponent()
    const grid = wrapper.find('.room-list')
    expect(grid.exists()).toBe(true)
    const style = (grid.element as HTMLElement).style
    expect(style.gridTemplateColumns).toContain('minmax(240px, 1fr)')
  })
})
