import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import { useMsgInputFileUpload } from '../useMsgInputFileUpload'

const {
  showFeedbackMock,
  getStrategyMock,
  checkQuotaMock,
  uploadFileMock,
  initQueueMock,
  updateFileStatusMock,
  queueState,
  requestAnimationFrameMock,
  cancelAnimationFrameMock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  getStrategyMock: vi.fn(),
  checkQuotaMock: vi.fn(),
  uploadFileMock: vi
    .fn()
    .mockResolvedValue({ contentUri: 'mxc://example.com/blob', size: 100, mimetype: 'text/plain' }),
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
    uploadEncryptedFile: vi.fn(),
    uploadFile: uploadFileMock
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

describe('useMsgInputFileUpload 无本地路径时走 blob 直传', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock)
    queueState.items = []
    getStrategyMock.mockResolvedValue(createStrategy())
    checkQuotaMock.mockResolvedValue(null)
    uploadFileMock.mockResolvedValue({ contentUri: 'mxc://example.com/blob', size: 100, mimetype: 'text/plain' })
  })

  it('File 没有 path 时用 matrixMediaService.uploadFile 直传，而不是 path 版上传', async () => {
    const strategy = createStrategy()
    // getMsg 返回的 path 为空 —— 这正是浏览器里 van-uploader 选出的 File 的形态
    strategy.getMsg.mockResolvedValue({
      type: MsgEnum.FILE,
      path: '',
      fileName: 'a.txt',
      size: 100,
      mimeType: 'text/plain'
    })
    getStrategyMock.mockResolvedValue(strategy)
    const { uploader, ctx } = createUploader()

    await uploader.sendFilesDirect([makeFile('a.txt', 100)])

    expect(uploadFileMock).toHaveBeenCalledTimes(1)
    expect(uploadFileMock.mock.calls[0][0]).toBeInstanceOf(File)
    // path 版上传链必须完全不被触碰（它读 Tauri 文件系统，浏览器里必抛）
    expect(strategy.uploadFile).not.toHaveBeenCalled()
    expect(strategy.doUpload).not.toHaveBeenCalled()
    // 上传完必须带 url 落库并真的发出去
    const updated = ctx.chatStore.updateMsg.mock.calls.at(-1)?.[0] as { body?: { url?: string } }
    expect(updated.body?.url).toBe('mxc://example.com/blob')
    expect(ctx.sendWithTracking).toHaveBeenCalled()
  })

  it('有本地路径时仍走 path 版上传（Tauri 拖拽/手输路径不回归）', async () => {
    const strategy = createStrategy()
    strategy.getMsg.mockResolvedValue({
      type: MsgEnum.FILE,
      path: '/tmp/a.txt',
      fileName: 'a.txt',
      size: 100,
      mimeType: 'text/plain'
    })
    getStrategyMock.mockResolvedValue(strategy)
    const { uploader } = createUploader()

    await uploader.sendFilesDirect([makeFile('a.txt', 100)])

    expect(strategy.uploadFile).toHaveBeenCalledWith('/tmp/a.txt', expect.anything())
    expect(strategy.doUpload).toHaveBeenCalled()
    expect(uploadFileMock).not.toHaveBeenCalled()
  })
})

describe('useMsgInputFileUpload path 版上传失败时回退 blob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrameMock)
    vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrameMock)
    queueState.items = []
    checkQuotaMock.mockResolvedValue(null)
    uploadFileMock.mockResolvedValue({ contentUri: 'mxc://example.com/blob', size: 100, mimetype: 'text/plain' })
  })

  it('path 版上传抛错（沙箱/Tauri shim 里 fs 不可用）时必须改走 blob 并照常发出', async () => {
    const strategy = createStrategy()
    strategy.getMsg.mockResolvedValue({
      type: MsgEnum.FILE,
      path: 'temp-file-1-a.txt',
      fileName: 'a.txt',
      size: 100,
      mimeType: 'text/plain'
    })
    // 模拟 Tauri fs 不可用：path 版上传抛 isFile 之类的 TypeError
    strategy.uploadFile.mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'isFile')"))
    getStrategyMock.mockResolvedValue(strategy)
    const { uploader, ctx } = createUploader()

    await uploader.sendFilesDirect([makeFile('a.txt', 100)])

    expect(strategy.uploadFile).toHaveBeenCalled()
    expect(uploadFileMock).toHaveBeenCalledTimes(1)
    const updated = ctx.chatStore.updateMsg.mock.calls.at(-1)?.[0] as { body?: { url?: string } }
    expect(updated.body?.url).toBe('mxc://example.com/blob')
    expect(ctx.sendWithTracking).toHaveBeenCalled()
    // 回退成功不应把消息标成失败
    expect(ctx.chatStore.updateMsg).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }))
  })
})
