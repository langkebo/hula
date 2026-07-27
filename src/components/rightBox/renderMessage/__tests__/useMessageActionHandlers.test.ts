import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MittEnum } from '@/enums'
import { useMessageActionHandlers } from '../useMessageActionHandlers'

const {
  showFeedbackMock,
  recallMessageMock,
  redactEventMock,
  toggleReactionMock,
  pinEventMock,
  unpinEventMock,
  deleteMsgMock,
  mittEmitMock,
  loggerErrorMock,
  clipboardWriteTextMock,
  dialogWarningMock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  recallMessageMock: vi.fn(),
  redactEventMock: vi.fn(),
  toggleReactionMock: vi.fn(),
  pinEventMock: vi.fn(),
  unpinEventMock: vi.fn(),
  deleteMsgMock: vi.fn(),
  mittEmitMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  clipboardWriteTextMock: vi.fn(),
  dialogWarningMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: { emit: mittEmitMock, on: vi.fn(), off: vi.fn() }
}))

vi.mock('@/services/matrix/MatrixEventService', () => ({
  matrixEventService: { redactEvent: redactEventMock }
}))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: { recallMessage: recallMessageMock }
}))

vi.mock('@/services/matrix/messaging/MatrixReactionService', () => ({
  matrixReactionService: { toggleReaction: toggleReactionMock }
}))

vi.mock('@/services/matrix/room/ActionFacade', () => ({
  matrixRoomActionFacade: {
    pinEvent: pinEventMock,
    unpinEvent: unpinEventMock
  }
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({ deleteMsg: deleteMsgMock })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: loggerErrorMock })
}))

const buildMessage = (overrides: Partial<{ id: string; roomId: string; text: string }> = {}) =>
  ({
    clientKey: 'msg-1',
    fromUser: { uid: '@alice:server', username: 'Alice', avatar: '' },
    message: {
      id: overrides.id ?? '$event-1:server',
      roomId: overrides.roomId ?? '!room-1:server',
      sendTime: Date.now(),
      status: 0,
      type: 1,
      // TEXT 策略的 buildMessageBody 使用 content 字段
      body: { content: overrides.text ?? 'hello' },
      messageMarks: {}
    },
    sendTime: Date.now(),
    loading: false
  }) as any

describe('useMessageActionHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // window.$dialog.warning 默认立即调用 onPositiveClick
    dialogWarningMock.mockImplementation(({ onPositiveClick }: { onPositiveClick?: () => Promise<void> }) => {
      if (onPositiveClick) void onPositiveClick()
    })
    window.$dialog = { warning: dialogWarningMock } as any
    // clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: clipboardWriteTextMock },
      configurable: true
    })
  })

  describe('handleReply', () => {
    it('emits REPLY_MEG mitt event with message', () => {
      const handlers = useMessageActionHandlers()
      const msg = buildMessage()
      handlers.handleReply(msg)
      expect(mittEmitMock).toHaveBeenCalledWith(MittEnum.REPLY_MEG, msg)
    })
  })

  describe('handleCopy', () => {
    it('writes text to clipboard and shows success feedback', async () => {
      const handlers = useMessageActionHandlers()
      await handlers.handleCopy(buildMessage({ text: 'hello world' }))
      expect(clipboardWriteTextMock).toHaveBeenCalledWith('hello world')
      expect(showFeedbackMock).toHaveBeenCalledWith('message.copy_success', 'success')
    })

    it('shows warning when text is empty', async () => {
      const handlers = useMessageActionHandlers()
      await handlers.handleCopy(buildMessage({ text: '' }))
      expect(clipboardWriteTextMock).not.toHaveBeenCalled()
      expect(showFeedbackMock).toHaveBeenCalledWith('message.copy_empty', 'warning')
    })

    it('shows error feedback when clipboard write fails', async () => {
      clipboardWriteTextMock.mockRejectedValueOnce(new Error('denied'))
      const handlers = useMessageActionHandlers()
      await handlers.handleCopy(buildMessage({ text: 'hello' }))
      expect(loggerErrorMock).toHaveBeenCalled()
      expect(showFeedbackMock).toHaveBeenCalledWith('message.copy_failed', 'error')
    })
  })

  describe('handleMark', () => {
    it('calls toggleReaction with roomId, eventId, and LIKE key', async () => {
      const handlers = useMessageActionHandlers()
      await handlers.handleMark(buildMessage())
      expect(toggleReactionMock).toHaveBeenCalledWith('!room-1:server', '$event-1:server', '1')
    })

    it('shows error feedback when toggle fails', async () => {
      toggleReactionMock.mockRejectedValueOnce(new Error('forbidden'))
      const handlers = useMessageActionHandlers()
      await handlers.handleMark(buildMessage())
      expect(showFeedbackMock).toHaveBeenCalledWith('message.mark_failed', 'error')
    })
  })

  describe('handlePin', () => {
    it('calls pinEvent when not pinned', async () => {
      const handlers = useMessageActionHandlers()
      await handlers.handlePin(buildMessage(), false)
      expect(pinEventMock).toHaveBeenCalledWith('!room-1:server', '$event-1:server')
      expect(unpinEventMock).not.toHaveBeenCalled()
      expect(showFeedbackMock).toHaveBeenCalledWith('message.pin_success', 'success')
    })

    it('calls unpinEvent when already pinned', async () => {
      const handlers = useMessageActionHandlers()
      await handlers.handlePin(buildMessage(), true)
      expect(unpinEventMock).toHaveBeenCalledWith('!room-1:server', '$event-1:server')
      expect(pinEventMock).not.toHaveBeenCalled()
      expect(showFeedbackMock).toHaveBeenCalledWith('message.unpin_success', 'success')
    })

    it('shows error feedback when pin fails', async () => {
      pinEventMock.mockRejectedValueOnce(new Error('forbidden'))
      const handlers = useMessageActionHandlers()
      await handlers.handlePin(buildMessage(), false)
      expect(showFeedbackMock).toHaveBeenCalledWith('message.pin_failed', 'error')
    })
  })

  describe('handleRecall', () => {
    it('opens warning dialog and calls recallMessage on positive click', async () => {
      const handlers = useMessageActionHandlers()
      handlers.handleRecall(buildMessage())
      await flushPromises()

      expect(dialogWarningMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'message.recall_confirm_title',
          content: 'message.recall_confirm_content'
        })
      )
      expect(recallMessageMock).toHaveBeenCalledWith('!room-1:server', '$event-1:server')
      expect(showFeedbackMock).toHaveBeenCalledWith('message.recall_success', 'success')
    })

    it('shows error feedback when recall fails', async () => {
      recallMessageMock.mockRejectedValueOnce(new Error('redact failed'))
      const handlers = useMessageActionHandlers()
      handlers.handleRecall(buildMessage())
      await flushPromises()

      expect(loggerErrorMock).toHaveBeenCalled()
      expect(showFeedbackMock).toHaveBeenCalledWith('message.recall_failed', 'error')
    })

    it('does not call recallMessage when dialog dismissed without positive click', async () => {
      dialogWarningMock.mockImplementation(() => {
        // no-op: user cancelled
      })
      const handlers = useMessageActionHandlers()
      handlers.handleRecall(buildMessage())
      await flushPromises()

      expect(recallMessageMock).not.toHaveBeenCalled()
    })
  })

  describe('handleDelete', () => {
    it('opens warning dialog and calls redactEvent + deleteMsg on positive click', async () => {
      const handlers = useMessageActionHandlers()
      handlers.handleDelete(buildMessage())
      await flushPromises()

      expect(dialogWarningMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'message.delete_confirm_title',
          content: 'message.delete_confirm_content'
        })
      )
      expect(redactEventMock).toHaveBeenCalledWith('!room-1:server', '$event-1:server')
      expect(deleteMsgMock).toHaveBeenCalledWith('$event-1:server')
      expect(showFeedbackMock).toHaveBeenCalledWith('message.delete_success', 'success')
    })

    it('shows error feedback when delete fails', async () => {
      redactEventMock.mockRejectedValueOnce(new Error('delete failed'))
      const handlers = useMessageActionHandlers()
      handlers.handleDelete(buildMessage())
      await flushPromises()

      expect(showFeedbackMock).toHaveBeenCalledWith('message.delete_failed', 'error')
      expect(deleteMsgMock).not.toHaveBeenCalled()
    })
  })

  describe('handleEdit', () => {
    it('invokes provided openInlineEditor callback with the message', () => {
      const handlers = useMessageActionHandlers()
      const openInlineEditor = vi.fn()
      const msg = buildMessage()
      handlers.handleEdit(msg, openInlineEditor)
      expect(openInlineEditor).toHaveBeenCalledWith(msg)
    })
  })

  describe('handleForward', () => {
    it('invokes provided openForwardDialog callback with sourceRoomId and eventIds', () => {
      const handlers = useMessageActionHandlers()
      const openForwardDialog = vi.fn()
      handlers.handleForward(buildMessage(), openForwardDialog)
      expect(openForwardDialog).toHaveBeenCalledWith({
        sourceRoomId: '!room-1:server',
        eventIds: ['$event-1:server']
      })
    })
  })
})
