import { shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { matrixThreadService } from '@/services/matrix/messaging/MatrixThreadService'
import ThreadPanel from '../ThreadPanel.vue'

const { getThreadRepliesMock, getRoomThreadMock, showFeedbackMock, loggerErrorMock } = vi.hoisted(() => ({
  getThreadRepliesMock: vi.fn(),
  getRoomThreadMock: vi.fn(),
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
  isFrozen: boolean
  isMuted: boolean
  handleSendReply: () => Promise<void>
  handleToggleFreeze: () => Promise<void>
  handleToggleMute: () => Promise<void>
  loadThreadReplies: () => Promise<void>
  loadThreadState: () => Promise<void>
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
    getThreadingManager: () => ({ getThreadReplies: getThreadRepliesMock, getRoomThread: getRoomThreadMock })
  } as never)
}

/** 线程详情（仅填充面板关心的 summary.is_frozen / user_subscription.is_muted） */
const threadDetail = (isFrozen: boolean, isMuted: boolean) => ({
  root: {},
  replies: [],
  reply_count: 0,
  participants: [],
  summary: { is_frozen: isFrozen },
  user_receipt: null,
  user_subscription: { is_muted: isMuted }
})

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

describe('ThreadPanel 线程冻结/静音', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('打开线程时读取冻结与静音状态', async () => {
    stubThreadingManager()
    getRoomThreadMock.mockResolvedValueOnce(threadDetail(true, true))

    const wrapper = mountPanel()
    await vm(wrapper).loadThreadState()

    expect(getRoomThreadMock).toHaveBeenCalledWith('!room:server', '$thread', {
      includeReplies: false,
      replyLimit: 50
    })
    expect(vm(wrapper).isFrozen).toBe(true)
    expect(vm(wrapper).isMuted).toBe(true)
  })

  it('线程冻结时拒绝发送回复并提示原因', async () => {
    stubThreadingManager()
    getRoomThreadMock.mockResolvedValueOnce(threadDetail(true, false))
    const sendSpy = vi.spyOn(matrixThreadService, 'sendThreadReply').mockResolvedValueOnce('$reply')

    const wrapper = mountPanel()
    await vm(wrapper).loadThreadState()
    vm(wrapper).replyContent = 'hello thread'
    await vm(wrapper).handleSendReply()

    expect(sendSpy).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('thread.frozen_reason', 'warning')
    expect(vm(wrapper).replyContent).toBe('hello thread')
  })

  it('点击冻结调用 freezeThreadViaApi 并回写状态', async () => {
    const freezeSpy = vi.spyOn(matrixThreadService, 'freezeThreadViaApi').mockResolvedValueOnce(undefined)

    const wrapper = mountPanel()
    await vm(wrapper).handleToggleFreeze()

    expect(freezeSpy).toHaveBeenCalledWith('!room:server', '$thread')
    expect(vm(wrapper).isFrozen).toBe(true)
    expect(showFeedbackMock).toHaveBeenCalledWith('thread.freeze_success', 'success')
  })

  it('已冻结时点击调用 unfreezeThreadViaApi 并清除状态', async () => {
    stubThreadingManager()
    getRoomThreadMock.mockResolvedValueOnce(threadDetail(true, false))
    const unfreezeSpy = vi.spyOn(matrixThreadService, 'unfreezeThreadViaApi').mockResolvedValueOnce(undefined)

    const wrapper = mountPanel()
    await vm(wrapper).loadThreadState()
    await vm(wrapper).handleToggleFreeze()

    expect(unfreezeSpy).toHaveBeenCalledWith('!room:server', '$thread')
    expect(vm(wrapper).isFrozen).toBe(false)
    expect(showFeedbackMock).toHaveBeenCalledWith('thread.unfreeze_success', 'success')
  })

  it('静音与取消静音复用订阅接口并回写状态', async () => {
    const muteSpy = vi
      .spyOn(matrixThreadService, 'muteThreadViaApi')
      .mockResolvedValueOnce({ notificationLevel: 'muted', isMuted: true })
    const subscribeSpy = vi
      .spyOn(matrixThreadService, 'subscribeToThreadViaApi')
      .mockResolvedValueOnce({ notificationLevel: 'all', isMuted: false })

    const wrapper = mountPanel()
    await vm(wrapper).handleToggleMute()

    expect(muteSpy).toHaveBeenCalledWith('!room:server', '$thread')
    expect(vm(wrapper).isMuted).toBe(true)
    expect(showFeedbackMock).toHaveBeenCalledWith('thread.mute_success', 'success')

    await vm(wrapper).handleToggleMute()

    expect(subscribeSpy).toHaveBeenCalledWith('!room:server', '$thread')
    expect(vm(wrapper).isMuted).toBe(false)
    expect(showFeedbackMock).toHaveBeenCalledWith('thread.unmute_success', 'success')
  })

  it('冻结失败时保留原状态并提示操作失败', async () => {
    vi.spyOn(matrixThreadService, 'freezeThreadViaApi').mockRejectedValueOnce(new Error('boom'))

    const wrapper = mountPanel()
    await vm(wrapper).handleToggleFreeze()

    expect(vm(wrapper).isFrozen).toBe(false)
    expect(showFeedbackMock).toHaveBeenCalledWith('thread.action_failed', 'error')
    expect(loggerErrorMock).toHaveBeenCalled()
  })
})
