import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { RoomTypeEnum } from '@/enums'
import type { RoomCardViewModel } from '../RoomCardItem.vue'
import RoomCardItem from '../RoomCardItem.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const sampleRoom: RoomCardViewModel = {
  roomId: '!room1:matrix.test',
  name: 'TJG 官方频道',
  topic: '天机阁官方交流频道',
  memberCount: 2032,
  onlineCount: 892,
  unreadCount: 5,
  avatar: undefined,
  isFederated: true,
  isEncrypted: true,
  isPinned: false,
  roomType: RoomTypeEnum.GROUP
}

const mountCard = (props: Partial<{ item: RoomCardViewModel }> = {}) =>
  mount(RoomCardItem, { props: { item: sampleRoom, ...props } })

describe('RoomCardItem', () => {
  it('renders item name, member count and online count', () => {
    const wrapper = mountCard()
    const text = wrapper.find('[data-testid="room-card-item"]').text()
    expect(text).toContain('TJG 官方频道')
    expect(text).toContain('2032')
    expect(text).toContain('892')
  })

  it('renders topic text when provided', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="room-card-topic"]').text()).toContain('天机阁官方交流频道')
  })

  it('does not render topic element when topic is absent', () => {
    const wrapper = mountCard({ item: { ...sampleRoom, topic: undefined } })
    expect(wrapper.find('[data-testid="room-card-topic"]').exists()).toBe(false)
  })

  it('renders avatar placeholder with first character when no avatar', () => {
    const wrapper = mountCard()
    expect(wrapper.find('[data-testid="room-card-avatar-placeholder"]').text()).toBe('T')
  })

  it('renders avatar image when avatar provided', () => {
    const wrapper = mountCard({ item: { ...sampleRoom, avatar: 'https://example.com/a.png' } })
    const img = wrapper.find('[data-testid="room-card-avatar-img"]')
    expect(img.exists()).toBe(true)
    expect(img.attributes('src')).toBe('https://example.com/a.png')
  })

  it('shows unread badge when unreadCount > 0', () => {
    const wrapper = mountCard({ item: { ...sampleRoom, unreadCount: 3 } })
    expect(wrapper.find('[data-testid="room-card-unread"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="room-card-unread"]').text()).toContain('3')
  })

  it('hides unread badge when unreadCount is 0', () => {
    const wrapper = mountCard({ item: { ...sampleRoom, unreadCount: 0 } })
    expect(wrapper.find('[data-testid="room-card-unread"]').exists()).toBe(false)
  })

  it('shows federation badge when isFederated is true', () => {
    const wrapper = mountCard({ item: { ...sampleRoom, isFederated: true } })
    expect(wrapper.find('[data-testid="room-card-federation"]').exists()).toBe(true)
  })

  it('hides federation badge when isFederated is false', () => {
    const wrapper = mountCard({ item: { ...sampleRoom, isFederated: false } })
    expect(wrapper.find('[data-testid="room-card-federation"]').exists()).toBe(false)
  })

  it('shows encryption indicator when isEncrypted is true', () => {
    const wrapper = mountCard({ item: { ...sampleRoom, isEncrypted: true } })
    expect(wrapper.find('[data-testid="room-card-encrypted"]').exists()).toBe(true)
  })

  it('hides encryption indicator when isEncrypted is false', () => {
    const wrapper = mountCard({ item: { ...sampleRoom, isEncrypted: false } })
    expect(wrapper.find('[data-testid="room-card-encrypted"]').exists()).toBe(false)
  })

  it('shows pinned indicator when isPinned is true', () => {
    const wrapper = mountCard({ item: { ...sampleRoom, isPinned: true } })
    expect(wrapper.find('[data-testid="room-card-pinned"]').exists()).toBe(true)
  })

  it('emits message action with roomId when message button clicked', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="room-card-action-message"]').trigger('click')
    expect(wrapper.emitted('message')).toEqual([['!room1:matrix.test']])
  })

  it('emits info action with roomId when info button clicked', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="room-card-action-info"]').trigger('click')
    expect(wrapper.emitted('info')).toEqual([['!room1:matrix.test']])
  })

  it('emits settings action with roomId when settings button clicked', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="room-card-action-settings"]').trigger('click')
    expect(wrapper.emitted('settings')).toEqual([['!room1:matrix.test']])
  })

  it('emits pin action with roomId when pin button clicked', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="room-card-action-pin"]').trigger('click')
    expect(wrapper.emitted('pin')).toEqual([['!room1:matrix.test']])
  })

  it('does not emit preview when clicking action buttons (stop propagation)', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="room-card-action-message"]').trigger('click')
    expect(wrapper.emitted('preview')).toBeUndefined()
  })

  it('emits preview with roomId when card body clicked', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="room-card-item"]').trigger('click')
    expect(wrapper.emitted('preview')).toEqual([['!room1:matrix.test']])
  })

  it('emits preview with roomId when Enter is pressed on the card body', async () => {
    const wrapper = mountCard()
    await wrapper.find('[data-testid="room-card-item"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('preview')).toEqual([['!room1:matrix.test']])
  })

  it('truncates long topic text', () => {
    const longTopic = 'a'.repeat(120)
    const wrapper = mountCard({ item: { ...sampleRoom, topic: longTopic } })
    const topicEl = wrapper.find('[data-testid="room-card-topic"]')
    expect(topicEl.text().length).toBeLessThan(longTopic.length)
    expect(topicEl.text()).toContain('...')
  })

  it('applies encrypted class when isEncrypted is true', () => {
    const wrapper = mountCard({ item: { ...sampleRoom, isEncrypted: true, isFederated: false } })
    expect(wrapper.find('[data-testid="room-card-item"].room-card-item--encrypted').exists()).toBe(true)
  })

  it('applies federated class when isFederated is true and not encrypted', () => {
    const wrapper = mountCard({ item: { ...sampleRoom, isEncrypted: false, isFederated: true } })
    expect(wrapper.find('[data-testid="room-card-item"].room-card-item--federated').exists()).toBe(true)
  })

  it('applies group class when neither encrypted nor federated', () => {
    const wrapper = mountCard({ item: { ...sampleRoom, isEncrypted: false, isFederated: false } })
    expect(wrapper.find('[data-testid="room-card-item"].room-card-item--group').exists()).toBe(true)
  })

  it('prefers encrypted class over federated when both are true', () => {
    const wrapper = mountCard({ item: { ...sampleRoom, isEncrypted: true, isFederated: true } })
    const el = wrapper.find('[data-testid="room-card-item"]')
    expect(el.classes()).toContain('room-card-item--encrypted')
    expect(el.classes()).not.toContain('room-card-item--federated')
  })
})
