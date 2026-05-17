import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import { useMessageActions } from '../useMessageActions'

const { showFeedbackMock, sendTextMessageMock, toggleReactionMock, updateMsgMock, loggerErrorMock } = vi.hoisted(
  () => ({
    showFeedbackMock: vi.fn(),
    sendTextMessageMock: vi.fn(),
    toggleReactionMock: vi.fn(),
    updateMsgMock: vi.fn(),
    loggerErrorMock: vi.fn()
  })
)

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/services/matrix/MatrixEventService', () => ({
  matrixEventService: {
    sendTextMessage: sendTextMessageMock
  }
}))

vi.mock('@/services/matrix/messaging/MatrixReactionService', () => ({
  matrixReactionService: {
    toggleReaction: toggleReactionMock
  }
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => ({
    updateMsg: updateMsgMock
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock
  })
}))

vi.mock('@/utils/messageBody', () => ({
  toSafeBody: (body: Record<string, unknown>) => body
}))

describe('useMessageActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sendTextMessageMock.mockResolvedValue('$resent')
    toggleReactionMock.mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn()
      }
    })
  })

  it('uses action feedback for retry success and failure', async () => {
    const { handleRetry } = useMessageActions({
      isMe: computed(() => true),
      emojiList: computed(() => [])
    })

    const item = {
      message: {
        id: 'msg-1',
        roomId: '!room:example.com',
        type: MsgEnum.TEXT,
        body: {
          text: 'hello'
        }
      }
    } as any

    await handleRetry(item)

    expect(updateMsgMock).toHaveBeenCalledWith({
      msgId: 'msg-1',
      status: MessageStatusEnum.SENDING
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('message_container.resend_success', 'success')

    sendTextMessageMock.mockRejectedValueOnce(new Error('resend failed'))
    await handleRetry(item)

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(updateMsgMock).toHaveBeenCalledWith({
      msgId: 'msg-1',
      status: MessageStatusEnum.FAILED
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('message_container.resend_failed', 'error')
  })

  it('uses action feedback when copying a translation', () => {
    const { handleCopyTranslation } = useMessageActions({
      isMe: computed(() => true),
      emojiList: computed(() => [])
    })

    handleCopyTranslation('translated text')

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('translated text')
    expect(showFeedbackMock).toHaveBeenCalledWith('message_container.copy_success', 'success')
  })

  it('uses action feedback when selecting an already-marked emoji', async () => {
    const { handleEmojiSelect } = useMessageActions({
      isMe: computed(() => true),
      emojiList: computed(() => [])
    })

    const item = {
      message: {
        id: 'msg-1',
        roomId: '!room:example.com',
        messageMarks: {
          1: {
            count: 1,
            userMarked: true
          }
        }
      }
    } as any

    await handleEmojiSelect({ label: 'like', value: 1, title: 'like' }, item)

    expect(toggleReactionMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('message_container.emoji_already_marked', 'warning')
  })
})
