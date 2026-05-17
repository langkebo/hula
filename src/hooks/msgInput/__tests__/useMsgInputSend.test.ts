import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { LimitEnum, MessageStatusEnum, MsgEnum } from '@/enums'
import { useMsgInputSend } from '../useMsgInputSend'

const {
  showFeedbackMock,
  getStrategyMock,
  isRoomEncryptedMock,
  uploadEncryptedFileMock,
  initQueueMock,
  updateFileStatusMock,
  mittEmitMock,
  requestAnimationFrameMock,
  cancelAnimationFrameMock,
  queueState
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  getStrategyMock: vi.fn(),
  isRoomEncryptedMock: vi.fn(),
  uploadEncryptedFileMock: vi.fn(),
  initQueueMock: vi.fn((files: File[]) => {
    queueState.items = files.map((_, index) => ({ id: `file-${index + 1}` }))
  }),
  updateFileStatusMock: vi.fn(),
  mittEmitMock: vi.fn(),
  requestAnimationFrameMock: vi.fn((callback: FrameRequestCallback) => {
    callback(0)
    return 1
  }),
  cancelAnimationFrameMock: vi.fn(),
  queueState: {
    items: [] as Array<{ id: string }>
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/hooks/useMitt.ts', () => ({
  useMitt: {
    emit: mittEmitMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionService', () => ({
  matrixEncryptionService: {
    isRoomEncrypted: isRoomEncryptedMock
  }
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    uploadEncryptedFile: uploadEncryptedFileMock
  }
}))

vi.mock('@/strategy/MessageStrategy.ts', () => ({
  getStrategy: getStrategyMock
}))

vi.mock('../../useFileUploadQueue.ts', () => ({
  globalFileUploadQueue: {
    initQueue: initQueueMock,
    updateFileStatus: updateFileStatusMock,
    queue: queueState
  }
}))

vi.mock('../../useUpload.ts', () => ({
  UploadProviderEnum: { DEFAULT: 'default' },
  useUpload: () => ({
    uploadFile: vi.fn(),
    generateHashKey: vi.fn()
  })
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: () => false
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppData: 'AppData', AppCache: 'AppCache' },
  readFile: vi.fn()
}))

vi.mock('p-limit', () => ({
  default: () => (task: () => Promise<unknown>) => task()
}))

vi.mock('../mentionParser', () => ({
  extractAtUserIds: vi.fn(() => [])
}))

describe('useMsgInputSend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock)
    isRoomEncryptedMock.mockResolvedValue(false)
    queueState.items = []
  })

  const createOptions = () => {
    const messageInputDom = ref(document.createElement('div'))
    const msgInput = ref('')
    const reply = ref({
      avatar: '',
      accountName: '',
      content: '',
      key: '',
      imgCount: 0
    })
    const chatStore = {
      pushMsg: vi.fn().mockResolvedValue(undefined),
      updateMsg: vi.fn(),
      updateSessionLastActiveTime: vi.fn()
    }

    return {
      messageInputDom,
      msgInput,
      reply,
      userUid: ref('@me:example.com'),
      globalStore: {
        currentSessionRoomId: '!room:example.com'
      },
      groupStore: {
        userList: [],
        getUserInfo: vi.fn(() => ({ name: 'Me', avatar: '' }))
      },
      chatStore,
      getMessageContentType: vi.fn(() => MsgEnum.TEXT),
      resetInput: vi.fn(),
      sendWithTracking: vi.fn().mockResolvedValue(undefined),
      uploadVoiceToMatrix: vi.fn(),
      isBurnAfterRead: computed(() => false),
      burnDuration: computed(() => 0)
    }
  }

  it('图片数量超限时播报 warning', async () => {
    const options = createOptions()
    options.messageInputDom.value.innerHTML =
      '<img /><img /><img /><img /><img /><img /><img /><img /><img /><img /><img />'
    const sender = useMsgInputSend(options)

    await sender.send()

    expect(showFeedbackMock).toHaveBeenCalledWith(
      `hooks.msg_input.upload_limit:${JSON.stringify({ count: LimitEnum.COM_COUNT })}`,
      'warning'
    )
    expect(options.getMessageContentType).not.toHaveBeenCalled()
  })

  it('消息类型不支持时播报 warning', async () => {
    const options = createOptions()
    getStrategyMock.mockResolvedValue(null)
    const sender = useMsgInputSend(options)

    await sender.send()

    expect(showFeedbackMock).toHaveBeenCalledWith('hooks.msg_input.type_not_supported', 'warning')
  })

  it('文件直发失败时播报 error 并标记消息失败', async () => {
    const options = createOptions()
    getStrategyMock.mockResolvedValue({
      buildMessageType: vi.fn(async (id: string, body: Record<string, unknown>) => ({
        fromUser: { uid: '@me:example.com', username: 'Me', avatar: '' },
        message: {
          id,
          roomId: '!room:example.com',
          sendTime: Date.now(),
          status: MessageStatusEnum.PENDING,
          type: MsgEnum.FILE,
          body,
          messageMarks: {}
        },
        sendTime: Date.now(),
        loading: false
      })),
      buildMessageBody: vi.fn(() => ({
        url: '',
        fileName: 'demo.txt',
        size: 3,
        mimeType: 'text/plain'
      })),
      getMsg: vi.fn(),
      uploadFile: vi.fn(async () => {
        throw new Error('upload failed')
      }),
      doUpload: vi.fn()
    })

    const sender = useMsgInputSend(options)
    const file = new File(['abc'], 'demo.txt', { type: 'text/plain' })

    await sender.sendFilesDirect([file])

    expect(options.chatStore.updateMsg).toHaveBeenCalledWith({
      msgId: expect.any(String),
      status: MessageStatusEnum.FAILED
    })
    expect(showFeedbackMock).toHaveBeenCalledWith(
      `hooks.msg_input.file_send_failed:${JSON.stringify({ fileName: 'demo.txt' })}`,
      'error'
    )
    expect(updateFileStatusMock).toHaveBeenCalledWith('file-1', 'failed', 0)
  })
})
