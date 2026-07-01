import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, reactive, ref } from 'vue'
import { MittEnum, RoleEnum, RoomTypeEnum } from '@/enums'
import { useChatMain } from '../useChatMain'

type MessageItem = {
  isCheck?: boolean
  fromUser: { uid: string }
  message: {
    id: string
    roomId: string
    type: number
    body: Record<string, any>
    sendTime: number
  }
}

const {
  showFeedbackMock,
  invokeWithErrorHandlerMock,
  addAdminMock,
  revokeAdminMock,
  removeMemberMock,
  reportEventMock,
  deleteMsgMock,
  mittEmitMock,
  loggerErrorMock,
  recallMessageMock,
  userStoreMock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  invokeWithErrorHandlerMock: vi.fn(),
  addAdminMock: vi.fn(),
  revokeAdminMock: vi.fn(),
  removeMemberMock: vi.fn(),
  reportEventMock: vi.fn(),
  deleteMsgMock: vi.fn(),
  mittEmitMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  recallMessageMock: vi.fn(),
  userStoreMock: {
    userInfo: {
      uid: '@me:example.com',
      power: 0
    } as { uid: string; power: number } | undefined
  }
}))

const globalStore = reactive({
  currentSessionRoomId: '!room:example.com',
  currentSession: {
    type: RoomTypeEnum.GROUP
  }
})

const groupStore = reactive({
  userList: [
    { uid: '@me:example.com', roleId: RoleEnum.LORD },
    { uid: '@target:example.com', roleId: 0 }
  ],
  adminUidList: [] as string[],
  currentLordId: '@me:example.com',
  addAdmin: addAdminMock,
  revokeAdmin: revokeAdminMock,
  removeUserItem: vi.fn(),
  getUserInfo: vi.fn(),
  updateUserItem: vi.fn(),
  updateGroupDetail: vi.fn(),
  myNameInCurrentGroup: ''
})

const chatStore = reactive({
  clearMsgCheck: vi.fn(),
  setMsgMultiChoose: vi.fn(),
  getMessage: vi.fn(),
  recordRecallMsg: vi.fn(),
  updateRecallMsg: vi.fn(),
  deleteMsg: deleteMsgMock
})

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

vi.mock('@/hooks/useWindow', () => ({
  useWindow: () => ({
    createWebviewWindow: vi.fn(),
    sendWindowPayload: vi.fn(),
    startRtcCall: vi.fn()
  })
}))

vi.mock('@/hooks/useDownload', () => ({
  useDownload: () => ({
    downloadFile: vi.fn()
  })
}))

vi.mock('@/hooks/useVideoViewer', () => ({
  useVideoViewer: () => ({
    getLocalVideoPath: vi.fn(),
    checkVideoDownloaded: vi.fn()
  })
}))

vi.mock('@/hooks/useMitt.ts', () => ({
  useMitt: {
    emit: mittEmitMock,
    on: vi.fn()
  }
}))

vi.mock('@/hooks/session/openMsgSession', () => ({
  openMsgSession: vi.fn()
}))

vi.mock('../chatMain/useChatCopy', () => ({
  useChatCopy: () => ({
    handleCopy: vi.fn()
  })
}))

vi.mock('../chatMain/useChatFileDownload', () => ({
  useChatFileDownload: () => ({
    downloadAndRevealFile: vi.fn(),
    downloadAndRevealVideo: vi.fn(),
    previewFile: vi.fn()
  })
}))

vi.mock('../chatMain/useGroupNicknameModal', () => ({
  useGroupNicknameModal: () => ({
    groupNicknameModalVisible: ref(false),
    groupNicknameValue: ref(''),
    groupNicknameError: ref(''),
    groupNicknameSubmitting: ref(false),
    handleGroupNicknameConfirm: vi.fn()
  })
}))

vi.mock('@/composables/chat/useChatMessageActions', () => ({
  useChatMessageActions: () => ({
    recallMessage: recallMessageMock
  })
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    reportEvent: reportEventMock
  }
}))

vi.mock('@/services/matrix/room/MatrixRoomService', () => ({
  matrixRoomService: {
    kickUser: removeMemberMock
  }
}))

vi.mock('@/services/matrix/room/TranslateService', () => ({
  matrixRoomTranslateService: {
    translateText: vi.fn()
  }
}))

vi.mock('@/stores/domains/chat/chat', () => ({
  useChatStore: () => chatStore
}))

vi.mock('@/stores/domains/chat/contacts', () => ({
  useContactStore: () => ({
    contactsList: []
  })
}))

vi.mock('@/stores/domains/chat/emoji', () => ({
  useEmojiStore: () => ({
    addEmoji: vi.fn()
  })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => groupStore
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    chatTranslateProvider: 'client'
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => userStoreMock
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => globalStore
}))

vi.mock('@/utils/AttachmentSaver', () => ({
  saveFileAttachmentAs: vi.fn(),
  saveVideoAttachmentAs: vi.fn()
}))

vi.mock('@/utils/ComputedTime.ts', () => ({
  isDiffNow: vi.fn(() => false)
}))

vi.mock('@/utils/Formatting', () => ({
  extractFileName: vi.fn(() => 'file.txt')
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: loggerErrorMock
  })
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMac: vi.fn(() => false),
  isMobile: vi.fn(() => false)
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeWithErrorHandler: invokeWithErrorHandlerMock
}))

vi.mock('../chatMain/emojiMenuData', () => ({
  createEmojiList: vi.fn(() => [])
}))

vi.mock('../chatMain/selectionUtils', () => ({
  clearSelection: vi.fn(),
  extractMsgIdFromDataKey: vi.fn(),
  getSelectedText: vi.fn(() => ''),
  hasSelectedText: vi.fn(() => false),
  resolveSelectionMessageId: vi.fn()
}))

const mountComposable = () => {
  const TestComponent = defineComponent({
    setup(_, { expose }) {
      const api = useChatMain()
      expose(api)
      return () => null
    }
  })

  return mount(TestComponent)
}

const resolveMenuLabel = (item: { label?: string | ((content?: unknown) => string) }) =>
  typeof item.label === 'function' ? item.label(void 0) : item.label

const createMessageItem = (overrides: Partial<MessageItem> = {}): MessageItem => ({
  fromUser: { uid: '@target:example.com' },
  message: {
    id: '$event',
    roomId: '!room:example.com',
    type: 0,
    body: {},
    sendTime: Date.now()
  },
  ...overrides
})

describe('useChatMain', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userStoreMock.userInfo = {
      uid: '@me:example.com',
      power: 0
    }
    globalStore.currentSessionRoomId = '!room:example.com'
    globalStore.currentSession = { type: RoomTypeEnum.GROUP }
    groupStore.userList = [
      { uid: '@me:example.com', roleId: RoleEnum.LORD },
      { uid: '@target:example.com', roleId: 0 }
    ]
  })

  it('在无法确定消息所属会话时播报 error', async () => {
    const wrapper = mountComposable()
    const vm = wrapper.vm as unknown as ReturnType<typeof useChatMain>
    const [deleteMenu] = (
      vm.specialMenuList as unknown as (messageType?: number) => Array<{ click?: (item: unknown) => void }>
    )()

    deleteMenu?.click?.(
      createMessageItem({ message: { id: '$event', roomId: '', type: 0, body: {}, sendTime: 1 } }) as any
    )
    globalStore.currentSessionRoomId = ''

    await vm.handleConfirm()

    expect(showFeedbackMock).toHaveBeenCalledWith('无法确定消息所属的会话', 'error')
    expect(invokeWithErrorHandlerMock).not.toHaveBeenCalled()
  })

  it('删除消息成功后播报 success 并更新会话尾消息', async () => {
    invokeWithErrorHandlerMock.mockResolvedValue(undefined)

    const wrapper = mountComposable()
    const vm = wrapper.vm as unknown as ReturnType<typeof useChatMain>
    const [deleteMenu] = (
      vm.specialMenuList as unknown as (messageType?: number) => Array<{ click?: (item: unknown) => void }>
    )()

    deleteMenu?.click?.(createMessageItem() as any)
    await vm.handleConfirm()

    expect(invokeWithErrorHandlerMock).toHaveBeenCalled()
    expect(deleteMsgMock).toHaveBeenCalledWith('$event')
    expect(mittEmitMock).toHaveBeenCalledWith(MittEnum.UPDATE_SESSION_LAST_MSG, { roomId: '!room:example.com' })
    expect(showFeedbackMock).toHaveBeenCalledWith('消息已删除', 'success')
  })

  it('设置管理员成功和失败时分别播报 success/error', async () => {
    const wrapper = mountComposable()
    const vm = wrapper.vm as unknown as ReturnType<typeof useChatMain>
    const setAdminMenu = (
      vm.optionsList as unknown as Array<{
        label?: string | ((content?: unknown) => string)
        click?: (item: unknown) => Promise<void> | void
      }>
    ).find((item) => resolveMenuLabel(item) === 'menu.set_admin')

    addAdminMock.mockResolvedValueOnce(undefined)
    await setAdminMenu?.click?.({ uid: '@target:example.com', fromUser: { uid: '@target:example.com' } } as any)
    expect(showFeedbackMock).toHaveBeenCalledWith('menu.set_admin_success', 'success')

    showFeedbackMock.mockClear()
    addAdminMock.mockRejectedValueOnce(new Error('failed'))
    await setAdminMenu?.click?.({ uid: '@target:example.com', fromUser: { uid: '@target:example.com' } } as any)
    expect(showFeedbackMock).toHaveBeenCalledWith('menu.set_admin_fail', 'error')
  })

  it('举报消息缺少上下文时播报 warning，成功时播报 success', async () => {
    const wrapper = mountComposable()
    const vm = wrapper.vm as unknown as ReturnType<typeof useChatMain>
    const reportMenu = (
      vm.report as unknown as Array<{
        label?: string | ((content?: unknown) => string)
        click?: (item: unknown) => Promise<void> | void
      }>
    ).find((item) => resolveMenuLabel(item) === 'menu.report')

    await reportMenu?.click?.({ fromUser: { uid: '@target:example.com' } } as any)
    expect(showFeedbackMock).toHaveBeenCalledWith('无法获取消息信息', 'warning')

    showFeedbackMock.mockClear()
    reportEventMock.mockResolvedValueOnce(undefined)
    await reportMenu?.click?.({
      fromUser: { uid: '@target:example.com' },
      message: { id: '$event' }
    } as any)

    expect(reportEventMock).toHaveBeenCalledWith({
      roomId: '!room:example.com',
      eventId: '$event',
      reason: 'violation',
      explanation: 'User reported via chat menu'
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('menu.report_success', 'success')
  })

  it('当前用户信息缺失时仍可执行撤回并写入空 recallUid', async () => {
    userStoreMock.userInfo = undefined
    recallMessageMock.mockResolvedValueOnce(undefined)

    const wrapper = mountComposable()
    const vm = wrapper.vm as unknown as ReturnType<typeof useChatMain>
    const recallMenu = (
      vm.commonMenuList as unknown as Array<{
        label?: string | ((content?: unknown) => string)
        click?: (item: unknown) => Promise<void> | void
      }>
    ).find((item) => resolveMenuLabel(item) === 'menu.recall')

    await recallMenu?.click?.(createMessageItem({ fromUser: { uid: '' } }) as any)

    expect(recallMessageMock).toHaveBeenCalledWith('!room:example.com', '$event')
    expect(chatStore.recordRecallMsg).toHaveBeenCalledWith(
      expect.objectContaining({
        recallUid: ''
      })
    )
    expect(chatStore.updateRecallMsg).toHaveBeenCalledWith(
      expect.objectContaining({
        recallUid: '',
        roomId: '!room:example.com',
        msgId: '$event'
      })
    )
  })
})
