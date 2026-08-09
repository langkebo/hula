import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import RoomDetailLastMessage from '../RoomDetailLastMessage.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

describe('RoomDetailLastMessage', () => {
  it('renders empty hint when no last message', () => {
    const wrapper = mount(RoomDetailLastMessage, {
      props: { lastMessage: null, senderName: null, timestamp: null }
    })
    expect(wrapper.find('[data-testid="room-detail-last-message-empty"]').exists()).toBe(true)
  })

  it('renders last message content with sender name', () => {
    const wrapper = mount(RoomDetailLastMessage, {
      props: {
        lastMessage: 'Hello world',
        senderName: 'Alice',
        timestamp: Date.now()
      }
    })
    const body = wrapper.find('[data-testid="room-detail-last-message-body"]')
    expect(body.exists()).toBe(true)
    expect(body.text()).toContain('Alice')
    expect(body.text()).toContain('Hello world')
  })

  it('truncates long message content to single line', () => {
    const longMessage = 'a'.repeat(120)
    const wrapper = mount(RoomDetailLastMessage, {
      props: {
        lastMessage: longMessage,
        senderName: 'Bob',
        timestamp: Date.now()
      }
    })
    const text = wrapper.find('[data-testid="room-detail-last-message-body"]').text()
    // 截断后总长度不应超过 100 + 省略号
    expect(text.length).toBeLessThan(longMessage.length)
    expect(text).toContain('...')
  })

  it('renders placeholder when sender name is missing', () => {
    const wrapper = mount(RoomDetailLastMessage, {
      props: {
        lastMessage: 'Hi',
        senderName: null,
        timestamp: Date.now()
      }
    })
    const body = wrapper.find('[data-testid="room-detail-last-message-body"]')
    expect(body.text()).toContain('common.unknownUser')
  })

  it('renders formatted timestamp when provided', () => {
    const fixedTs = new Date('2026-08-09T10:30:00').getTime()
    const wrapper = mount(RoomDetailLastMessage, {
      props: {
        lastMessage: 'msg',
        senderName: 'Alice',
        timestamp: fixedTs
      }
    })
    const time = wrapper.find('[data-testid="room-detail-last-message-time"]')
    expect(time.exists()).toBe(true)
    expect(time.text().length).toBeGreaterThan(0)
  })

  it('omits timestamp element when timestamp is null', () => {
    const wrapper = mount(RoomDetailLastMessage, {
      props: {
        lastMessage: 'msg',
        senderName: 'Alice',
        timestamp: null
      }
    })
    expect(wrapper.find('[data-testid="room-detail-last-message-time"]').exists()).toBe(false)
  })
})
