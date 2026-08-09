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
    } as { hasLoadedOnce: boolean; isLast: boolean; isLoading: boolean } | null
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

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('vue-virtual-scroller', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    // Render stub without slots so nested naive/RenderMessage nodes are not mounted.
    DynamicScroller: defineComponent({
      name: 'DynamicScroller',
      setup: () => () => h('div')
    }),
    DynamicScrollerItem: defineComponent({
      name: 'DynamicScrollerItem',
      setup: () => () => h('div')
    })
  }
})

vi.mock('@/components/common/EmptyState.vue', () => ({
  default: { template: '<div class="empty-state-stub"/>' }
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
