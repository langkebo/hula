import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, reactive, ref } from 'vue'
import { RoomTypeEnum } from '@/enums'
import ChatFooter from '../ChatFooter.vue'

const {
  showFeedbackMock,
  toggleRoomBurnMock,
  sendEmojiDirectMock,
  sendFilesDirectMock,
  historySetEmojiMock,
  loggerErrorMock,
  mittOnMock,
  mittOffMock,
  mittEmitMock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  toggleRoomBurnMock: vi.fn(),
  sendEmojiDirectMock: vi.fn(),
  sendFilesDirectMock: vi.fn(),
  historySetEmojiMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  mittOnMock: vi.fn(),
  mittOffMock: vi.fn(),
  mittEmitMock: vi.fn()
}))

const burnAfterReadState = ref(false)
let mobileState = false
let globalStore: ReturnType<typeof reactive<{ currentSession: { type: RoomTypeEnum }; currentSessionRoomId: string }>>
let contactStore: ReturnType<typeof reactive<{ contactsList: Array<{ uid: string }> }>>
let chatStore: ReturnType<typeof reactive<{ isMsgMultiChoose: boolean }>>
let historyStore: ReturnType<typeof reactive<{ emoji: string[]; setEmoji: typeof historySetEmojiMock }>>
let settingStore: ReturnType<
  typeof reactive<{
    screenshotConcealEnabled: boolean
    screenshotShortcut: string
    setScreenshotConceal: (value: boolean) => void
  }>
>

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn()
}))

vi.mock('@vueuse/core', () => ({
  useDebounceFn: (fn: (...args: unknown[]) => unknown) => fn
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/common/constants', () => ({
  FOOTER_HEIGHT: 80,
  MAX_FOOTER_HEIGHT: 390,
  MIN_FOOTER_HEIGHT: 200
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({
    toggleRoomBurn: toggleRoomBurnMock,
    isRoomBurnEnabled: () => burnAfterReadState.value
  })
}))

vi.mock('@/composables/chat/useChatLayout', () => ({
  useChatLayoutGlobal: () => ({
    footerHeight: ref(240),
    setFooterHeight: vi.fn()
  })
}))

vi.mock('@/composables/common/useCommon', () => ({
  useCommon: () => ({
    insertNodeAtRange: vi.fn(),
    triggerInputEvent: vi.fn(),
    processFiles: vi.fn(),
    imgPaste: vi.fn()
  })
}))

vi.mock('@/composables/common/useGlobalShortcut', () => ({
  useGlobalShortcut: () => ({
    handleScreenshot: vi.fn()
  })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: mittOnMock,
    off: mittOffMock,
    emit: mittEmitMock
  }
}))

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({
    createWebviewWindow: vi.fn()
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(),
    getRoom: vi.fn(() => null)
  }
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => chatStore
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => contactStore
}))

vi.mock('@/stores/domains/chat/emoji', () => ({
  useEmojiStore: () => ({
    emojiList: []
  })
}))

vi.mock('@/stores/domains/chat/history', () => ({
  useHistoryStore: () => historyStore
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => settingStore
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStore
}))

vi.mock('@/utils/FileUtil', () => ({
  default: {
    openAndCopyFile: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: () => mobileState
}))

const MsgInputStub = defineComponent({
  name: 'MsgInput',
  setup(_, { expose }) {
    expose({
      messageInputDom: document.createElement('div'),
      showFileModal: vi.fn(),
      sendEmojiDirect: sendEmojiDirectMock,
      focus: vi.fn(),
      getLastEditRange: vi.fn(() => null),
      updateSelectionRange: vi.fn(),
      handleLocationSelected: vi.fn(),
      sendVoiceDirect: vi.fn(),
      sendFilesDirect: sendFilesDirectMock,
      isVoiceMode: false
    })

    return () => null
  }
})

const mountComponent = () =>
  mount(ChatFooter, {
    props: {
      detailId: '@friend:example.com'
    },
    global: {
      stubs: {
        MsgInput: MsgInputStub,
        ChatMsgMultiChoose: true,
        LocationModal: true,
        FooterOverlays: true,
        FooterToolbar: true,
        MobilePanel: true,
        'n-flex': {
          template: '<div><slot /></div>'
        },
        'n-popover': {
          template: '<div><slot name="trigger" /><slot /></div>'
        },
        'n-checkbox': {
          template: '<input type="checkbox" />'
        }
      }
    }
  })

describe('ChatFooter', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    burnAfterReadState.value = false
    mobileState = false

    globalStore = reactive({
      currentSession: {
        type: RoomTypeEnum.SINGLE
      },
      currentSessionRoomId: '!room:example.com'
    })

    contactStore = reactive({
      contactsList: [{ uid: '@friend:example.com' }]
    })

    chatStore = reactive({
      isMsgMultiChoose: false
    })

    historyStore = reactive({
      emoji: [],
      setEmoji: historySetEmojiMock
    })

    settingStore = reactive({
      screenshotConcealEnabled: false,
      screenshotShortcut: 'Cmd+Shift+A',
      setScreenshotConceal: vi.fn()
    })

    toggleRoomBurnMock.mockImplementation(async () => {
      burnAfterReadState.value = !burnAfterReadState.value
    })
    sendEmojiDirectMock.mockResolvedValue(undefined)
    sendFilesDirectMock.mockResolvedValue(undefined)
  })

  it('uses action feedback for burn-after-read enable and disable states', async () => {
    const enableWrapper = mountComponent()

    await (enableWrapper.vm as unknown as { toggleBurnAfterRead: () => Promise<void> }).toggleBurnAfterRead()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('editor.burn_after_read_enabled', 'success')

    burnAfterReadState.value = true
    const disableWrapper = mountComponent()
    await (disableWrapper.vm as unknown as { toggleBurnAfterRead: () => Promise<void> }).toggleBurnAfterRead()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('editor.burn_after_read_disabled', 'info')
  })

  it('uses action feedback for burn-after-read toggle failure', async () => {
    toggleRoomBurnMock.mockRejectedValueOnce(new Error('toggle failed'))
    const wrapper = mountComponent()

    await (wrapper.vm as unknown as { toggleBurnAfterRead: () => Promise<void> }).toggleBurnAfterRead()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('editor.burn_after_read_disabled', 'error')
  })

  it('uses action feedback for mobile send-file failure', async () => {
    sendFilesDirectMock.mockRejectedValueOnce(new Error('send failed'))
    const wrapper = mountComponent()

    await (wrapper.vm as unknown as { handleMoreSendFiles: (files: File[]) => Promise<void> }).handleMoreSendFiles([
      new File(['demo'], 'demo.txt', { type: 'text/plain' })
    ])
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('发送文件失败', 'error')
  })

  it('uses action feedback for mobile emoji send failure', async () => {
    mobileState = true
    sendEmojiDirectMock.mockRejectedValueOnce(new Error('emoji failed'))
    const wrapper = mountComponent()
    await flushPromises()

    await (
      wrapper.vm as unknown as {
        emojiHandle: (item: { renderUrl: string; serverUrl: string }, type: 'emoji-url') => Promise<void>
      }
    ).emojiHandle(
      {
        renderUrl: 'https://example.com/render.webp',
        serverUrl: 'https://example.com/server.webp'
      },
      'emoji-url'
    )
    await flushPromises()

    expect(sendEmojiDirectMock).toHaveBeenCalledWith('https://example.com/server.webp')
    expect(historySetEmojiMock).toHaveBeenCalledWith(['https://example.com/server.webp'])
    expect(showFeedbackMock).toHaveBeenCalledWith('发送表情包失败', 'error')
  })
})
