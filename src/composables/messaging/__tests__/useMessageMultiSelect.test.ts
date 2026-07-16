import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockRecallMessage,
  mockGetRoomMessage,
  mockShowFeedback,
  mockLoggerError,
  mockLoggerInfo,
  mockForwardSetSourceEvent,
  mockClipboardWriteText
} = vi.hoisted(() => ({
  mockRecallMessage: vi.fn(),
  mockGetRoomMessage: vi.fn(),
  mockShowFeedback: vi.fn(),
  mockLoggerError: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockForwardSetSourceEvent: vi.fn(),
  mockClipboardWriteText: vi.fn()
}))

// chat store 状态 mock
const mockIsMsgMultiChoose = vi.hoisted(() => ({ value: false }))
const mockSetMsgMultiChoose = vi.hoisted(() => vi.fn())
const mockChatMessageListByRoomId = vi.hoisted(() => vi.fn(() => [] as any[]))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: {
    recallMessage: mockRecallMessage,
    getRoomMessage: mockGetRoomMessage
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: mockShowFeedback
  })
}))

vi.mock('@/composables/messaging/useMessageForward', () => ({
  useMessageForward: () => ({
    setSourceEvent: mockForwardSetSourceEvent,
    targetRoomIds: { value: [] },
    forwarding: { value: false },
    error: { value: null },
    recentRooms: { value: [] },
    toggleRoom: vi.fn(),
    isRoomSelected: vi.fn(),
    forward: vi.fn(),
    reset: vi.fn()
  })
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({
    get isMsgMultiChoose() {
      return mockIsMsgMultiChoose.value
    },
    setMsgMultiChoose: mockSetMsgMultiChoose,
    chatMessageListByRoomId: mockChatMessageListByRoomId
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params && typeof params.count === 'number') {
        return `${key}:${params.count}`
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

import type { MessageType } from '@/types/message'
import { useMessageMultiSelect } from '../useMessageMultiSelect'

// 构造模拟的 MessageType
const createMockMessage = (
  overrides: Partial<{ id: string; content: string; body: string; text: string }> = {}
): MessageType => {
  const { id = '$msg:1', content = 'hello', body = '', text = '' } = overrides
  return {
    message: {
      id,
      roomId: '!room:server',
      sendTime: Date.now(),
      type: 'text' as any,
      body: { content, body, text }
    },
    fromUser: { uid: '@user:server' }
  } as MessageType
}

const roomMessagesFixture: MessageType[] = [
  createMockMessage({ id: '$msg:1', content: '第一条消息' }),
  createMockMessage({ id: '$msg:2', content: '第二条消息' }),
  createMockMessage({ id: '$msg:3', content: '第三条消息' })
]

// mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockClipboardWriteText,
    readText: vi.fn()
  },
  configurable: true,
  writable: true
})

describe('useMessageMultiSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsMsgMultiChoose.value = false
    mockSetMsgMultiChoose.mockImplementation((flag: boolean) => {
      mockIsMsgMultiChoose.value = flag
    })
    mockChatMessageListByRoomId.mockReturnValue(roomMessagesFixture)
    mockClipboardWriteText.mockResolvedValue(undefined)
    mockRecallMessage.mockResolvedValue(undefined)
    mockGetRoomMessage.mockResolvedValue({ getId: () => '$msg:1' })
  })

  describe('初始状态', () => {
    it('selectedIds 初始为空数组', () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      expect(ms.selectedIds.value).toEqual([])
    })

    it('multiSelectMode 初始为 false', () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      expect(ms.multiSelectMode.value).toBe(false)
    })

    it('processing 初始为 false', () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      expect(ms.processing.value).toBe(false)
    })

    it('selectedMessages 初始为空数组', () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      expect(ms.selectedMessages.value).toEqual([])
    })

    it('isAllSelected 在无消息时为 false', () => {
      mockChatMessageListByRoomId.mockReturnValue([])
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      expect(ms.isAllSelected.value).toBe(false)
    })
  })

  describe('enterMultiSelect', () => {
    it('调用后通过 chat store 开启多选模式', () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.enterMultiSelect()
      expect(mockSetMsgMultiChoose).toHaveBeenCalledWith(true, 'normal')
    })
  })

  describe('exitMultiSelect', () => {
    it('清空 selectedIds 并关闭多选模式', () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.toggleSelect('$msg:1')
      ms.toggleSelect('$msg:2')
      ms.exitMultiSelect()
      expect(ms.selectedIds.value).toEqual([])
      expect(mockSetMsgMultiChoose).toHaveBeenCalledWith(false, 'normal')
    })
  })

  describe('toggleSelect', () => {
    it('选中未选中的消息,添加到 selectedIds', () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.toggleSelect('$msg:1')
      expect(ms.selectedIds.value).toEqual(['$msg:1'])
    })

    it('再次 toggle 同一消息则移除', () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.toggleSelect('$msg:1')
      ms.toggleSelect('$msg:2')
      ms.toggleSelect('$msg:1')
      expect(ms.selectedIds.value).toEqual(['$msg:2'])
    })

    it('空字符串 msgId 不会添加', () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.toggleSelect('')
      expect(ms.selectedIds.value).toEqual([])
    })
  })

  describe('isSelected', () => {
    it('已选中的消息返回 true', () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.toggleSelect('$msg:1')
      expect(ms.isSelected('$msg:1')).toBe(true)
    })

    it('未选中的消息返回 false', () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      expect(ms.isSelected('$msg:1')).toBe(false)
    })
  })

  describe('selectAll', () => {
    it('选中当前房间所有消息', () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.selectAll()
      expect(ms.selectedIds.value).toEqual(['$msg:1', '$msg:2', '$msg:3'])
      expect(ms.isAllSelected.value).toBe(true)
    })
  })

  describe('clearSelection', () => {
    it('清空选择但保持多选模式', () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.enterMultiSelect()
      ms.selectAll()
      ms.clearSelection()
      expect(ms.selectedIds.value).toEqual([])
    })
  })

  describe('batchCopy', () => {
    it('成功复制已选消息文本', async () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.toggleSelect('$msg:1')
      ms.toggleSelect('$msg:2')
      const result = await ms.batchCopy()
      expect(result).toBe(true)
      expect(mockClipboardWriteText).toHaveBeenCalledWith('第一条消息\n第二条消息')
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_chat.multi_select.copy_success', 'success')
    })

    it('空选择时显示警告并返回 false', async () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      const result = await ms.batchCopy()
      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_chat.multi_select.empty_selection', 'warning')
      expect(mockClipboardWriteText).not.toHaveBeenCalled()
    })

    it('clipboard 写入失败时显示错误并返回 false', async () => {
      mockClipboardWriteText.mockRejectedValueOnce(new Error('denied'))
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.toggleSelect('$msg:1')
      const result = await ms.batchCopy()
      expect(result).toBe(false)
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_chat.multi_select.copy_failed', 'error')
      expect(mockLoggerError).toHaveBeenCalled()
    })
  })

  describe('batchForward', () => {
    it('单条选择返回首条消息目标并注入源事件', async () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.toggleSelect('$msg:1')
      const result = await ms.batchForward()
      expect(result).not.toBeNull()
      expect(result?.eventId).toBe('$msg:1')
      expect(result?.roomId).toBe('!room:server')
      expect(mockGetRoomMessage).toHaveBeenCalledWith('!room:server', '$msg:1')
      expect(mockForwardSetSourceEvent).toHaveBeenCalled()
    })

    it('多条选择返回首条消息目标', async () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.toggleSelect('$msg:2')
      ms.toggleSelect('$msg:3')
      const result = await ms.batchForward()
      expect(result?.eventId).toBe('$msg:2')
      expect(mockLoggerInfo).toHaveBeenCalled()
    })

    it('空选择显示警告并返回 null', async () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      const result = await ms.batchForward()
      expect(result).toBeNull()
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_chat.multi_select.empty_selection', 'warning')
      expect(mockGetRoomMessage).not.toHaveBeenCalled()
    })
  })

  describe('batchDelete', () => {
    it('成功删除所有已选消息', async () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.toggleSelect('$msg:1')
      ms.toggleSelect('$msg:2')
      const result = await ms.batchDelete()
      expect(result).toBe(2)
      expect(mockRecallMessage).toHaveBeenCalledTimes(2)
      expect(mockRecallMessage).toHaveBeenCalledWith('!room:server', '$msg:1')
      expect(mockRecallMessage).toHaveBeenCalledWith('!room:server', '$msg:2')
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_chat.multi_select.delete_success', 'success')
      expect(ms.selectedIds.value).toEqual([])
    })

    it('部分失败时仅统计成功数量', async () => {
      mockRecallMessage.mockRejectedValueOnce(new Error('denied'))
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.toggleSelect('$msg:1')
      ms.toggleSelect('$msg:2')
      const result = await ms.batchDelete()
      expect(result).toBe(1)
      expect(mockLoggerError).toHaveBeenCalled()
    })

    it('全部失败时显示错误反馈', async () => {
      mockRecallMessage.mockRejectedValue(new Error('denied'))
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.toggleSelect('$msg:1')
      const result = await ms.batchDelete()
      expect(result).toBe(0)
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_chat.multi_select.copy_failed', 'error')
    })

    it('空选择显示警告并返回 0', async () => {
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      const result = await ms.batchDelete()
      expect(result).toBe(0)
      expect(mockShowFeedback).toHaveBeenCalledWith('mobile_chat.multi_select.empty_selection', 'warning')
      expect(mockRecallMessage).not.toHaveBeenCalled()
    })

    it('processing 状态在删除过程中正确切换', async () => {
      let resolveDelete: () => void
      mockRecallMessage.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve
          })
      )
      const ms = useMessageMultiSelect({ roomId: '!room:server' })
      ms.toggleSelect('$msg:1')
      const promise = ms.batchDelete()
      expect(ms.processing.value).toBe(true)
      resolveDelete!()
      await promise
      expect(ms.processing.value).toBe(false)
    })
  })

  describe('roomId 支持 ref', () => {
    it('roomId 为空时 messages 返回空数组', () => {
      const ms = useMessageMultiSelect({ roomId: '' })
      expect(ms.messages.value).toEqual([])
    })
  })
})
