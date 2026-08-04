import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref, toRefs } from 'vue'
import MsgInput from '../MsgInput.vue'

const {
  showFeedbackMock,
  processFilesMock,
  sendLocationDirectMock,
  getCurrentPositionMock,
  createBeaconMock,
  updateBeaconLocationMock,
  loggerErrorMock,
  mittOnMock,
  mittOffMock,
  mittEmitMock,
  appWindowListenMock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  processFilesMock: vi.fn(),
  sendLocationDirectMock: vi.fn(),
  getCurrentPositionMock: vi.fn(),
  createBeaconMock: vi.fn(),
  updateBeaconLocationMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  mittOnMock: vi.fn(),
  mittOffMock: vi.fn(),
  mittEmitMock: vi.fn(),
  appWindowListenMock: vi.fn()
}))

let globalStore: ReturnType<
  typeof reactive<{
    currentSession: null
    currentSessionRoomId: string
  }>
>

vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn()
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getCurrent: () => ({
      listen: appWindowListenMock
    })
  }
}))

vi.mock('@vueuse/core', () => ({
  onKeyStroke: vi.fn()
}))

vi.mock('pinia', () => ({
  storeToRefs: <T extends object>(store: T) => toRefs(store)
}))

vi.mock('vue-i18n', () => ({
  I18nT: {
    name: 'I18nT',
    template: '<span><slot name="send" /><slot name="newline" /></span>'
  },
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/chat/useTyping', () => ({
  useTyping: () => ({
    startTyping: vi.fn(),
    stopTyping: vi.fn()
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/composables/settings/settingsOptions', () => ({
  useSendOptions: () => []
}))

vi.mock('@/composables/common/useCommon', () => ({
  useCommon: () => ({
    handlePaste: vi.fn(),
    processFiles: processFilesMock
  })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    on: mittOnMock,
    off: mittOffMock,
    emit: mittEmitMock
  }
}))

vi.mock('@/composables/chat/useMsgInput', () => ({
  useMsgInput: () => ({
    inputKeyDown: vi.fn(),
    handleAit: vi.fn(),
    handleAI: vi.fn(),
    handleInput: vi.fn(),
    msgInput: ref(''),
    send: vi.fn(),
    sendLocationDirect: sendLocationDirectMock,
    sendFilesDirect: vi.fn(),
    sendVoiceDirect: vi.fn(),
    sendEmojiDirect: vi.fn(),
    personList: ref([]),
    disabledSend: ref(false),
    ait: ref(false),
    aiDialogVisible: ref(false),
    selectedAIKey: ref(null),
    chatKey: ref('Enter'),
    menuList: [],
    selectedAitKey: ref(null),
    groupedAIModels: ref([]),
    updateSelectionRange: vi.fn(),
    focusOn: vi.fn(),
    getCursorSelectionRange: vi.fn(() => null)
  })
}))

vi.mock('@/composables/common/useGeolocation', () => ({
  useGeolocation: () => ({
    getCurrentPosition: getCurrentPositionMock
  })
}))

vi.mock('@/services/matrix/media/MatrixBeaconService', () => ({
  matrixBeaconService: {
    createBeacon: createBeaconMock,
    updateBeaconLocation: updateBeaconLocationMock
  }
}))

vi.mock('../location/LocationModal.vue', () => ({
  default: {
    name: 'LocationModal',
    template: '<div />'
  }
}))

vi.mock('../VoiceRecorder.vue', () => ({
  default: {
    name: 'VoiceRecorder',
    template: '<div />'
  }
}))

vi.mock('../FileUploadModal.vue', () => ({
  default: {
    name: 'FileUploadModal',
    template: '<div />'
  }
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: vi.fn()
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStore
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: {
    getAvatarUrl: (value?: string) => value ?? ''
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock
  })
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMac: () => false,
  isMobile: () => false
}))

const mountComponent = () =>
  mount(MsgInput, {
    global: {
      stubs: {
        MsgInputToolbar: true,
        MsgInputMobileControls: true,
        ContextMenu: {
          template: '<div><slot /></div>'
        },
        LocationModal: true,
        VoiceRecorder: true,
        FileUploadModal: true,
        'n-scrollbar': {
          template: '<div><slot /></div>'
        },
        'n-tooltip': {
          template: '<div><slot name="trigger" /><slot /></div>'
        },
        'n-button': {
          template: '<button type="button"><slot /><slot name="icon" /></button>'
        },
        'n-button-group': {
          template: '<div><slot /></div>'
        },
        'n-popselect': {
          template: '<div><slot /><slot name="action" /></div>'
        },
        'n-flex': {
          template: '<div><slot /></div>'
        },
        'n-virtual-list': {
          template: '<div><slot :item="undefined" /></div>'
        },
        'n-avatar': true,
        'n-tag': true
      }
    }
  })

describe('MsgInput', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    globalStore = reactive({
      currentSession: null,
      currentSessionRoomId: '!room:example.com'
    })

    getCurrentPositionMock.mockResolvedValue({
      coords: {
        latitude: 12.34,
        longitude: 56.78,
        accuracy: 9
      }
    })
    createBeaconMock.mockResolvedValue({
      event_id: '$beacon'
    })
    updateBeaconLocationMock.mockResolvedValue(undefined)
    sendLocationDirectMock.mockResolvedValue(undefined)
    processFilesMock.mockResolvedValue(undefined)
  })

  it('uses action feedback for beacon start success', async () => {
    const wrapper = mountComponent()

    await (wrapper.vm as unknown as { handleBeaconClick: () => Promise<void> }).handleBeaconClick()
    await flushPromises()

    expect(createBeaconMock).toHaveBeenCalledWith({
      roomId: '!room:example.com',
      description: '实时位置共享'
    })
    expect(updateBeaconLocationMock).toHaveBeenCalledWith({
      roomId: '!room:example.com',
      beaconInfoEventId: '$beacon',
      latitude: 12.34,
      longitude: 56.78,
      uncertainty: 9
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('message.beacon.started', 'success')
  })

  it('uses action feedback for beacon start failure', async () => {
    getCurrentPositionMock.mockRejectedValueOnce(new Error('permission denied'))
    const wrapper = mountComponent()

    await (wrapper.vm as unknown as { handleBeaconClick: () => Promise<void> }).handleBeaconClick()
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('message.beacon.failed', 'error')
  })

  it('uses action feedback for location send failure and empty AI content warning', async () => {
    sendLocationDirectMock.mockRejectedValueOnce(new Error('send failed'))
    const wrapper = mountComponent()

    await (
      wrapper.vm as unknown as {
        handleLocationSelected: (locationData: unknown) => Promise<void>
      }
    ).handleLocationSelected({
      latitude: 1,
      longitude: 2
    })
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('message.location.send_failed', 'error')

    const input = wrapper.find('#message-input')
    ;(input.element as HTMLDivElement).textContent = ''
    ;(input.element as HTMLDivElement).innerHTML = ''
    await nextTick()

    await (wrapper.vm as unknown as { handleAISend: () => Promise<void> }).handleAISend()

    expect(showFeedbackMock).toHaveBeenCalledWith('请输入消息内容', 'warning')
  })

  it('uses action feedback for global file drop failure', async () => {
    processFilesMock.mockRejectedValueOnce(new Error('drop failed'))
    const wrapper = mountComponent()

    await (
      wrapper.vm as unknown as {
        handleGlobalFilesDrop: (files: unknown[]) => Promise<void>
      }
    ).handleGlobalFilesDrop([{ name: 'file.txt' }])
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('处理拖拽文件失败', 'error')
  })
})
