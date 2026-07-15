import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, ref } from 'vue'
import { MessageStatusEnum, MsgEnum } from '@/enums'
import FileMessage from '../File.vue'

const {
  openPathMock,
  revealItemInDirMock,
  downloadFileMock,
  downloadEncryptedFileMock,
  checkFileExistsMock,
  refreshFileDownloadStatusMock,
  getFileStatusMock,
  getMessageMock,
  updateMsgMock,
  invokeSilentlyMock,
  getFilesMetaMock,
  getUserRoomAbsoluteDirMock,
  showFeedbackMock,
  loggerErrorMock,
  joinMock
} = vi.hoisted(() => ({
  openPathMock: vi.fn(),
  revealItemInDirMock: vi.fn(),
  downloadFileMock: vi.fn(),
  downloadEncryptedFileMock: vi.fn(),
  checkFileExistsMock: vi.fn(),
  refreshFileDownloadStatusMock: vi.fn(),
  getFileStatusMock: vi.fn(),
  getMessageMock: vi.fn(),
  updateMsgMock: vi.fn(),
  invokeSilentlyMock: vi.fn(),
  getFilesMetaMock: vi.fn(),
  getUserRoomAbsoluteDirMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  joinMock: vi.fn()
}))

let fileDownloadStore: any
let userStore: any
let globalStore: any
let chatStore: any

vi.mock('@tauri-apps/api/path', () => ({
  join: joinMock
}))

vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: openPathMock,
  revealItemInDir: revealItemInDirMock
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/composables/common/useDownload', () => ({
  useDownload: () => ({
    isDownloading: ref(false)
  })
}))

vi.mock('@/stores/domains/widget/fileDownload', () => ({
  useFileDownloadStore: () => fileDownloadStore
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => userStore
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStore
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => chatStore
}))

vi.mock('@/utils/Formatting', () => ({
  formatBytes: (size: number) => `${size}B`,
  getFileSuffix: () => 'other'
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock,
    warn: vi.fn()
  })
}))

vi.mock('@/utils/PathUtil', () => ({
  getFilesMeta: getFilesMetaMock
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeSilently: invokeSilentlyMock
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    NHighlight: defineComponent({
      name: 'NHighlight',
      props: {
        text: {
          type: String,
          default: ''
        }
      },
      setup(props) {
        return () => h('span', props.text)
      }
    })
  }
})

const mountFile = () =>
  mount(FileMessage, {
    props: {
      body: {
        url: 'mxc://server/file',
        fileName: 'demo.txt',
        size: 12
      },
      messageStatus: MessageStatusEnum.SUCCESS,
      message: {
        id: 'msg-1',
        roomId: '!room:example.com',
        type: MsgEnum.FILE,
        body: {
          url: 'mxc://server/file',
          fileName: 'demo.txt',
          size: 12
        },
        sendTime: Date.now(),
        messageMarks: {},
        status: MessageStatusEnum.SUCCESS
      }
    }
  })

describe('File render message', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    fileDownloadStore = reactive({
      getFileStatus: getFileStatusMock,
      checkFileExists: checkFileExistsMock,
      refreshFileDownloadStatus: refreshFileDownloadStatusMock,
      downloadFile: downloadFileMock,
      downloadEncryptedFile: downloadEncryptedFileMock
    })
    userStore = reactive({
      userInfo: {
        uid: '@alice:example.com'
      },
      getUserRoomAbsoluteDir: getUserRoomAbsoluteDirMock
    })
    globalStore = reactive({
      currentSessionRoomId: '!room:example.com'
    })
    chatStore = reactive({
      getMessage: getMessageMock,
      updateMsg: updateMsgMock
    })

    getFileStatusMock.mockReturnValue({
      isDownloaded: false,
      status: 'idle',
      progress: 0
    })
    checkFileExistsMock.mockResolvedValue(undefined)
    refreshFileDownloadStatusMock.mockResolvedValue(undefined)
    downloadFileMock.mockResolvedValue('/downloads/demo.txt')
    getFilesMetaMock.mockResolvedValue([{ exists: true }])
    getUserRoomAbsoluteDirMock.mockResolvedValue('/downloads')
    joinMock.mockResolvedValue('/downloads/demo.txt')
    getMessageMock.mockReturnValue(null)
  })

  it('uses action feedback when local file is missing or reveal fails', async () => {
    const wrapper = mountFile()
    await flushPromises()

    await (wrapper.vm as unknown as { revealInDirSafely: (path?: string | null) => Promise<void> }).revealInDirSafely(
      null
    )
    expect(showFeedbackMock).toHaveBeenCalledWith('message.file.toast.missing_local', 'error')

    revealItemInDirMock.mockRejectedValueOnce(new Error('reveal failed'))
    await (wrapper.vm as unknown as { revealInDirSafely: (path?: string | null) => Promise<void> }).revealInDirSafely(
      '/downloads/demo.txt'
    )

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('message.file.toast.reveal_fail', 'error')
  })

  it('uses action feedback when download fails with open-path style error', async () => {
    const wrapper = mountFile()
    await flushPromises()

    downloadFileMock.mockRejectedValueOnce(new Error('Not allowed to open path'))
    await (wrapper.vm as unknown as { downloadAndOpenFile: () => Promise<void> }).downloadAndOpenFile()

    expect(showFeedbackMock).toHaveBeenCalledWith('message.file.toast.download_open_fail', 'error')
  })

  it('uses action feedback when download fails for other reasons', async () => {
    downloadFileMock.mockRejectedValueOnce(new Error('network down'))
    const wrapper = mountFile()
    await flushPromises()

    await (wrapper.vm as unknown as { downloadAndOpenFile: () => Promise<void> }).downloadAndOpenFile()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith(
      'message.file.toast.download_failed:{"reason":"network down"}',
      'error'
    )
  })
})
