import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import type { MessageType } from '@/stores/domains/chat/chat'
import MessageActionMenu from '../MessageActionMenu.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

const { getStrategyMock } = vi.hoisted(() => ({
  getStrategyMock: vi.fn()
}))

vi.mock('@/strategy/strategies', () => ({
  getStrategy: getStrategyMock,
  // 重新导出类型（被组件 import type 使用）
  MessageAction: {} as never,
  MessageActionContext: {} as never
}))

function setupStrategyMock() {
  getStrategyMock.mockImplementation(async (type: number) => ({
    getAllowedActions: (ctx: { isMe: boolean; canModerate: boolean; isPinned: boolean }) => {
      // 系统消息/撤回消息无任何操作
      if (type === MsgEnum.SYSTEM || type === MsgEnum.RECALL) return []
      // 默认动作集
      const actions: string[] = ['reply', 'forward', 'mark']
      // 仅 TEXT 可复制（EMOJI body 仅含 url）
      if (type === MsgEnum.TEXT) actions.push('copy')
      if (ctx.isMe) {
        actions.push('edit')
        if (ctx.canModerate) actions.push('recall')
      }
      if (ctx.canModerate) {
        actions.push('pin')
        actions.push('delete')
      }
      return actions
    }
  }))
}

const baseMessage = (overrides: Partial<MessageType['message']> = {}): MessageType => ({
  clientKey: 'msg-1',
  fromUser: { uid: '@alice:server', username: 'Alice', avatar: '' },
  message: {
    id: '$event-1:server',
    roomId: '!room-1:server',
    sendTime: Date.now(),
    status: MessageStatusEnum.SUCCESS,
    type: MsgEnum.TEXT,
    body: { text: 'hello' },
    messageMarks: {},
    ...overrides
  },
  sendTime: Date.now(),
  loading: false
})

describe('MessageActionMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupStrategyMock()
  })

  it('does not render when visible=false', () => {
    const wrapper = mount(MessageActionMenu, {
      props: {
        visible: false,
        message: baseMessage(),
        isMe: false,
        canModerate: false,
        isPinned: false,
        position: { x: 100, y: 100 }
      }
    })
    expect(wrapper.find('[data-test="message-action-menu"]').exists()).toBe(false)
  })

  it('renders menu items for text message from others', async () => {
    const wrapper = mount(MessageActionMenu, {
      props: {
        visible: true,
        message: baseMessage({ type: MsgEnum.TEXT }),
        isMe: false,
        canModerate: false,
        isPinned: false,
        position: { x: 100, y: 100 }
      }
    })
    // 等待异步 getStrategy
    await flushPromises()

    const items = wrapper.findAll('[data-test="menu-item"]')
    expect(items.length).toBeGreaterThan(0)
    // 非自己消息：不应有 edit/recall
    expect(wrapper.find('[data-action="edit"]').exists()).toBe(false)
    expect(wrapper.find('[data-action="recall"]').exists()).toBe(false)
    // 非管理员：不应有 pin/delete
    expect(wrapper.find('[data-action="pin"]').exists()).toBe(false)
    expect(wrapper.find('[data-action="delete"]').exists()).toBe(false)
    // 应有 reply/forward/mark/copy
    expect(wrapper.find('[data-action="reply"]').exists()).toBe(true)
    expect(wrapper.find('[data-action="forward"]').exists()).toBe(true)
    expect(wrapper.find('[data-action="mark"]').exists()).toBe(true)
    expect(wrapper.find('[data-action="copy"]').exists()).toBe(true)
  })

  it('shows edit and recall for own message when canModerate=true', async () => {
    const wrapper = mount(MessageActionMenu, {
      props: {
        visible: true,
        message: baseMessage({ type: MsgEnum.TEXT }),
        isMe: true,
        canModerate: true,
        isPinned: false,
        position: { x: 100, y: 100 }
      }
    })
    await flushPromises()

    expect(wrapper.find('[data-action="edit"]').exists()).toBe(true)
    expect(wrapper.find('[data-action="recall"]').exists()).toBe(true)
    expect(wrapper.find('[data-action="pin"]').exists()).toBe(true)
    expect(wrapper.find('[data-action="delete"]').exists()).toBe(true)
  })

  it('hides edit when message is from others even if canModerate=true', async () => {
    const wrapper = mount(MessageActionMenu, {
      props: {
        visible: true,
        message: baseMessage({ type: MsgEnum.TEXT }),
        isMe: false,
        canModerate: true,
        isPinned: false,
        position: { x: 100, y: 100 }
      }
    })
    await flushPromises()

    expect(wrapper.find('[data-action="edit"]').exists()).toBe(false)
    expect(wrapper.find('[data-action="recall"]').exists()).toBe(false)
    // 但管理员仍可 pin/delete 他人消息
    expect(wrapper.find('[data-action="pin"]').exists()).toBe(true)
    expect(wrapper.find('[data-action="delete"]').exists()).toBe(true)
  })

  it('shows no actions for system message', async () => {
    const wrapper = mount(MessageActionMenu, {
      props: {
        visible: true,
        message: baseMessage({ type: MsgEnum.SYSTEM }),
        isMe: false,
        canModerate: true,
        isPinned: false,
        position: { x: 100, y: 100 }
      }
    })
    await flushPromises()

    expect(wrapper.findAll('[data-test="menu-item"]').length).toBe(0)
    // 空态提示
    expect(wrapper.find('[data-test="menu-empty"]').exists()).toBe(true)
  })

  it('shows no actions for recall message', async () => {
    const wrapper = mount(MessageActionMenu, {
      props: {
        visible: true,
        message: baseMessage({ type: MsgEnum.RECALL }),
        isMe: true,
        canModerate: true,
        isPinned: false,
        position: { x: 100, y: 100 }
      }
    })
    await flushPromises()

    expect(wrapper.findAll('[data-test="menu-item"]').length).toBe(0)
  })

  it('hides copy action for image message', async () => {
    const wrapper = mount(MessageActionMenu, {
      props: {
        visible: true,
        message: baseMessage({ type: MsgEnum.IMAGE }),
        isMe: false,
        canModerate: false,
        isPinned: false,
        position: { x: 100, y: 100 }
      }
    })
    await flushPromises()

    expect(wrapper.find('[data-action="copy"]').exists()).toBe(false)
  })

  it('emits reply when clicking reply action', async () => {
    const wrapper = mount(MessageActionMenu, {
      props: {
        visible: true,
        message: baseMessage({ type: MsgEnum.TEXT }),
        isMe: false,
        canModerate: false,
        isPinned: false,
        position: { x: 100, y: 100 }
      }
    })
    await flushPromises()

    await wrapper.find('[data-action="reply"]').trigger('click')
    expect(wrapper.emitted('reply')).toHaveLength(1)
    expect(wrapper.emitted('update:visible')![0]).toEqual([false])
  })

  it('emits recall when clicking recall action', async () => {
    const wrapper = mount(MessageActionMenu, {
      props: {
        visible: true,
        message: baseMessage({ type: MsgEnum.TEXT }),
        isMe: true,
        canModerate: true,
        isPinned: false,
        position: { x: 100, y: 100 }
      }
    })
    await flushPromises()

    await wrapper.find('[data-action="recall"]').trigger('click')
    expect(wrapper.emitted('recall')).toHaveLength(1)
  })

  it('closes menu on Esc key', async () => {
    const wrapper = mount(MessageActionMenu, {
      props: {
        visible: true,
        message: baseMessage({ type: MsgEnum.TEXT }),
        isMe: false,
        canModerate: false,
        isPinned: false,
        position: { x: 100, y: 100 }
      },
      attachTo: document.body
    })
    await flushPromises()

    await wrapper.find('[data-test="message-action-menu"]').trigger('keydown.esc')
    expect(wrapper.emitted('update:visible')![0]).toEqual([false])
  })

  it('positions menu at given coordinates', async () => {
    const wrapper = mount(MessageActionMenu, {
      props: {
        visible: true,
        message: baseMessage({ type: MsgEnum.TEXT }),
        isMe: false,
        canModerate: false,
        isPinned: false,
        position: { x: 250, y: 300 }
      },
      attachTo: document.body
    })
    await flushPromises()

    const menu = wrapper.find('[data-test="message-action-menu"]')
    expect(menu.exists()).toBe(true)
    const style = menu.attributes('style') || ''
    expect(style).toContain('250')
    expect(style).toContain('300')
  })
})
