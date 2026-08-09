import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { chatState, globalState } = vi.hoisted(() => ({
  chatState: {
    isGroup: false,
    shouldShowNoMoreMessage: false,
    chatMessageList: [] as unknown[],
    currentSessionInfo: { roomId: '!room:example.com' } as { roomId: string } | null,
    currentMessageOptions: {
      hasLoadedOnce: false,
      isLast: false,
      isLoading: false
    } as { hasLoadedOnce: boolean; isLast: boolean; isLoading: boolean } | null,
    isMsgMultiChoose: false,
    msgMultiChooseMode: ''
  },
  globalState: {
    currentSessionRoomId: '' as string
  }
}))

vi.mock('@/stores/domains/chat/chat', async () => {
  const { reactive } = await import('vue')
  return { useChatStore: () => reactive(chatState) }
})
vi.mock('@/stores/domains/widget/global', async () => {
  const { reactive } = await import('vue')
  return { useGlobalStore: () => reactive(globalState) }
})
vi.mock('@/stores/domains/user/user', async () => {
  const { reactive } = await import('vue')
  return { useUserStore: () => reactive({ userInfo: { uid: '@me:server' } }) }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('vue-virtual-scroller', async () => {
  const { defineComponent, h } = await import('vue')
  // 渲染 default slot：DynamicScroller 遍历 items，为每个 item 调用 default slot
  // 并传入 { item, index, active }；DynamicScrollerItem 渲染其 default slot。
  // 这样消息行（.message-row）会出现在 DOM 中，便于断言 class。
  // 现有 3 个测试因 chatMessageList 为空或 isMainViewReady=false，slot 不会被调用，故不受影响。
  return {
    DynamicScroller: defineComponent({
      name: 'DynamicScroller',
      props: ['items', 'minItemSize', 'buffer', 'keyField'],
      setup(props, { slots }) {
        return () => {
          const items = (props.items as unknown[]) || []
          return h(
            'div',
            items.map((item, index) => slots.default?.({ item, index, active: true }))
          )
        }
      }
    }),
    DynamicScrollerItem: defineComponent({
      name: 'DynamicScrollerItem',
      props: ['item', 'active', 'sizeDependencies', 'dataIndex'],
      setup(_, { slots }) {
        return () => h('div', slots.default?.())
      }
    })
  }
})

vi.mock('@/components/common/EmptyState.vue', () => ({
  default: { template: '<div class="empty-state-stub"/>' }
}))
// RenderMessage 通过 unplugin-vue-components 自动导入（局部注册），
// global.stubs 无法拦截局部注册组件，故用模块级 mock 替换为轻量 stub，
// 避免 RenderMessage setup 中调用 Pinia store 导致测试失败。
vi.mock('@/components/rightBox/renderMessage/index.vue', () => ({
  default: { name: 'RenderMessage', template: '<div class="render-message-stub"/>' }
}))
vi.mock('@/enums', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/enums')>()
  return { ...actual, MsgEnum: { RECALL: 0 } }
})
vi.mock('@/utils/ComputedTime', () => ({ formatChatTime: () => '' }))
vi.mock('@/utils/MessageSelect', () => ({ isMessageMultiSelectEnabled: () => true }))

import ChatMessageList from '../ChatMessageList.vue'

describe('ChatMessageList isMainViewReady', () => {
  beforeEach(() => {
    chatState.currentSessionInfo = { roomId: '!room:example.com' }
    chatState.currentMessageOptions = { hasLoadedOnce: false, isLast: false, isLoading: false }
    chatState.chatMessageList = []
    globalState.currentSessionRoomId = ''
  })

  it('shows the skeleton placeholder before the current room has loaded once', () => {
    globalState.currentSessionRoomId = '!room:example.com'
    const wrapper = mount(ChatMessageList, {
      props: { isGroup: false, privateModeActive: false, activeReply: '' }
    })

    expect(wrapper.find('.message-list-placeholder').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'DynamicScroller' }).exists()).toBe(false)
  })

  it('renders the message list once the current room has loaded, even when session meta is missing (regression for infinite spinner)', () => {
    globalState.currentSessionRoomId = '!room:example.com'
    // 模拟从通知/搜索/好友页直接进入、尚未进入 sessionList 的会话：
    // getSession() 返回 undefined，currentSessionInfo 为 null。
    chatState.currentSessionInfo = null
    chatState.currentMessageOptions = { hasLoadedOnce: true, isLast: false, isLoading: false }

    const wrapper = mount(ChatMessageList, {
      props: { isGroup: false, privateModeActive: false, activeReply: '' }
    })

    // 修复前 hasSessionBound 恒为 false → 永远卡在骨架屏（圆圈转）。
    expect(wrapper.find('.message-list-placeholder').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'DynamicScroller' }).exists()).toBe(true)
  })

  it('shows the skeleton placeholder when no session room is selected', () => {
    globalState.currentSessionRoomId = ''
    chatState.currentMessageOptions = { hasLoadedOnce: true, isLast: false, isLoading: false }

    const wrapper = mount(ChatMessageList, {
      props: { isGroup: false, privateModeActive: false, activeReply: '' }
    })

    expect(wrapper.find('.message-list-placeholder').exists()).toBe(true)
  })
})

describe('ChatMessageList private mode styling', () => {
  beforeEach(() => {
    globalState.currentSessionRoomId = '!room1:server'
    chatState.currentMessageOptions = { hasLoadedOnce: true, isLast: false, isLoading: false }
    chatState.chatMessageList = []
    chatState.isMsgMultiChoose = false
    chatState.msgMultiChooseMode = ''
  })

  const buildMessage = (uid: string) => ({
    clientKey: `k-${uid}`,
    message: {
      id: `m-${uid}`,
      roomId: '!room1:server',
      sendTime: Date.now(),
      type: 0 as unknown,
      body: {}
    },
    fromUser: { uid }
  })

  const mountWith = (privateModeActive: boolean) =>
    mount(ChatMessageList, {
      props: { isGroup: false, privateModeActive, activeReply: '' },
      global: { stubs: { 'n-flex': true } }
    })

  it('applies sender class when privateModeActive and message is from me', () => {
    chatState.chatMessageList = [buildMessage('@me:server')]
    const wrapper = mountWith(true)
    const row = wrapper.find('.message-row')
    expect(row.exists()).toBe(true)
    expect(row.classes()).toContain('message-row--private-mode')
    expect(row.classes()).toContain('message-row--private-mode-sender')
  })

  it('applies receiver class when privateModeActive and message is from other', () => {
    chatState.chatMessageList = [buildMessage('@other:server')]
    const wrapper = mountWith(true)
    const row = wrapper.find('.message-row')
    expect(row.exists()).toBe(true)
    expect(row.classes()).toContain('message-row--private-mode')
    expect(row.classes()).toContain('message-row--private-mode-receiver')
    expect(row.classes()).not.toContain('message-row--private-mode-sender')
  })

  it('does NOT apply sender/receiver classes when privateModeActive is false', () => {
    chatState.chatMessageList = [buildMessage('@me:server')]
    const wrapper = mountWith(false)
    const row = wrapper.find('.message-row')
    expect(row.exists()).toBe(true)
    expect(row.classes()).not.toContain('message-row--private-mode-sender')
    expect(row.classes()).not.toContain('message-row--private-mode-receiver')
    expect(row.classes()).not.toContain('message-row--private-mode')
  })
})
