import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import RoomCardGrid from '../RoomCardGrid.vue'
import type { RoomCardViewModel } from '../RoomCardItem.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  const NEmpty = defineComponent({
    name: 'NEmpty',
    props: { description: { type: String, default: '' } },
    setup(props, { slots }) {
      return () => h('div', { class: 'n-empty' }, [slots.icon?.(), props.description, slots.extra?.()])
    }
  })
  const NSpin = defineComponent({
    name: 'NSpin',
    props: { size: { type: String, default: 'medium' } },
    setup() {
      return () => h('div', { class: 'n-spin' })
    }
  })
  const NScrollbar = defineComponent({
    name: 'NScrollbar',
    setup(_, { slots }) {
      return () => h('div', { class: 'n-scrollbar' }, slots.default?.())
    }
  })
  return { NEmpty, NSpin, NScrollbar }
})

const sampleRooms: RoomCardViewModel[] = [
  {
    roomId: '!room1:matrix.test',
    name: 'TJG 官方频道',
    topic: '官方交流',
    memberCount: 2032,
    onlineCount: 892,
    unreadCount: 5,
    isFederated: true,
    isEncrypted: true
  },
  {
    roomId: '!room2:matrix.test',
    name: '开发者空间',
    topic: '开发讨论',
    memberCount: 150,
    onlineCount: 30,
    unreadCount: 0
  }
]

const mountGrid = (props: Partial<Record<string, unknown>> = {}) =>
  mount(RoomCardGrid, {
    props: { rooms: sampleRooms, loading: false, ...props },
    global: {
      stubs: {
        RoomCardItem: {
          name: 'RoomCardItem',
          props: ['room'],
          emits: ['preview', 'message', 'info', 'settings', 'pin'],
          template:
            '<div data-testid="room-card-item" @click="$emit(\'preview\', room.roomId)" @message="$emit(\'message\', room.roomId)" />'
        }
      }
    }
  })

describe('RoomCardGrid', () => {
  it('renders grid container with correct testid', () => {
    const wrapper = mountGrid()
    expect(wrapper.find('[data-testid="room-card-grid"]').exists()).toBe(true)
  })

  it('renders one card per room', () => {
    const wrapper = mountGrid()
    expect(wrapper.findAll('[data-testid="room-card-item"]')).toHaveLength(2)
  })

  it('shows empty state when rooms list is empty', () => {
    const wrapper = mountGrid({ rooms: [] })
    expect(wrapper.find('[data-testid="room-card-grid-empty"]').exists()).toBe(true)
  })

  it('shows loading state when loading is true', () => {
    const wrapper = mountGrid({ loading: true })
    expect(wrapper.find('[data-testid="room-card-grid-loading"]').exists()).toBe(true)
  })

  it('does not render cards when loading', () => {
    const wrapper = mountGrid({ loading: true })
    expect(wrapper.findAll('[data-testid="room-card-item"]')).toHaveLength(0)
  })

  it('emits preview with roomId when a card emits preview', async () => {
    const wrapper = mountGrid()
    const cards = wrapper.findAllComponents({ name: 'RoomCardItem' })
    await cards[0].vm.$emit('preview', '!room1:matrix.test')
    expect(wrapper.emitted('preview')).toEqual([['!room1:matrix.test']])
  })

  it('emits message with roomId when a card emits message', async () => {
    const wrapper = mountGrid()
    const cards = wrapper.findAllComponents({ name: 'RoomCardItem' })
    await cards[1].vm.$emit('message', '!room2:matrix.test')
    expect(wrapper.emitted('message')).toEqual([['!room2:matrix.test']])
  })

  it('emits info with roomId when a card emits info', async () => {
    const wrapper = mountGrid()
    const cards = wrapper.findAllComponents({ name: 'RoomCardItem' })
    await cards[0].vm.$emit('info', '!room1:matrix.test')
    expect(wrapper.emitted('info')).toEqual([['!room1:matrix.test']])
  })

  it('emits settings with roomId when a card emits settings', async () => {
    const wrapper = mountGrid()
    const cards = wrapper.findAllComponents({ name: 'RoomCardItem' })
    await cards[0].vm.$emit('settings', '!room1:matrix.test')
    expect(wrapper.emitted('settings')).toEqual([['!room1:matrix.test']])
  })

  it('emits pin with roomId when a card emits pin', async () => {
    const wrapper = mountGrid()
    const cards = wrapper.findAllComponents({ name: 'RoomCardItem' })
    await cards[0].vm.$emit('pin', '!room1:matrix.test')
    expect(wrapper.emitted('pin')).toEqual([['!room1:matrix.test']])
  })

  it('passes empty description prop to empty state', () => {
    const wrapper = mountGrid({ rooms: [], emptyDescription: '暂无房间' })
    expect(wrapper.find('[data-testid="room-card-grid-empty"]').text()).toContain('暂无房间')
  })
})
