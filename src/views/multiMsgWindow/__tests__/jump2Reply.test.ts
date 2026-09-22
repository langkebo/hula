import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MultiMsgWindow from '../index.vue'

const { getWindowPayloadMock, getMsgListByIdsMock, showFeedbackMock } = vi.hoisted(() => ({
  getWindowPayloadMock: vi.fn(),
  getMsgListByIdsMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({ show: vi.fn() })
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: { key: 'payload-key' } })
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

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({ getWindowPayload: getWindowPayloadMock })
}))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: { getMsgListByIds: getMsgListByIdsMock }
}))

vi.mock('@/services/matrix/user/MatrixContactService', () => ({
  matrixContactService: { getUserByIds: vi.fn(async () => []) }
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: { uid: '@me:server', avatar: '' } })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({ getUserInfo: () => undefined })
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

vi.mock('@/components/windows/ActionBar.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ name: 'ActionBar', setup: () => () => h('div') }) }
})

vi.mock('@/components/common/ContextMenu.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({ name: 'ContextMenu', setup: (_, { slots }) => () => h('div', slots.default?.()) }) }
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

const mountView = () => mount(MultiMsgWindow)

describe('multiMsgWindow 回复气泡跳转原消息', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getWindowPayloadMock.mockResolvedValue([{ msgId: '$m1', fromUid: '@bob:server' }])
    getMsgListByIdsMock.mockResolvedValue([
      {
        message: { id: '$m1', type: 0, body: 'hello', sendTime: 1, roomId: '!room:server' },
        fromUser: { uid: '@bob:server', avatar: '', username: 'Bob' }
      }
    ])
  })

  it('点击回复气泡高亮本地列表中的原消息', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('.jump-self').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-event-id="$m1"]').classes()).toContain('active-reply')
    expect(showFeedbackMock).not.toHaveBeenCalled()
  })

  it('原消息不在本窗口列表时给出 warning 反馈', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('.jump-missing').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('无法找到原始消息，可能已被删除或太久远', 'warning')
  })
})
