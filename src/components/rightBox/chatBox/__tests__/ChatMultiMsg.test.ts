import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, reactive } from 'vue'
import { EventEnum, RoomTypeEnum } from '@/enums'
import ChatMultiMsg from '../ChatMultiMsg.vue'

const { createWebviewWindowMock, sendWindowPayloadMock, showFeedbackMock, loggerErrorMock } = vi.hoisted(() => ({
  createWebviewWindowMock: vi.fn(),
  sendWindowPayloadMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  loggerErrorMock: vi.fn()
}))

let globalStore: ReturnType<
  typeof reactive<{
    currentSession: { type: RoomTypeEnum; name: string }
  }>
>
let chatStore: ReturnType<typeof reactive<{ currentMessageMap: Record<string, unknown> }>>
let groupStore: ReturnType<typeof reactive<{ getUserInfo: ReturnType<typeof vi.fn> }>>

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/hooks/useWindow', () => ({
  useWindow: () => ({
    createWebviewWindow: createWebviewWindowMock,
    sendWindowPayload: sendWindowPayloadMock
  })
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => chatStore
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => groupStore
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: computed(() => ({
      name: 'Me'
    }))
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStore
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock
  })
}))

vi.mock('@/utils/messageBody', () => ({
  getBodyContent: () => 'body'
}))

const mountComponent = () =>
  mount(ChatMultiMsg, {
    props: {
      contentList: ['fallback line'],
      msgIds: [{ msgId: '$1', fromUid: '@alice:example.com' }]
    }
  })

describe('ChatMultiMsg', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    globalStore = reactive({
      currentSession: {
        type: RoomTypeEnum.SINGLE,
        name: 'Alice'
      }
    })

    chatStore = reactive({
      currentMessageMap: {}
    })

    groupStore = reactive({
      getUserInfo: vi.fn(() => ({ name: 'Alice' }))
    })

    createWebviewWindowMock.mockResolvedValue(undefined)
    sendWindowPayloadMock.mockResolvedValue(undefined)
  })

  it('uses action feedback when opening multi message window fails', async () => {
    createWebviewWindowMock.mockRejectedValueOnce(new Error('open failed'))
    const wrapper = mountComponent()

    await wrapper.trigger('click')
    await flushPromises()

    expect(createWebviewWindowMock).toHaveBeenCalledWith(
      '聊天记录',
      EventEnum.MULTI_MSG,
      600,
      600,
      undefined,
      true,
      600,
      400,
      undefined,
      undefined,
      {
        key: EventEnum.MULTI_MSG
      }
    )
    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('打开聊天记录失败', 'error')
  })
})
