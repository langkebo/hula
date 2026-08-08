import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetPinnedEvents,
  mockPinEvent,
  mockUnpinEvent,
  mockGetMemberDisplayName,
  mockGetRoomMessage,
  mockChatGetMessage,
  mockShowFeedback,
  mockCanPinEvents
} = vi.hoisted(() => ({
  mockGetPinnedEvents: vi.fn(),
  mockPinEvent: vi.fn(),
  mockUnpinEvent: vi.fn(),
  mockGetMemberDisplayName: vi.fn(),
  mockGetRoomMessage: vi.fn(),
  mockChatGetMessage: vi.fn(),
  mockShowFeedback: vi.fn(),
  mockCanPinEvents: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomOperations', () => ({
  roomOperations: {
    getPinnedEvents: mockGetPinnedEvents,
    pinEvent: mockPinEvent,
    unpinEvent: mockUnpinEvent,
    getMemberDisplayName: mockGetMemberDisplayName,
    canPinEvents: mockCanPinEvents
  }
}))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: {
    getRoomMessage: mockGetRoomMessage
  }
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({
    getMessage: mockChatGetMessage
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: mockShowFeedback
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

import { usePinnedMessage } from '../usePinnedMessage'

/** 构造 MatrixEvent mock */
const makeMatrixEvent = (eventId: string, sender: string, body: string, ts: number, msgtype = 'm.text') => ({
  getId: () => eventId,
  getSender: () => sender,
  getTs: () => ts,
  getContent: () => ({ body, msgtype })
})

describe('usePinnedMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChatGetMessage.mockReturnValue(undefined)
    mockGetMemberDisplayName.mockResolvedValue(null)
    mockCanPinEvents.mockReturnValue(false)
  })

  describe('初始状态', () => {
    it('初始状态字段均为默认值', () => {
      const flow = usePinnedMessage({ roomId: '!r:s' })
      expect(flow.pinnedEventIds.value).toEqual([])
      expect(flow.latestPinnedMessage.value).toBeNull()
      expect(flow.loading.value).toBe(false)
      expect(flow.errorMessage.value).toBeNull()
      expect(flow.dismissed.value).toBe(false)
    })
  })

  describe('load', () => {
    it('成功加载单条置顶消息', async () => {
      mockGetPinnedEvents.mockResolvedValueOnce(['$e1:s'])
      mockGetRoomMessage.mockResolvedValueOnce(makeMatrixEvent('$e1:s', '@alice:s', 'hello', 1000))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()

      expect(flow.pinnedEventIds.value).toEqual(['$e1:s'])
      expect(flow.latestPinnedMessage.value).not.toBeNull()
      expect(flow.latestPinnedMessage.value?.eventId).toBe('$e1:s')
      expect(flow.latestPinnedMessage.value?.body).toBe('hello')
      expect(flow.latestPinnedMessage.value?.sender).toBe('@alice:s')
      expect(flow.latestPinnedMessage.value?.timestamp).toBe(1000)
      expect(flow.latestPinnedMessage.value?.msgtype).toBe('m.text')
      expect(flow.loading.value).toBe(false)
    })

    it('多条置顶消息取时间戳最大者作为 latestPinnedMessage', async () => {
      mockGetPinnedEvents.mockResolvedValueOnce(['$old:s', '$new:s'])
      mockGetRoomMessage
        .mockResolvedValueOnce(makeMatrixEvent('$old:s', '@a:s', 'old', 1000))
        .mockResolvedValueOnce(makeMatrixEvent('$new:s', '@b:s', 'new', 5000))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()

      expect(flow.latestPinnedMessage.value?.eventId).toBe('$new:s')
      expect(flow.latestPinnedMessage.value?.body).toBe('new')
    })

    it('置顶 eventId 为空时 latestPinnedMessage 为 null', async () => {
      mockGetPinnedEvents.mockResolvedValueOnce([])

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()

      expect(flow.pinnedEventIds.value).toEqual([])
      expect(flow.latestPinnedMessage.value).toBeNull()
      expect(flow.loading.value).toBe(false)
    })

    it('加载失败时设置 errorMessage 并关闭 loading', async () => {
      mockGetPinnedEvents.mockRejectedValueOnce(new Error('network'))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()

      expect(flow.errorMessage.value).toBe('pinned_message.load_failed')
      expect(flow.loading.value).toBe(false)
    })

    it('roomId 为空时跳过加载', async () => {
      const flow = usePinnedMessage({ roomId: null })
      await flow.load()

      expect(mockGetPinnedEvents).not.toHaveBeenCalled()
      expect(flow.pinnedEventIds.value).toEqual([])
      expect(flow.latestPinnedMessage.value).toBeNull()
    })

    it('roomId 为 undefined 时跳过加载', async () => {
      const flow = usePinnedMessage({ roomId: () => undefined })
      await flow.load()

      expect(mockGetPinnedEvents).not.toHaveBeenCalled()
    })

    it('优先使用 chat store 缓存的消息', async () => {
      mockGetPinnedEvents.mockResolvedValueOnce(['$e1:s'])
      mockChatGetMessage.mockReturnValueOnce({
        message: {
          id: '$e1:s',
          roomId: '!r:s',
          sendTime: 2000,
          type: 'text',
          body: { content: 'cached body', msgtype: 'm.text' }
        },
        fromUser: { uid: '@alice:s', username: 'Alice' }
      })

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()

      expect(mockGetRoomMessage).not.toHaveBeenCalled()
      expect(flow.latestPinnedMessage.value?.body).toBe('cached body')
      expect(flow.latestPinnedMessage.value?.sender).toBe('Alice')
      expect(flow.latestPinnedMessage.value?.timestamp).toBe(2000)
    })

    it('使用 getMemberDisplayName 解析展示名', async () => {
      mockGetPinnedEvents.mockResolvedValueOnce(['$e1:s'])
      mockGetRoomMessage.mockResolvedValueOnce(makeMatrixEvent('$e1:s', '@alice:s', 'hi', 1000))
      mockGetMemberDisplayName.mockResolvedValueOnce('Alice')

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()

      expect(mockGetMemberDisplayName).toHaveBeenCalledWith('!r:s', '@alice:s')
      expect(flow.latestPinnedMessage.value?.sender).toBe('Alice')
    })

    it('解析消息失败时不影响其他置顶消息', async () => {
      mockGetPinnedEvents.mockResolvedValueOnce(['$bad:s', '$good:s'])
      mockGetRoomMessage
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce(makeMatrixEvent('$good:s', '@b:s', 'good', 3000))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()

      expect(flow.latestPinnedMessage.value?.eventId).toBe('$good:s')
    })

    it('所有消息都解析失败时 latestPinnedMessage 为 null', async () => {
      mockGetPinnedEvents.mockResolvedValueOnce(['$e1:s'])
      mockGetRoomMessage.mockRejectedValueOnce(new Error('not found'))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()

      expect(flow.latestPinnedMessage.value).toBeNull()
    })
  })

  describe('dismiss 与新置顶检测', () => {
    it('拉取到新置顶 eventId 时自动重置 dismissed', async () => {
      mockGetPinnedEvents.mockResolvedValueOnce(['$e1:s'])
      mockGetRoomMessage.mockResolvedValueOnce(makeMatrixEvent('$e1:s', '@a:s', 'first', 1000))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()
      flow.dismiss()
      expect(flow.dismissed.value).toBe(true)

      // 再次 load,新置顶 $e2:s
      mockGetPinnedEvents.mockResolvedValueOnce(['$e1:s', '$e2:s'])
      mockGetRoomMessage
        .mockResolvedValueOnce(makeMatrixEvent('$e1:s', '@a:s', 'first', 1000))
        .mockResolvedValueOnce(makeMatrixEvent('$e2:s', '@b:s', 'second', 2000))
      await flow.load()

      expect(flow.dismissed.value).toBe(false)
    })

    it('相同置顶 eventId 时不重置 dismissed', async () => {
      mockGetPinnedEvents.mockResolvedValueOnce(['$e1:s'])
      mockGetRoomMessage.mockResolvedValueOnce(makeMatrixEvent('$e1:s', '@a:s', 'first', 1000))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()
      flow.dismiss()

      mockGetPinnedEvents.mockResolvedValueOnce(['$e1:s'])
      mockGetRoomMessage.mockResolvedValueOnce(makeMatrixEvent('$e1:s', '@a:s', 'first', 1000))
      await flow.load()

      expect(flow.dismissed.value).toBe(true)
    })
  })

  describe('refresh', () => {
    it('清空已知 ID 集合并重新加载', async () => {
      mockGetPinnedEvents.mockResolvedValueOnce(['$e1:s'])
      mockGetRoomMessage.mockResolvedValueOnce(makeMatrixEvent('$e1:s', '@a:s', 'first', 1000))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()
      flow.dismiss()

      // refresh 后即使 eventId 相同也应当重置 dismissed
      mockGetPinnedEvents.mockResolvedValueOnce(['$e1:s'])
      mockGetRoomMessage.mockResolvedValueOnce(makeMatrixEvent('$e1:s', '@a:s', 'first', 1000))
      await flow.refresh()

      expect(flow.dismissed.value).toBe(false)
      expect(flow.latestPinnedMessage.value?.eventId).toBe('$e1:s')
    })
  })

  describe('pin', () => {
    it('置顶成功后显示成功反馈并重新加载', async () => {
      mockPinEvent.mockResolvedValueOnce(undefined)
      mockGetPinnedEvents.mockResolvedValueOnce(['$e1:s'])
      mockGetRoomMessage.mockResolvedValueOnce(makeMatrixEvent('$e1:s', '@a:s', 'pinned', 1000))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      const result = await flow.pin('$e1:s')

      expect(result).toBe(true)
      expect(mockPinEvent).toHaveBeenCalledWith('!r:s', '$e1:s')
      expect(mockShowFeedback).toHaveBeenCalledWith('pinned_message.pin_success', 'success')
      expect(flow.latestPinnedMessage.value?.eventId).toBe('$e1:s')
    })

    it('置顶失败时显示错误反馈并返回 false', async () => {
      mockPinEvent.mockRejectedValueOnce(new Error('forbidden'))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      const result = await flow.pin('$e1:s')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('pinned_message.pin_failed', 'error')
    })

    it('roomId 为空时返回 false 并显示错误反馈', async () => {
      const flow = usePinnedMessage({ roomId: null })
      const result = await flow.pin('$e1:s')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('pinned_message.pin_failed', 'error')
      expect(mockPinEvent).not.toHaveBeenCalled()
    })

    it('eventId 为空时返回 false', async () => {
      const flow = usePinnedMessage({ roomId: '!r:s' })
      const result = await flow.pin('')

      expect(result).toBe(false)
      expect(mockPinEvent).not.toHaveBeenCalled()
    })
  })

  describe('unpin', () => {
    it('取消置顶成功后显示成功反馈并重新加载', async () => {
      mockUnpinEvent.mockResolvedValueOnce(undefined)
      mockGetPinnedEvents.mockResolvedValueOnce([])

      const flow = usePinnedMessage({ roomId: '!r:s' })
      const result = await flow.unpin('$e1:s')

      expect(result).toBe(true)
      expect(mockUnpinEvent).toHaveBeenCalledWith('!r:s', '$e1:s')
      expect(mockShowFeedback).toHaveBeenCalledWith('pinned_message.unpin_success', 'success')
      expect(flow.latestPinnedMessage.value).toBeNull()
    })

    it('取消置顶失败时显示错误反馈并返回 false', async () => {
      mockUnpinEvent.mockRejectedValueOnce(new Error('forbidden'))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      const result = await flow.unpin('$e1:s')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('pinned_message.unpin_failed', 'error')
    })

    it('roomId 为空时返回 false 并显示错误反馈', async () => {
      const flow = usePinnedMessage({ roomId: null })
      const result = await flow.unpin('$e1:s')

      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('pinned_message.unpin_failed', 'error')
      expect(mockUnpinEvent).not.toHaveBeenCalled()
    })

    it('eventId 为空时返回 false', async () => {
      const flow = usePinnedMessage({ roomId: '!r:s' })
      const result = await flow.unpin('')

      expect(result).toBe(false)
      expect(mockUnpinEvent).not.toHaveBeenCalled()
    })
  })

  describe('dismiss / resetDismiss', () => {
    it('dismiss 设置 dismissed 为 true', () => {
      const flow = usePinnedMessage({ roomId: '!r:s' })
      expect(flow.dismissed.value).toBe(false)
      flow.dismiss()
      expect(flow.dismissed.value).toBe(true)
    })

    it('resetDismiss 设置 dismissed 为 false', () => {
      const flow = usePinnedMessage({ roomId: '!r:s' })
      flow.dismiss()
      expect(flow.dismissed.value).toBe(true)
      flow.resetDismiss()
      expect(flow.dismissed.value).toBe(false)
    })
  })

  describe('roomId 响应式', () => {
    it('支持 getter 形式的 roomId', async () => {
      const currentRoom = '!r1:s'
      mockGetPinnedEvents.mockResolvedValueOnce(['$e1:s'])
      mockGetRoomMessage.mockResolvedValueOnce(makeMatrixEvent('$e1:s', '@a:s', 'hi', 1000))

      const flow = usePinnedMessage({ roomId: () => currentRoom })
      await flow.load()

      expect(mockGetPinnedEvents).toHaveBeenCalledWith('!r1:s')
      expect(flow.latestPinnedMessage.value?.eventId).toBe('$e1:s')
    })
  })

  describe('pinnedMessages 数组', () => {
    it('加载完成后暴露所有已解析的置顶消息数组', async () => {
      mockGetPinnedEvents.mockResolvedValueOnce(['$old:s', '$new:s'])
      mockGetRoomMessage
        .mockResolvedValueOnce(makeMatrixEvent('$old:s', '@a:s', 'old', 1000))
        .mockResolvedValueOnce(makeMatrixEvent('$new:s', '@b:s', 'new', 5000))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()

      expect(flow.pinnedMessages.value).toHaveLength(2)
      expect(flow.pinnedMessages.value[0].eventId).toBe('$new:s')
      expect(flow.pinnedMessages.value[1].eventId).toBe('$old:s')
    })

    it('无置顶消息时 pinnedMessages 为空数组', async () => {
      mockGetPinnedEvents.mockResolvedValueOnce([])

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()

      expect(flow.pinnedMessages.value).toEqual([])
    })

    it('部分解析失败时仅保留成功的消息', async () => {
      mockGetPinnedEvents.mockResolvedValueOnce(['$bad:s', '$good:s'])
      mockGetRoomMessage
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce(makeMatrixEvent('$good:s', '@b:s', 'good', 3000))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.load()

      expect(flow.pinnedMessages.value).toHaveLength(1)
      expect(flow.pinnedMessages.value[0].eventId).toBe('$good:s')
    })

    it('置顶后重新加载时 pinnedMessages 更新', async () => {
      mockPinEvent.mockResolvedValueOnce(undefined)
      mockGetPinnedEvents.mockResolvedValueOnce(['$e1:s'])
      mockGetRoomMessage.mockResolvedValueOnce(makeMatrixEvent('$e1:s', '@a:s', 'pinned', 1000))

      const flow = usePinnedMessage({ roomId: '!r:s' })
      await flow.pin('$e1:s')

      expect(flow.pinnedMessages.value).toHaveLength(1)
      expect(flow.pinnedMessages.value[0].eventId).toBe('$e1:s')
    })
  })

  describe('canSetSticky 权限', () => {
    it('canPinEvents 返回 true 时 canSetSticky 为 true', () => {
      mockCanPinEvents.mockReturnValue(true)
      const flow = usePinnedMessage({ roomId: '!r:s' })
      expect(flow.canSetSticky.value).toBe(true)
      expect(mockCanPinEvents).toHaveBeenCalledWith('!r:s')
    })

    it('canPinEvents 返回 false 时 canSetSticky 为 false', () => {
      mockCanPinEvents.mockReturnValue(false)
      const flow = usePinnedMessage({ roomId: '!r:s' })
      expect(flow.canSetSticky.value).toBe(false)
    })

    it('roomId 为空时 canSetSticky 为 false 且不调用 canPinEvents', () => {
      const flow = usePinnedMessage({ roomId: null })
      expect(flow.canSetSticky.value).toBe(false)
      expect(mockCanPinEvents).not.toHaveBeenCalled()
    })
  })
})
