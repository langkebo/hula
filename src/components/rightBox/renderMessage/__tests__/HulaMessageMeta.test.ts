import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageStatusEnum } from '@/enums'
import HulaMessageMeta from '../HulaMessageMeta.vue'

const { getReadReceiptsMock, getTypingUsersMock, getClientMock, resolveEventIdMock, isLocalEventIdMock } = vi.hoisted(
  () => ({
    getReadReceiptsMock: vi.fn(),
    getTypingUsersMock: vi.fn(),
    getClientMock: vi.fn(),
    resolveEventIdMock: vi.fn((eventId: string) => eventId),
    isLocalEventIdMock: vi.fn(() => false)
  })
)

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'home.chat_main.typing.single') {
        return `${params?.name} 正在输入`
      }
      if (key === 'home.chat_main.typing.multiple') {
        return `${params?.count} 人正在输入`
      }
      return key
    }
  })
}))

vi.mock('@/composables/chat/useTyping', () => ({
  useTyping: () => ({
    getTypingUsers: getTypingUsersMock
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: getClientMock
  },
  default: {
    getClient: getClientMock
  }
}))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: {
    resolveEventId: resolveEventIdMock,
    isLocalEventId: isLocalEventIdMock
  }
}))

vi.mock('@/services/matrix/messaging/MatrixReceiptService', () => ({
  matrixReceiptService: {
    getReadReceipts: getReadReceiptsMock
  }
}))

vi.mock('@/utils/ComputedTime', () => ({
  formatTimestamp: () => '10:30'
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    NTooltip: defineComponent({
      name: 'NTooltip',
      setup(_, { slots }) {
        return () => h('div', [slots.trigger?.(), slots.default?.()])
      }
    }),
    NAvatar: defineComponent({
      name: 'NAvatar',
      props: {
        src: {
          type: String,
          default: ''
        }
      },
      setup(props) {
        return () => h('span', { 'data-test': 'avatar' }, props.src || 'avatar')
      }
    })
  }
})

describe('HulaMessageMeta', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getClientMock.mockReturnValue({
      getUserId: () => '@me:example.com',
      getUser: (userId: string) => ({
        presence: userId === '@alice:example.com' ? 'online' : 'offline'
      }),
      getRoom: () => ({
        getMember: () => ({
          name: 'Alice'
        })
      })
    })

    getReadReceiptsMock.mockReturnValue([
      {
        userId: '@alice:example.com',
        eventId: '$event-1',
        timestamp: 1,
        displayName: 'Alice',
        avatarUrl: ''
      },
      {
        userId: '@bob:example.com',
        eventId: '$event-1',
        timestamp: 2,
        displayName: 'Bob',
        avatarUrl: ''
      }
    ])

    getTypingUsersMock.mockReturnValue([{ userId: '@alice:example.com', lastTyped: Date.now() }])
  })

  it('renders presence and typing state for the last incoming message', () => {
    const wrapper = mount(HulaMessageMeta, {
      props: {
        messageId: '$event-1',
        roomId: '!room:example.com',
        senderId: '@alice:example.com',
        timestamp: Date.now(),
        isMe: false,
        status: MessageStatusEnum.SUCCESS,
        isLastMessage: true
      }
    })

    expect(wrapper.text()).toContain('10:30')
    expect(wrapper.text()).toContain('Alice 正在输入')
    expect(wrapper.find('.presence-dot.online').exists()).toBe(true)
  })

  it('renders read receipts for a delivered own message', () => {
    const wrapper = mount(HulaMessageMeta, {
      props: {
        messageId: '$event-1',
        roomId: '!room:example.com',
        senderId: '@me:example.com',
        timestamp: Date.now(),
        isMe: true,
        status: MessageStatusEnum.SUCCESS,
        isLastMessage: false
      }
    })

    expect(resolveEventIdMock).toHaveBeenCalledWith('$event-1')
    expect(getReadReceiptsMock).toHaveBeenCalledWith('!room:example.com', '$event-1')
    expect(wrapper.text()).toContain('2')
  })

  it('shows retry action for failed own messages', async () => {
    const wrapper = mount(HulaMessageMeta, {
      props: {
        messageId: '$event-2',
        roomId: '!room:example.com',
        senderId: '@me:example.com',
        timestamp: Date.now(),
        isMe: true,
        status: MessageStatusEnum.FAILED,
        isLastMessage: false
      }
    })

    expect(wrapper.find('.retry-button').exists()).toBe(true)

    await wrapper.get('.retry-button').trigger('click')
    expect(wrapper.emitted('retry')).toEqual([[]])
  })
})
