import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ThreadPanel from '../ThreadPanel.vue'

const { sendThreadReplyMock, getThreadRepliesMock, showFeedbackMock, loggerErrorMock } = vi.hoisted(() => ({
  sendThreadReplyMock: vi.fn(),
  getThreadRepliesMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  loggerErrorMock: vi.fn()
}))

vi.mock('@/services/matrix/messaging/MatrixThreadService', () => ({
  matrixThreadService: {
    sendThreadReply: sendThreadReplyMock,
    getThreadRepliesViaApi: getThreadRepliesMock
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock, showError: vi.fn() })
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { getAvatarUrl: () => '' }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: loggerErrorMock, info: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}))

type ThreadPanelVm = {
  replyContent: string
  threadReplies: Array<{ id: string; senderId: string; content: string; timestamp: number }>
  handleSendReply: () => Promise<void>
  loadThreadReplies: () => Promise<void>
}

const mountPanel = () =>
  shallowMount(ThreadPanel, {
    props: {
      show: true,
      threadId: '$thread',
      roomId: '!room:server'
    }
  })

const vm = (wrapper: ReturnType<typeof mountPanel>) => wrapper.vm as unknown as ThreadPanelVm

describe('ThreadPanel 发送/加载线程回复', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('发送回复调用 sendThreadReply，成功后清空输入并刷新回复列表', async () => {
    sendThreadReplyMock.mockResolvedValueOnce('$reply')
    getThreadRepliesMock.mockResolvedValueOnce([])

    const wrapper = mountPanel()
    vm(wrapper).replyContent = 'hello thread'
    await vm(wrapper).handleSendReply()

    expect(sendThreadReplyMock).toHaveBeenCalledWith('!room:server', '$thread', { body: 'hello thread' })
    expect(vm(wrapper).replyContent).toBe('')
    expect(getThreadRepliesMock).toHaveBeenCalledWith('!room:server', '$thread')
    expect(wrapper.emitted('sendReply')).toBeUndefined()
  })

  it('发送失败时保留输入并给出错误反馈，不刷新列表', async () => {
    sendThreadReplyMock.mockRejectedValueOnce(new Error('send failed'))

    const wrapper = mountPanel()
    vm(wrapper).replyContent = 'hello thread'
    await vm(wrapper).handleSendReply()

    expect(showFeedbackMock).toHaveBeenCalledWith('thread.send_failed', 'error')
    expect(loggerErrorMock).toHaveBeenCalled()
    expect(vm(wrapper).replyContent).toBe('hello thread')
    expect(getThreadRepliesMock).not.toHaveBeenCalled()
  })

  it('loadThreadReplies 通过 getThreadRepliesViaApi 拉取并映射为面板回复', async () => {
    getThreadRepliesMock.mockResolvedValueOnce([
      {
        event_id: '$r1',
        thread_id: '$thread',
        room_id: '!room:server',
        sender: '@bob:server',
        content: { body: 'hi there' },
        origin_server_ts: 1710000000000,
        in_reply_to_event_id: null,
        is_edited: false,
        is_redacted: false
      }
    ])

    const wrapper = mountPanel()
    await vm(wrapper).loadThreadReplies()

    expect(getThreadRepliesMock).toHaveBeenCalledWith('!room:server', '$thread')
    expect(vm(wrapper).threadReplies).toHaveLength(1)
    expect(vm(wrapper).threadReplies[0]).toMatchObject({
      id: '$r1',
      senderId: '@bob:server',
      content: 'hi there',
      timestamp: 1710000000000
    })
  })

  it('拉取回复失败时给出错误反馈且不抛出', async () => {
    getThreadRepliesMock.mockRejectedValueOnce(new Error('fetch failed'))

    const wrapper = mountPanel()
    await vm(wrapper).loadThreadReplies()

    expect(showFeedbackMock).toHaveBeenCalledWith('thread.load_failed', 'error')
    expect(loggerErrorMock).toHaveBeenCalled()
  })
})
