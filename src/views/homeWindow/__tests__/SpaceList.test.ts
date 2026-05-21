import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { NotificationTypeEnum, RoomTypeEnum } from '@/enums'
import SpaceListView from '../SpaceList.vue'

const {
  routerPushMock,
  addListenerMock,
  handleMsgClickMock,
  handleMsgDeleteMock,
  handleMsgDblclickMock,
  useMittOnMock,
  useMittEmitMock,
  showFeedbackMock,
  messageSuccessMock,
  messageWarningMock,
  messageErrorMock,
  markAsReadMock,
  clearUnreadSummaryMock,
  setRoomNotificationMock,
  leaveRoomMock,
  roomHasTagMock,
  addRoomTagMock,
  loadSelectedSpaceMock,
  updateSelectedSpaceMock,
  getTreePathMock,
  inviteSpaceMemberMock,
  addRoomToSpaceMock,
  reloadSpacesMock,
  reloadActiveSpaceRoomsMock,
  ensureRoomVisibleMock,
  setSelectedSpaceIdMock,
  setSearchKeywordMock,
  setSessionTypeFilterMock,
  setSessionEngagementFilterMock,
  setSessionSortMock
} = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
  addListenerMock: vi.fn(async () => {}),
  handleMsgClickMock: vi.fn(),
  handleMsgDeleteMock: vi.fn(),
  handleMsgDblclickMock: vi.fn(),
  useMittOnMock: vi.fn(),
  useMittEmitMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  messageWarningMock: vi.fn(),
  messageErrorMock: vi.fn(),
  markAsReadMock: vi.fn(),
  clearUnreadSummaryMock: vi.fn(),
  setRoomNotificationMock: vi.fn(),
  leaveRoomMock: vi.fn(),
  roomHasTagMock: vi.fn(),
  addRoomTagMock: vi.fn(),
  loadSelectedSpaceMock: vi.fn(),
  updateSelectedSpaceMock: vi.fn(),
  getTreePathMock: vi.fn(),
  inviteSpaceMemberMock: vi.fn(),
  addRoomToSpaceMock: vi.fn(),
  reloadSpacesMock: vi.fn(),
  reloadActiveSpaceRoomsMock: vi.fn(),
  ensureRoomVisibleMock: vi.fn(),
  setSelectedSpaceIdMock: vi.fn(),
  setSearchKeywordMock: vi.fn(),
  setSessionTypeFilterMock: vi.fn(),
  setSessionEngagementFilterMock: vi.fn(),
  setSessionSortMock: vi.fn()
}))

const filteredSessionSource = ref([
  {
    roomId: '!alpha:server',
    name: 'Alpha Room',
    type: RoomTypeEnum.GROUP,
    avatar: '',
    activeTime: 20,
    unreadCount: 3,
    notificationCount: 3,
    highlightCount: 1,
    muteNotification: NotificationTypeEnum.RECEPTION,
    top: false
  },
  {
    roomId: '!beta:server',
    name: 'Beta Room',
    type: RoomTypeEnum.GROUP,
    avatar: '',
    activeTime: 10,
    unreadCount: 1,
    notificationCount: 1,
    highlightCount: 0,
    muteNotification: NotificationTypeEnum.RECEPTION,
    top: false
  },
  {
    roomId: '@alice:server',
    name: 'Alice',
    type: RoomTypeEnum.SINGLE,
    avatar: '',
    activeTime: 5,
    unreadCount: 0,
    notificationCount: 0,
    highlightCount: 0,
    muteNotification: NotificationTypeEnum.RECEPTION,
    top: false
  }
])

const route = reactive({
  path: '/spaceList',
  name: 'spaceWorkbench',
  query: {} as Record<string, unknown>
})

const workbenchState = reactive({
  searchKeyword: '',
  sessionTypeFilter: 'all',
  sessionEngagementFilter: 'all',
  sessionSort: 'recent'
})

const chatStore = reactive({
  sessionOptions: {
    isLoading: false
  },
  updateSession: vi.fn(),
  updateTotalUnreadCount: vi.fn()
})

const globalStore = reactive({
  currentSessionRoomId: '!alpha:server'
})

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    push: routerPushMock
  })
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

vi.mock('naive-ui', () => ({
  useMessage: () => ({
    success: messageSuccessMock,
    warning: messageWarningMock,
    error: messageErrorMock
  })
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getCurrent: () => ({
      label: 'home',
      listen: vi.fn()
    })
  }
}))

vi.mock('@/hooks/useTauriListener', () => ({
  useTauriListener: () => ({
    addListener: addListenerMock
  })
}))

vi.mock('@/hooks/session/openMsgSession', () => ({
  openMsgSession: vi.fn()
}))

vi.mock('@/hooks/useMessage.ts', () => ({
  useMessage: () => ({
    handleMsgClick: handleMsgClickMock,
    handleMsgDelete: handleMsgDeleteMock,
    handleMsgDblclick: handleMsgDblclickMock
  })
}))

vi.mock('@/hooks/useMitt', () => ({
  useMitt: {
    on: useMittOnMock,
    emit: useMittEmitMock
  }
}))

vi.mock('@/composables/workbench/useSessionPageSync', () => ({
  useSessionPageSync: vi.fn()
}))

vi.mock('@/composables/workbench/spacePermissions', () => ({
  canManageSpaceByPowerLevel: () => true
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({}))
  }
}))

vi.mock('@/composables/workbench/useSessionListState', () => ({
  useSessionListState: () => ({
    chatStore,
    globalStore,
    groupStore: {},
    syncLoading: ref(false),
    networkBanner: null,
    retrySessions: vi.fn(),
    sessionList: computed(() => filteredSessionSource.value),
    selectedSession: computed(() => filteredSessionSource.value[0] ?? null),
    invalidateSessionCache: vi.fn()
  })
}))

vi.mock('@/composables/workbench/useRoomSpaceWorkbench', () => ({
  useRoomSpaceWorkbench: () => ({
    spaces: computed(() => [{ spaceId: 'space-1', name: 'Space One', childCount: 2 }]),
    spaceLoading: ref(false),
    selectedSpaceId: ref('space-1'),
    activeSpace: computed(() => ({ spaceId: 'space-1', name: 'Space One', childCount: 2 })),
    searchKeyword: computed({
      get: () => workbenchState.searchKeyword,
      set: (value: string) => {
        workbenchState.searchKeyword = value
      }
    }),
    sessionTypeFilter: computed({
      get: () => workbenchState.sessionTypeFilter,
      set: (value: string) => {
        workbenchState.sessionTypeFilter = value
      }
    }),
    sessionEngagementFilter: computed({
      get: () => workbenchState.sessionEngagementFilter,
      set: (value: string) => {
        workbenchState.sessionEngagementFilter = value
      }
    }),
    sessionSort: computed({
      get: () => workbenchState.sessionSort,
      set: (value: string) => {
        workbenchState.sessionSort = value
      }
    }),
    filteredSessionList: computed(() => filteredSessionSource.value),
    setSelectedSpaceId: setSelectedSpaceIdMock,
    setSearchKeyword: setSearchKeywordMock,
    setSessionTypeFilter: setSessionTypeFilterMock,
    setSessionEngagementFilter: setSessionEngagementFilterMock,
    setSessionSort: setSessionSortMock,
    ensureRoomVisible: ensureRoomVisibleMock,
    reloadSpaces: reloadSpacesMock,
    reloadActiveSpaceRooms: reloadActiveSpaceRoomsMock
  })
}))

vi.mock('@/composables/space', () => ({
  useSpace: () => ({
    space: ref({ name: 'Space One', topic: 'Topic' }),
    load: loadSelectedSpaceMock,
    update: updateSelectedSpaceMock,
    mutating: ref(false),
    getTreePath: getTreePathMock
  }),
  useSpaceMembers: () => ({
    invite: inviteSpaceMemberMock,
    mutating: ref(false)
  }),
  useSpaceRooms: () => ({
    addRoom: addRoomToSpaceMock,
    mutating: ref(false)
  })
}))

vi.mock('@/services/matrix/room/RoomListService', () => ({
  roomListService: {
    markAsRead: markAsReadMock,
    clearUnreadSummary: clearUnreadSummaryMock
  }
}))

vi.mock('@/services/matrix/room/RoomStateService', () => ({
  roomStateService: {
    setRoomNotification: setRoomNotificationMock
  }
}))

vi.mock('@/services/matrix/room/RoomNavigationService', () => ({
  roomNavigationService: {
    leaveRoom: leaveRoomMock
  }
}))

vi.mock('@/stores/domains/chat/room', () => ({
  useRoomStore: () => ({
    hasTag: roomHasTagMock,
    addRoomTag: addRoomTagMock
  })
}))

vi.mock('@/components/workbench/RoomSpaceWorkbench.vue', () => ({
  default: defineComponent({
    name: 'RoomSpaceWorkbenchStub',
    props: {
      spaceBreadcrumbItems: { type: Array, default: () => [] }
    },
    emits: [
      'savePreset',
      'applySavedPreset',
      'batchMarkRead',
      'batchPin',
      'batchMute',
      'batchLeave',
      'selectSpaceBreadcrumb'
    ],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'space-workbench' }, [
          h('span', { 'data-test': 'breadcrumb-items' }, JSON.stringify(props.spaceBreadcrumbItems)),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'save-preset',
              onClick: () => emit('savePreset')
            },
            'save-preset'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'apply-preset',
              onClick: () => emit('applySavedPreset')
            },
            'apply-preset'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'batch-read',
              onClick: () => emit('batchMarkRead', ['!alpha:server', '!beta:server'])
            },
            'batch-read'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'batch-pin',
              onClick: () => emit('batchPin', ['!alpha:server', '!beta:server'])
            },
            'batch-pin'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'batch-mute',
              onClick: () => emit('batchMute', ['!alpha:server', '!beta:server'])
            },
            'batch-mute'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'batch-leave',
              onClick: () => emit('batchLeave', ['!alpha:server', '@alice:server'])
            },
            'batch-leave'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'breadcrumb-select',
              onClick: () => emit('selectSpaceBreadcrumb', 'space-root')
            },
            'breadcrumb-select'
          )
        ])
    }
  })
}))

describe('SpaceListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    workbenchState.searchKeyword = ''
    workbenchState.sessionTypeFilter = 'all'
    workbenchState.sessionEngagementFilter = 'all'
    workbenchState.sessionSort = 'recent'
    filteredSessionSource.value = [
      {
        roomId: '!alpha:server',
        name: 'Alpha Room',
        type: RoomTypeEnum.GROUP,
        avatar: '',
        activeTime: 20,
        unreadCount: 3,
        notificationCount: 3,
        highlightCount: 1,
        muteNotification: NotificationTypeEnum.RECEPTION,
        top: false
      },
      {
        roomId: '!beta:server',
        name: 'Beta Room',
        type: RoomTypeEnum.GROUP,
        avatar: '',
        activeTime: 10,
        unreadCount: 1,
        notificationCount: 1,
        highlightCount: 0,
        muteNotification: NotificationTypeEnum.RECEPTION,
        top: false
      },
      {
        roomId: '@alice:server',
        name: 'Alice',
        type: RoomTypeEnum.SINGLE,
        avatar: '',
        activeTime: 5,
        unreadCount: 0,
        notificationCount: 0,
        highlightCount: 0,
        muteNotification: NotificationTypeEnum.RECEPTION,
        top: false
      }
    ]
    roomHasTagMock.mockReturnValue(false)
    markAsReadMock.mockResolvedValue(undefined)
    clearUnreadSummaryMock.mockResolvedValue(undefined)
    setRoomNotificationMock.mockResolvedValue(undefined)
    leaveRoomMock.mockResolvedValue(undefined)
    addRoomTagMock.mockResolvedValue(undefined)
    handleMsgDeleteMock.mockResolvedValue(undefined)
    getTreePathMock.mockResolvedValue([
      { spaceId: 'space-root', name: 'Root Space' },
      { spaceId: 'space-1', name: 'Space One' }
    ])
  })

  it('saves the current toolbar preset to local storage', async () => {
    workbenchState.searchKeyword = 'roadmap'
    workbenchState.sessionTypeFilter = 'group'
    workbenchState.sessionEngagementFilter = 'unread'
    workbenchState.sessionSort = 'name'

    const wrapper = mount(SpaceListView)
    await wrapper.get('[data-test="save-preset"]').trigger('click')

    expect(JSON.parse(localStorage.getItem('hula-workbench-saved-preset') || 'null')).toEqual({
      search: 'roadmap',
      type: 'group',
      engagement: 'unread',
      sort: 'name'
    })
    expect(messageSuccessMock).toHaveBeenCalledWith('space.saved_preset_saved')
  })

  it('applies the saved toolbar preset back into the workbench state', async () => {
    localStorage.setItem(
      'hula-workbench-saved-preset',
      JSON.stringify({
        search: 'mentions',
        type: 'single',
        engagement: 'mention',
        sort: 'name'
      })
    )

    const wrapper = mount(SpaceListView)
    await wrapper.get('[data-test="apply-preset"]').trigger('click')

    expect(setSearchKeywordMock).toHaveBeenCalledWith('mentions')
    expect(setSessionTypeFilterMock).toHaveBeenCalledWith('single')
    expect(setSessionEngagementFilterMock).toHaveBeenCalledWith('mention')
    expect(setSessionSortMock).toHaveBeenCalledWith('name')
    expect(messageSuccessMock).toHaveBeenCalledWith('space.saved_preset_applied')
  })

  it('loads breadcrumb path for the selected space and forwards ancestor selection', async () => {
    const wrapper = mount(SpaceListView)
    await flushPromises()

    expect(getTreePathMock).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-test="breadcrumb-items"]').text()).toBe(
      JSON.stringify([
        { spaceId: 'space-root', name: 'Root Space' },
        { spaceId: 'space-1', name: 'Space One' }
      ])
    )

    await wrapper.get('[data-test="breadcrumb-select"]').trigger('click')
    expect(setSelectedSpaceIdMock).toHaveBeenCalledWith('space-root')
  })

  it('marks selected rooms as read and updates local unread state', async () => {
    const wrapper = mount(SpaceListView)
    await wrapper.get('[data-test="batch-read"]').trigger('click')
    await flushPromises()

    expect(markAsReadMock).toHaveBeenCalledWith('!alpha:server')
    expect(markAsReadMock).toHaveBeenCalledWith('!beta:server')
    expect(clearUnreadSummaryMock).toHaveBeenCalledTimes(2)
    expect(chatStore.updateSession).toHaveBeenCalledWith('!alpha:server', {
      unreadCount: 0
    })
    expect(chatStore.updateTotalUnreadCount).toHaveBeenCalledTimes(1)
    expect(messageSuccessMock).toHaveBeenCalledWith(
      'setting.notice.message_group_batch_update_result:{"success_count":2,"fail_count":0}'
    )
  })

  it('pins unpinned rooms via room tags', async () => {
    roomHasTagMock.mockImplementation((roomId: string) => roomId === '!beta:server')

    const wrapper = mount(SpaceListView)
    await wrapper.get('[data-test="batch-pin"]').trigger('click')
    await flushPromises()

    expect(addRoomTagMock).toHaveBeenCalledTimes(1)
    expect(addRoomTagMock).toHaveBeenCalledWith('!alpha:server', 'm.favourite')
    expect(messageSuccessMock).toHaveBeenCalledWith(
      'setting.notice.message_group_batch_update_result:{"success_count":2,"fail_count":0}'
    )
  })

  it('mutes selected rooms and updates local notification state', async () => {
    const wrapper = mount(SpaceListView)
    await wrapper.get('[data-test="batch-mute"]').trigger('click')
    await flushPromises()

    expect(setRoomNotificationMock).toHaveBeenCalledWith('!alpha:server', NotificationTypeEnum.NOT_DISTURB)
    expect(setRoomNotificationMock).toHaveBeenCalledWith('!beta:server', NotificationTypeEnum.NOT_DISTURB)
    expect(chatStore.updateSession).toHaveBeenCalledWith('!alpha:server', {
      muteNotification: NotificationTypeEnum.NOT_DISTURB
    })
    expect(chatStore.updateTotalUnreadCount).toHaveBeenCalledTimes(1)
  })

  it('leaves group rooms and reports skipped direct messages as partial failure', async () => {
    const wrapper = mount(SpaceListView)
    await wrapper.get('[data-test="batch-leave"]').trigger('click')
    await flushPromises()

    expect(leaveRoomMock).toHaveBeenCalledTimes(1)
    expect(leaveRoomMock).toHaveBeenCalledWith('!alpha:server')
    expect(handleMsgDeleteMock).toHaveBeenCalledWith('!alpha:server')
    expect(messageWarningMock).toHaveBeenCalledWith(
      'setting.notice.message_group_batch_update_result:{"success_count":1,"fail_count":1}'
    )
  })

  it('uses action feedback for inviting space members', async () => {
    inviteSpaceMemberMock.mockResolvedValue(true)
    const wrapper = mount(SpaceListView)
    const vm = wrapper.vm as unknown as {
      inviteForm: { userId: string }
      submitInviteSpaceMember: () => Promise<void>
    }

    vm.inviteForm.userId = ''
    await vm.submitInviteSpaceMember()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.invite_user_required', 'warning')

    vm.inviteForm.userId = '@alice:server'
    inviteSpaceMemberMock.mockResolvedValueOnce(false)
    await vm.submitInviteSpaceMember()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.invite_failed', 'error')

    inviteSpaceMemberMock.mockResolvedValueOnce(true)
    await vm.submitInviteSpaceMember()
    expect(inviteSpaceMemberMock).toHaveBeenCalledWith('@alice:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('space.invite_success', 'success')
  })

  it('uses action feedback for adding rooms into the selected space', async () => {
    addRoomToSpaceMock.mockResolvedValue(true)
    const wrapper = mount(SpaceListView)
    const vm = wrapper.vm as unknown as {
      addRoomForm: { roomId: string; suggested: boolean }
      submitAddSpaceRoom: () => Promise<void>
    }

    vm.addRoomForm.roomId = ''
    await vm.submitAddSpaceRoom()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.add_room_required', 'warning')

    vm.addRoomForm.roomId = '!child:server'
    vm.addRoomForm.suggested = true
    addRoomToSpaceMock.mockResolvedValueOnce(false)
    await vm.submitAddSpaceRoom()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.add_room_failed', 'error')

    addRoomToSpaceMock.mockResolvedValueOnce(true)
    await vm.submitAddSpaceRoom()
    expect(addRoomToSpaceMock).toHaveBeenCalledWith('!child:server', { suggested: true })
    expect(reloadSpacesMock).toHaveBeenCalled()
    expect(reloadActiveSpaceRoomsMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.add_room_success', 'success')
  })

  it('uses action feedback for updating selected space settings', async () => {
    const wrapper = mount(SpaceListView)
    const vm = wrapper.vm as unknown as {
      settingsForm: { name: string; topic: string }
      submitSpaceSettings: () => Promise<void>
    }

    vm.settingsForm.name = '   '
    await vm.submitSpaceSettings()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.name_required', 'warning')

    vm.settingsForm.name = 'Renamed Space'
    vm.settingsForm.topic = 'Updated Topic'
    updateSelectedSpaceMock.mockResolvedValueOnce(false)
    await vm.submitSpaceSettings()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.settings_failed', 'error')

    updateSelectedSpaceMock.mockResolvedValueOnce(true)
    await vm.submitSpaceSettings()
    expect(updateSelectedSpaceMock).toHaveBeenCalledWith({
      name: 'Renamed Space',
      topic: 'Updated Topic'
    })
    expect(reloadSpacesMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.settings_success', 'success')
  })
})
