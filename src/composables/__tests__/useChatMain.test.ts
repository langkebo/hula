import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, reactive, ref } from 'vue'
import { useChatMain } from '@/composables/chat/useChatMain'
import { MittEnum, RoleEnum, RoomTypeEnum } from '@/enums'
import { isDiffNow } from '@/utils/ComputedTime'

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
      power: undefined as number | undefined
    } as { uid: string; power?: number | undefined } | undefined
  }
}))

const globalStore = reactive({
  currentSessionRoomId: '!room:example.com',
  currentSession: {
    type: RoomTypeEnum.GROUP
  } as { type: RoomTypeEnum } | undefined
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

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({
    createWebviewWindow: vi.fn(),
    sendWindowPayload: vi.fn(),
    startRtcCall: vi.fn()
  })
}))

vi.mock('@/composables/common/useDownload', () => ({
  useDownload: () => ({
    downloadFile: vi.fn()
  })
}))

vi.mock('@/composables/common/useVideoViewer', () => ({
  useVideoViewer: () => ({
    getLocalVideoPath: vi.fn(),
    checkVideoDownloaded: vi.fn()
  })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    emit: mittEmitMock,
    on: vi.fn()
  }
}))

vi.mock('@/composables/chat/openMsgSession', () => ({
  openMsgSession: vi.fn()
}))

vi.mock('../chat/useChatCopy', () => ({
  useChatCopy: () => ({
    handleCopy: vi.fn()
  })
}))

vi.mock('../chat/useChatFileDownload', () => ({
  useChatFileDownload: () => ({
    downloadAndRevealFile: vi.fn(),
    downloadAndRevealVideo: vi.fn(),
    previewFile: vi.fn()
  })
}))

vi.mock('../chat/useGroupNicknameModal', () => ({
  useGroupNicknameModal: () => ({
    groupNicknameModalVisible: ref(false),
    groupNicknameValue: ref(''),
    groupNicknameError: ref(''),
    groupNicknameSubmitting: ref(false),
    handleGroupNicknameConfirm: vi.fn()
  })
}))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: {
    recallMessage: recallMessageMock,
    isLocalEventId: (id: string) => id.startsWith('local-'),
    getRemoteEventId: () => undefined
  }
}))

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    reportEvent: reportEventMock
  }
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomActionFacade: {
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

vi.mock('@/utils/ComputedTime', () => ({
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

vi.mock('../chat/emojiMenuData', () => ({
  createEmojiList: vi.fn(() => [])
}))

vi.mock('../chat/selectionUtils', () => ({
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
  typeof item.label === 'function' ? item.label(createMessageItem()) : item.label

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
      power: undefined
    }
    globalStore.currentSessionRoomId = '!room:example.com'
    globalStore.currentSession = { type: RoomTypeEnum.GROUP }
    groupStore.userList = [
      { uid: '@me:example.com', roleId: RoleEnum.LORD },
      { uid: '@target:example.com', roleId: 0 }
    ]
  })

  it('撤回确认弹窗使用撤回文案且不直接调用服务端', () => {
    const wrapper = mountComposable()
    const vm = wrapper.vm as unknown as ReturnType<typeof useChatMain>

    vm.openRecallConfirm(createMessageItem({ fromUser: { uid: '@me:example.com' } }) as any)

    expect(vm.tips).toBe('message.recall_confirm_content')
    expect(vm.modalShow).toBe(true)
    expect(recallMessageMock).not.toHaveBeenCalled()
  })

  it('确认撤回后调用服务端 redact 并更新撤回状态', async () => {
    recallMessageMock.mockResolvedValue(undefined)

    const wrapper = mountComposable()
    const vm = wrapper.vm as unknown as ReturnType<typeof useChatMain>

    vm.openRecallConfirm(createMessageItem({ fromUser: { uid: '@me:example.com' } }) as any)
    await vm.handleConfirm()

    expect(recallMessageMock).toHaveBeenCalledWith('!room:example.com', '$event')
    expect(chatStore.recordRecallMsg).toHaveBeenCalledWith(expect.objectContaining({ recallUid: '@me:example.com' }))
    expect(chatStore.updateRecallMsg).toHaveBeenCalledWith(
      expect.objectContaining({ recallUid: '@me:example.com', roomId: '!room:example.com', msgId: '$event' })
    )
    expect(vm.modalShow).toBe(false)
    expect(showFeedbackMock).toHaveBeenCalledWith('message.recall_success', 'success')
  })

  it('撤回失败时播报 error 并保留弹窗', async () => {
    recallMessageMock.mockRejectedValueOnce(new Error('M_FORBIDDEN'))

    const wrapper = mountComposable()
    const vm = wrapper.vm as unknown as ReturnType<typeof useChatMain>

    vm.openRecallConfirm(createMessageItem({ fromUser: { uid: '@me:example.com' } }) as any)
    await vm.handleConfirm()

    expect(recallMessageMock).toHaveBeenCalled()
    expect(chatStore.recordRecallMsg).not.toHaveBeenCalled()
    expect(vm.modalShow).toBe(true)
    expect(loggerErrorMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('message.recall_failed', 'error')
  })

  it('撤回时无法确定会话则播报 error', async () => {
    const wrapper = mountComposable()
    const vm = wrapper.vm as unknown as ReturnType<typeof useChatMain>

    vm.openRecallConfirm(
      createMessageItem({
        fromUser: { uid: '@me:example.com' },
        message: { id: '$event', roomId: '', type: 0, body: {}, sendTime: 1 }
      }) as any
    )
    globalStore.currentSessionRoomId = ''

    await vm.handleConfirm()

    expect(showFeedbackMock).toHaveBeenCalledWith('message.recall_failed', 'error')
    expect(recallMessageMock).not.toHaveBeenCalled()
  })

  it('超出撤回时限时提示且不打开弹窗', () => {
    globalStore.currentSession = undefined
    vi.mocked(isDiffNow).mockReturnValueOnce(true)

    const wrapper = mountComposable()
    const vm = wrapper.vm as unknown as ReturnType<typeof useChatMain>

    vm.openRecallConfirm(createMessageItem({ fromUser: { uid: '@me:example.com' } }) as any)

    expect(vm.modalShow).toBe(false)
    expect(showFeedbackMock).toHaveBeenCalledWith('menu.recall_expired', 'warning')
  })

  it('已发送消息只展示撤回，不再提供删除入口', () => {
    const wrapper = mountComposable()
    const vm = wrapper.vm as unknown as ReturnType<typeof useChatMain>
    const deleteMenu = (
      vm.specialMenuList as unknown as (messageType?: number) => Array<{
        label?: string | ((content?: unknown) => string)
        visible?: (item: unknown) => boolean
      }>
    )().find((item) => resolveMenuLabel(item) === 'menu.del')

    expect(deleteMenu?.visible?.(createMessageItem())).toBe(false)
  })

  it('本地/失败消息删除走本地清理且不触发服务端撤回', () => {
    const wrapper = mountComposable()
    const vm = wrapper.vm as unknown as ReturnType<typeof useChatMain>
    const deleteMenu = (
      vm.specialMenuList as unknown as (messageType?: number) => Array<{
        label?: string | ((content?: unknown) => string)
        visible?: (item: unknown) => boolean
        click?: (item: unknown) => void
      }>
    )().find((item) => resolveMenuLabel(item) === 'menu.del')

    const localMessage = createMessageItem({
      message: { id: 'local-1', roomId: '!room:example.com', type: 0, body: {}, sendTime: 1 }
    })
    expect(deleteMenu?.visible?.(localMessage)).toBe(true)

    deleteMenu?.click?.(localMessage)

    expect(deleteMsgMock).toHaveBeenCalledWith('local-1')
    expect(recallMessageMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('message.delete_success', 'success')
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

  it('举报消息缺少上下文时播报 warning，成功时打开举报弹窗', async () => {
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
    mittEmitMock.mockClear()
    await reportMenu?.click?.({
      fromUser: { uid: '@target:example.com' },
      message: { id: '$event' }
    } as any)

    expect(mittEmitMock).toHaveBeenCalledWith(MittEnum.OPEN_EVENT_REPORT, {
      roomId: '!room:example.com',
      eventId: '$event',
      eventContent: ''
    })
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
