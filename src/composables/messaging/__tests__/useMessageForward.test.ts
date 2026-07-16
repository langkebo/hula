import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockForwardEvent, mockForwardEventToMultipleRooms, mockShowFeedback, mockLoggerError, mockLoggerInfo } =
  vi.hoisted(() => ({
    mockForwardEvent: vi.fn(),
    mockForwardEventToMultipleRooms: vi.fn(),
    mockShowFeedback: vi.fn(),
    mockLoggerError: vi.fn(),
    mockLoggerInfo: vi.fn()
  }))

// 模拟的会话列表(供 chat store 使用)
const mockSessionList = vi.hoisted(() => vi.fn(() => [] as any[]))

// 模拟的当前会话 roomId(供 global store 使用)
const mockCurrentSessionRoomId = vi.hoisted(() => vi.fn(() => ''))

vi.mock('@/services/matrix/messaging/MatrixForwardService', () => ({
  matrixForwardService: {
    forwardEvent: mockForwardEvent,
    forwardEventToMultipleRooms: mockForwardEventToMultipleRooms
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: mockShowFeedback
  })
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({
    get sessionList() {
      return mockSessionList()
    }
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    get currentSessionRoomId() {
      return mockCurrentSessionRoomId()
    }
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'message.forward.success' && params) {
        return `已转发到 ${params.count} 个房间`
      }
      return key
    }
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: mockLoggerError,
    info: mockLoggerInfo,
    warn: vi.fn()
  })
}))

import { useMessageForward } from '../useMessageForward'

// 构造模拟的 MatrixEvent
const createMockEvent = (overrides: Partial<{ eventId: string; roomId: string; body: string }> = {}) => {
  const { eventId = '$event:1', roomId = '!source:server', body = 'hello' } = overrides
  return {
    getId: () => eventId,
    getRoomId: () => roomId,
    getType: () => 'm.room.message',
    getContent: () => ({ body, msgtype: 'm.text' }),
    getSender: () => '@user:server'
  } as any
}

const sessionsFixture = [
  { roomId: '!a:server', name: 'Room A', avatar: '', activeTime: 1000, remark: '' },
  { roomId: '!b:server', name: 'Room B', avatar: '', activeTime: 2000, remark: 'B Remark' },
  { roomId: '!c:server', name: 'Room C', avatar: '', activeTime: 3000, remark: '' },
  { roomId: '!source:server', name: 'Source Room', avatar: '', activeTime: 4000, remark: '' }
]

describe('useMessageForward', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSessionList.mockReturnValue(sessionsFixture)
    mockCurrentSessionRoomId.mockReturnValue('')
    mockForwardEvent.mockResolvedValue('$new:1')
    mockForwardEventToMultipleRooms.mockResolvedValue([])
  })

  describe('初始状态', () => {
    it('targetRoomIds 初始为空数组', () => {
      const flow = useMessageForward({ sourceEvent: null })
      expect(flow.targetRoomIds.value).toEqual([])
    })

    it('forwarding 初始为 false', () => {
      const flow = useMessageForward({ sourceEvent: null })
      expect(flow.forwarding.value).toBe(false)
    })

    it('error 初始为 null', () => {
      const flow = useMessageForward({ sourceEvent: null })
      expect(flow.error.value).toBeNull()
    })
  })

  describe('toggleRoom', () => {
    it('选中未选中的房间,添加到 targetRoomIds', () => {
      const flow = useMessageForward({ sourceEvent: null })
      flow.toggleRoom('!a:server')
      expect(flow.targetRoomIds.value).toEqual(['!a:server'])
    })

    it('再次 toggle 同一房间则移除', () => {
      const flow = useMessageForward({ sourceEvent: null })
      flow.toggleRoom('!a:server')
      flow.toggleRoom('!b:server')
      flow.toggleRoom('!a:server')
      expect(flow.targetRoomIds.value).toEqual(['!b:server'])
    })

    it('空字符串 roomId 不会添加', () => {
      const flow = useMessageForward({ sourceEvent: null })
      flow.toggleRoom('')
      expect(flow.targetRoomIds.value).toEqual([])
    })
  })

  describe('isRoomSelected', () => {
    it('已选中的房间返回 true', () => {
      const flow = useMessageForward({ sourceEvent: null })
      flow.toggleRoom('!a:server')
      expect(flow.isRoomSelected('!a:server')).toBe(true)
    })

    it('未选中的房间返回 false', () => {
      const flow = useMessageForward({ sourceEvent: null })
      expect(flow.isRoomSelected('!a:server')).toBe(false)
    })
  })

  describe('recentRooms', () => {
    it('排除当前会话房间', () => {
      mockCurrentSessionRoomId.mockReturnValue('!a:server')
      const flow = useMessageForward({ sourceEvent: null })
      const roomIds = flow.recentRooms.value.map((r) => r.roomId)
      expect(roomIds).not.toContain('!a:server')
    })

    it('排除源消息所在房间', () => {
      const event = createMockEvent({ roomId: '!source:server' })
      const flow = useMessageForward({ sourceEvent: event })
      const roomIds = flow.recentRooms.value.map((r) => r.roomId)
      expect(roomIds).not.toContain('!source:server')
    })

    it('按 activeTime 倒序排列,优先返回最近活跃的会话', () => {
      const flow = useMessageForward({ sourceEvent: null })
      const rooms = flow.recentRooms.value
      expect(rooms[0].roomId).toBe('!source:server')
      expect(rooms[1].roomId).toBe('!c:server')
      expect(rooms[2].roomId).toBe('!b:server')
      expect(rooms[3].roomId).toBe('!a:server')
    })

    it('使用 remark 优先于 name 作为显示名称', () => {
      const flow = useMessageForward({ sourceEvent: null })
      const roomB = flow.recentRooms.value.find((r) => r.roomId === '!b:server')
      expect(roomB?.name).toBe('B Remark')
    })
  })

  describe('forward', () => {
    it('sourceEvent 为 null 时返回 0 并显示错误反馈', async () => {
      const flow = useMessageForward({ sourceEvent: null })
      const result = await flow.forward()
      expect(result).toBe(0)
      expect(mockShowFeedback).toHaveBeenCalledWith('message.forward.failed', 'error')
      expect(mockLoggerError).toHaveBeenCalled()
      expect(mockForwardEvent).not.toHaveBeenCalled()
    })

    it('targetRoomIds 为空时返回 0 且不调用服务', async () => {
      const event = createMockEvent()
      const flow = useMessageForward({ sourceEvent: event })
      const result = await flow.forward()
      expect(result).toBe(0)
      expect(mockForwardEvent).not.toHaveBeenCalled()
      expect(mockForwardEventToMultipleRooms).not.toHaveBeenCalled()
    })

    it('单房间转发调用 forwardEvent 并显示成功反馈', async () => {
      const event = createMockEvent()
      const flow = useMessageForward({ sourceEvent: event })
      flow.toggleRoom('!target:server')
      const result = await flow.forward()

      expect(result).toBe(1)
      expect(mockForwardEvent).toHaveBeenCalledWith(event, '!target:server')
      expect(mockForwardEventToMultipleRooms).not.toHaveBeenCalled()
      expect(mockShowFeedback).toHaveBeenCalledWith('已转发到 1 个房间', 'success')
    })

    it('多房间转发调用 forwardEventToMultipleRooms', async () => {
      mockForwardEventToMultipleRooms.mockResolvedValueOnce([
        { roomId: '!a:server', success: true, eventId: '$new:1' },
        { roomId: '!b:server', success: true, eventId: '$new:2' }
      ])
      const event = createMockEvent()
      const flow = useMessageForward({ sourceEvent: event })
      flow.toggleRoom('!a:server')
      flow.toggleRoom('!b:server')
      const result = await flow.forward()

      expect(result).toBe(2)
      expect(mockForwardEventToMultipleRooms).toHaveBeenCalledWith(event, ['!a:server', '!b:server'])
      expect(mockForwardEvent).not.toHaveBeenCalled()
      expect(mockShowFeedback).toHaveBeenCalledWith('已转发到 2 个房间', 'success')
    })

    it('单房间转发失败时显示错误反馈', async () => {
      mockForwardEvent.mockRejectedValueOnce(new Error('network error'))
      const event = createMockEvent()
      const flow = useMessageForward({ sourceEvent: event })
      flow.toggleRoom('!target:server')
      const result = await flow.forward()

      expect(result).toBe(0)
      expect(mockShowFeedback).toHaveBeenCalledWith('message.forward.failed', 'error')
      expect(flow.error.value).toBe('message.forward.failed')
    })

    it('多房间部分失败时仅统计成功数量', async () => {
      mockForwardEventToMultipleRooms.mockResolvedValueOnce([
        { roomId: '!a:server', success: true, eventId: '$new:1' },
        { roomId: '!b:server', success: false, error: 'denied' }
      ])
      const event = createMockEvent()
      const flow = useMessageForward({ sourceEvent: event })
      flow.toggleRoom('!a:server')
      flow.toggleRoom('!b:server')
      const result = await flow.forward()

      expect(result).toBe(1)
      expect(mockShowFeedback).toHaveBeenCalledWith('已转发到 1 个房间', 'success')
    })

    it('多房间全部失败时显示错误反馈', async () => {
      mockForwardEventToMultipleRooms.mockResolvedValueOnce([
        { roomId: '!a:server', success: false, error: 'denied' },
        { roomId: '!b:server', success: false, error: 'denied' }
      ])
      const event = createMockEvent()
      const flow = useMessageForward({ sourceEvent: event })
      flow.toggleRoom('!a:server')
      flow.toggleRoom('!b:server')
      const result = await flow.forward()

      expect(result).toBe(0)
      expect(mockShowFeedback).toHaveBeenCalledWith('message.forward.failed', 'error')
      expect(flow.error.value).toBe('message.forward.failed')
    })

    it('forwarding 状态在转发过程中正确切换', async () => {
      let resolveForward: (value: string) => void
      mockForwardEvent.mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveForward = resolve
          })
      )
      const event = createMockEvent()
      const flow = useMessageForward({ sourceEvent: event })
      flow.toggleRoom('!target:server')

      const promise = flow.forward()
      expect(flow.forwarding.value).toBe(true)

      resolveForward!('ok')
      await promise
      expect(flow.forwarding.value).toBe(false)
    })
  })

  describe('setSourceEvent', () => {
    it('更新 sourceEvent 后可正常转发', async () => {
      const flow = useMessageForward({ sourceEvent: null })
      // 初始无事件,转发失败
      await flow.forward()
      expect(mockForwardEvent).not.toHaveBeenCalled()

      // 注入事件后可转发
      const event = createMockEvent()
      flow.setSourceEvent(event)
      flow.toggleRoom('!target:server')
      await flow.forward()
      expect(mockForwardEvent).toHaveBeenCalledWith(event, '!target:server')
    })

    it('更新 sourceEvent 后清除 error', () => {
      const flow = useMessageForward({ sourceEvent: null })
      flow.error.value = 'some error'
      flow.setSourceEvent(createMockEvent())
      expect(flow.error.value).toBeNull()
    })
  })

  describe('reset', () => {
    it('清空 targetRoomIds、forwarding、error', () => {
      const event = createMockEvent()
      const flow = useMessageForward({ sourceEvent: event })
      flow.toggleRoom('!a:server')
      flow.forwarding.value = true
      flow.error.value = 'some error'

      flow.reset()
      expect(flow.targetRoomIds.value).toEqual([])
      expect(flow.forwarding.value).toBe(false)
      expect(flow.error.value).toBeNull()
    })
  })
})
