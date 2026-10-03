import { shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { matrixThreadService } from '@/services/matrix/messaging/MatrixThreadService'
import ThreadPanel from '../ThreadPanel.vue'

const { getThreadRepliesMock, showFeedbackMock, loggerErrorMock } = vi.hoisted(() => ({
  getThreadRepliesMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  loggerErrorMock: vi.fn()
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

/**
 * 不 mock MatrixThreadService：让加载路径真实穿过
 * MatrixThreadService -> MatrixThreadApi -> threadingManager，
 * 这样测试断言的是生产契约（失败会 reject），而不是桩替身。
 */
const stubThreadingManager = () => {
  vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
    getThreadingManager: () => ({ getThreadReplies: getThreadRepliesMock })
  } as never)
}

describe('ThreadPanel 发送/加载线程回复', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('发送回复调用 sendThreadReply，成功后清空输入并刷新回复列表', async () => {
    vi.spyOn(matrixThreadService, 'sendThreadReply').mockResolvedValueOnce('$reply')
    stubThreadingManager()
    getThreadRepliesMock.mockResolvedValueOnce([])

    const wrapper = mountPanel()
    vm(wrapper).replyContent = 'hello thread'
    await vm(wrapper).handleSendReply()

    expect(matrixThreadService.sendThreadReply).toHaveBeenCalledWith('!room:server', '$thread', {
      body: 'hello thread'
    })
    expect(vm(wrapper).replyContent).toBe('')
    expect(getThreadRepliesMock).toHaveBeenCalledWith('!room:server', '$thread', { limit: undefined })
    expect(wrapper.emitted('sendReply')).toBeUndefined()
  })

  it('发送失败时保留输入并给出错误反馈，不刷新列表', async () => {
    vi.spyOn(matrixThreadService, 'sendThreadReply').mockRejectedValueOnce(new Error('send failed'))

    const wrapper = mountPanel()
    vm(wrapper).replyContent = 'hello thread'
    await vm(wrapper).handleSendReply()

    expect(showFeedbackMock).toHaveBeenCalledWith('thread.send_failed', 'error')
    expect(loggerErrorMock).toHaveBeenCalled()
    expect(vm(wrapper).replyContent).toBe('hello thread')
    expect(getThreadRepliesMock).not.toHaveBeenCalled()
  })

  it('loadThreadReplies 通过 getThreadRepliesViaApi 拉取并映射为面板回复', async () => {
    stubThreadingManager()
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

    expect(getThreadRepliesMock).toHaveBeenCalledWith('!room:server', '$thread', { limit: undefined })
    expect(vm(wrapper).threadReplies).toHaveLength(1)
    expect(vm(wrapper).threadReplies[0]).toMatchObject({
      id: '$r1',
      senderId: '@bob:server',
      content: 'hi there',
      timestamp: 1710000000000
    })
    // 空结果与失败必须可区分：成功路径不应触发错误反馈
    expect(showFeedbackMock).not.toHaveBeenCalled()
  })

  it('拉取回复失败（真实 API 抛错）时给出错误反馈且不抛出', async () => {
    stubThreadingManager()
    getThreadRepliesMock.mockRejectedValueOnce(new Error('fetch failed'))

    const wrapper = mountPanel()
    await vm(wrapper).loadThreadReplies()

    expect(showFeedbackMock).toHaveBeenCalledWith('thread.load_failed', 'error')
    expect(loggerErrorMock).toHaveBeenCalled()
  })
})
