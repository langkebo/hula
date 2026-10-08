import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChatHistory from '../index.vue'

const { invokeWithResultMock, showFeedbackMock } = vi.hoisted(() => ({
  invokeWithResultMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({ show: vi.fn() })
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { roomId: '!room:server' } })
}))

vi.mock('@/composables/chat/useChatMain', () => ({
  useChatMain: () => ({ specialMenuList: () => [] })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock, showError: vi.fn() })
}))

vi.mock('@/composables/common/useImageViewer', () => ({
  useImageViewer: () => ({ openImageViewer: vi.fn() })
}))

vi.mock('@/composables/common/useVideoViewer', () => ({
  useVideoViewer: () => ({ openVideoViewer: vi.fn() })
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({ isGroup: false })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({ getUserInfo: () => undefined })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: { uid: '@me:server', avatar: '' } })
}))

vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => false,
  detectAppPlatform: () => 'desktop'
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { getAvatarUrl: () => '' }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeWithResult: invokeWithResultMock
}))

vi.mock('@/components/windows/ActionBar.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ name: 'ActionBar', setup: () => () => h('div') }) }
})

vi.mock('@/components/common/ContextMenu.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'ContextMenu',
      setup:
        (_, { slots }) =>
        () =>
          h('div', slots.default?.())
    })
  }
})

vi.mock('@/components/rightBox/renderMessage/index.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      name: 'RenderMessage',
      props: { message: { type: Object, required: true } },
      emits: ['jump2Reply'],
      setup(props, { emit }) {
        return () =>
          h('div', { class: 'render-stub' }, [
            h('button', {
              class: 'jump-self',
              onClick: () => emit('jump2Reply', (props.message as { message: { id: string } }).message.id)
            }),
            h('button', {
              class: 'jump-missing',
              onClick: () => emit('jump2Reply', '$missing')
            })
          ])
      }
    })
  }
})

const mountView = () => mount(ChatHistory)

describe('chatHistory 回复气泡跳转原消息', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invokeWithResultMock.mockResolvedValue({
      isErr: () => false,
      value: {
        messages: [
          {
            message: { id: '$h1', type: 1, body: 'hello', sendTime: 1710000000000 },
            fromUser: { uid: '@bob:server', avatar: '', username: 'Bob' }
          }
        ],
        hasMore: false,
        currentPage: 1
      }
    })
  })

  it('点击回复气泡高亮本地列表中的原消息', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('.jump-self').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-event-id="$h1"]').classes()).toContain('active-reply')
    expect(showFeedbackMock).not.toHaveBeenCalled()
  })

  it('原消息不在当前已加载列表时给出 warning 反馈', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('.jump-missing').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('无法找到原始消息，可能已被删除或太久远', 'warning')
  })
})
