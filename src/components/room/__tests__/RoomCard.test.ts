import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import RoomCard from '../RoomCard.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  const NButton = defineComponent({
    name: 'NButton',
    props: {
      type: { type: String, default: 'default' },
      size: { type: String, default: 'medium' },
      secondary: { type: Boolean, default: false }
    },
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () =>
        h(
          'button',
          {
            type: 'button',
            onClick: (event: Event) => emit('click', event)
          },
          slots.default?.()
        )
    }
  })
  return { NButton }
})

interface RoomData {
  roomId: string
  name: string
  topic?: string
  numJoinedMembers: number
  avatarUrl?: string
  isFederated?: boolean
}

const sampleRoom: RoomData = {
  roomId: '!room1:matrix.test',
  name: 'Matrix Chat',
  topic: 'A place to discuss Matrix protocol',
  numJoinedMembers: 42,
  avatarUrl: undefined,
  isFederated: false
}

const mountCard = (props: Partial<{ room: RoomData }> = {}) =>
  mount(RoomCard, { props: { room: sampleRoom, ...props } })

describe('RoomCard', () => {
  it('renders room name, member count and topic', () => {
    const wrapper = mountCard()
    const text = wrapper.find('[data-testid="room-card"]').text()
    expect(text).toContain('Matrix Chat')
    expect(text).toContain('42')
    expect(text).toContain('A place to discuss Matrix protocol')
  })

  it('renders avatar placeholder with first character when no avatarUrl', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="room-avatar-placeholder"]').text()).toBe('M')
  })

  it('renders avatar image when avatarUrl provided', () => {
    const wrapper = mountCard({ room: { ...sampleRoom, avatarUrl: 'https://example.com/a.png' } })
    const img = wrapper.find('[data-testid="room-avatar-img"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/a.png')
  })

  it('emits join with roomId when join button clicked', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="room-join-btn"]').trigger('click')
    expect(wrapper.emitted('join')).toEqual([['!room1:matrix.test']])
  })

  it('emits preview with roomId when card body clicked', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="room-card"]').trigger('click')
    expect(wrapper.emitted('preview')).toEqual([['!room1:matrix.test']])
  })

  it('shows federation badge when isFederated is true', () => {
    const wrapper = mountCard({ room: { ...sampleRoom, isFederated: true } })
    expect(wrapper.find('[data-testid="room-federation-badge"]').exists()).toBe(true)
  })

  it('hides federation badge when isFederated is false', () => {
    const wrapper = mountCard({ room: { ...sampleRoom, isFederated: false } })
    expect(wrapper.find('[data-testid="room-federation-badge"]').exists()).toBe(false)
  })

  it('truncates long topic text', () => {
    const longTopic = 'a'.repeat(120)
    const wrapper = mountCard({ room: { ...sampleRoom, topic: longTopic } })
    const topicEl = wrapper.find('[data-testid="room-topic"]')
    expect(topicEl.text().length).toBeLessThan(longTopic.length)
    expect(topicEl.text()).toContain('...')
  })

  it('does not render topic element when topic is absent', () => {
    const wrapper = mountCard({ room: { ...sampleRoom, topic: undefined } })
    expect(wrapper.find('[data-testid="room-topic"]').exists()).toBe(false)
  })
})
