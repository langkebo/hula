import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import { useMsgInputFileUpload } from '../useMsgInputFileUpload'

const {
  showFeedbackMock,
  getStrategyMock,
  checkQuotaMock,
  initQueueMock,
  updateFileStatusMock,
  queueState,
  requestAnimationFrameMock,
  cancelAnimationFrameMock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  getStrategyMock: vi.fn(),
  checkQuotaMock: vi.fn(),
  initQueueMock: vi.fn((files: File[]) => {
    queueState.items = files.map((_, index) => ({ id: `file-${index + 1}` }))
  }),
  updateFileStatusMock: vi.fn(),
  queueState: {
    items: [] as Array<{ id: string }>
  },
  requestAnimationFrameMock: vi.fn((callback: FrameRequestCallback) => {
    callback(0)
    return 1
  }),
  cancelAnimationFrameMock: vi.fn()
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

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    emit: vi.fn()
  }
}))

vi.mock('@/services/matrix/crypto/CryptoSDKAdapter', () => ({
  cryptoSDKAdapter: {
    requireRoomEncryptionState: vi.fn().mockResolvedValue(false)
  }
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    checkQuota: checkQuotaMock,
    uploadEncryptedFile: vi.fn()
  }
}))

vi.mock('@/strategy/MessageStrategy.ts', () => ({
  getStrategy: getStrategyMock
}))

vi.mock('../../common/useFileUploadQueue', () => ({
  globalFileUploadQueue: {
    initQueue: initQueueMock,
    updateFileStatus: updateFileStatusMock,
    queue: queueState
  }
}))

vi.mock('../../common/useUpload', () => ({
  UploadProviderEnum: { DEFAULT: 'default' },
  useUpload: () => ({
    uploadFile: vi.fn(),
    generateHashKey: vi.fn()
  })
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn()
}))

vi.mock('p-limit', () => ({
  default: () => (task: () => Promise<unknown>) => task()
}))

const createStrategy = () => ({
  buildMessageType: vi.fn((id: string) => ({
    fromUser: { uid: '@me:example.com', username: 'Me', avatar: '' },
    message: {
      id,
      roomId: '',
      sendTime: Date.now(),
      status: MessageStatusEnum.PENDING,
      type: MsgEnum.FILE,
      body: {},
      messageMarks: {}
    },
    sendTime: Date.now(),
    loading: false
  })),
  buildMessageBody: vi.fn(() => ({})),
  getMsg: vi.fn(async () => ({
    type: MsgEnum.FILE,
    path: '/tmp/a.txt',
    fileName: 'a.txt',
    size: 100,
    mimeType: 'text/plain'
  })),
  uploadFile: vi.fn().mockResolvedValue({ uploadUrl: 'u', downloadUrl: 'd', config: {} }),
  doUpload: vi.fn().mockResolvedValue('mxc://example.com/a')
})

const createContext = () => ({
  reply: ref({ avatar: '', accountName: '', content: '', key: '', imgCount: 0 }),
  userUid: ref('@me:example.com'),
  globalStore: { currentSessionRoomId: '!room:example.com' },
  chatStore: {
    pushMsg: vi.fn().mockResolvedValue(undefined),
    updateMsg: vi.fn(),
    updateSessionLastActiveTime: vi.fn()
  },
  sendWithTracking: vi.fn().mockResolvedValue(undefined),
  getMessageContentType: vi.fn(() => MsgEnum.TEXT)
})

const createUploader = (ctx = createContext()) => {
  const messageInputDom = ref(document.createElement('div'))
  const uploader = useMsgInputFileUpload(messageInputDom, ctx, vi.fn())
  return { uploader, ctx }
}

const makeFile = (name: string, size: number) =>
  Object.defineProperty(new File(['x'], name, { type: 'text/plain' }), 'size', { value: size })

describe('useMsgInputFileUpload 配额预检', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock)
    queueState.items = []
    getStrategyMock.mockResolvedValue(createStrategy())
    checkQuotaMock.mockResolvedValue({ limit: 1000, used: 100, remaining: 900 })
  })

  it('剩余空间不足时上传前提示且不创建队列', async () => {
    const { uploader } = createUploader()

    await uploader.sendFilesDirect([makeFile('a.txt', 600), makeFile('b.txt', 500)])

    expect(showFeedbackMock).toHaveBeenCalledWith('setting.storage.quota_exceeded_upload', 'warning')
    expect(initQueueMock).not.toHaveBeenCalled()
    expect(getStrategyMock).not.toHaveBeenCalled()
  })

  it('剩余空间充足时正常进入上传流程', async () => {
    const { uploader, ctx } = createUploader()

    await uploader.sendFilesDirect([makeFile('a.txt', 100)])

    expect(showFeedbackMock).not.toHaveBeenCalledWith('setting.storage.quota_exceeded_upload', 'warning')
    expect(initQueueMock).toHaveBeenCalledTimes(1)
    // 一次由 sendFilesDirect 预插入占位消息，一次由 processGenericFile 追加任务消息
    expect(ctx.chatStore.pushMsg).toHaveBeenCalledTimes(2)
  })

  it('配额接口不可用（返回 null）时放行上传', async () => {
    checkQuotaMock.mockResolvedValue(null)
    const { uploader, ctx } = createUploader()

    await uploader.sendFilesDirect([makeFile('a.txt', 100)])

    expect(initQueueMock).toHaveBeenCalledTimes(1)
    expect(ctx.chatStore.pushMsg).toHaveBeenCalledTimes(2)
  })

  it('配额上限为 0 视为未启用配额，直接放行', async () => {
    checkQuotaMock.mockResolvedValue({ limit: 0, used: 0, remaining: 0 })
    const { uploader } = createUploader()

    await uploader.sendFilesDirect([makeFile('a.txt', 100)])

    expect(initQueueMock).toHaveBeenCalledTimes(1)
  })
})
