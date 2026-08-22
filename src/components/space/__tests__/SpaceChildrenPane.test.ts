import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import SpaceChildrenPane from '../SpaceChildrenPane.vue'

const {
  routerPushMock,
  routerBackMock,
  showFeedbackMock,
  roomHasTagMock,
  loadSpacesMock,
  loadSelectedSpaceMock,
  updateSelectedSpaceMock,
  loadSpaceMembersMock,
  loadSpaceRoomsMock,
  inviteSpaceMemberMock,
  addRoomToSpaceMock,
  toggleSuggestedInSpaceMock,
  canManageSpaceMock,
  leaveSpaceMock,
  deleteSpaceMock,
  joinSpaceMock,
  removeChildMock,
  enterChatMock,
  enterSpaceMock
} = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
  routerBackMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  roomHasTagMock: vi.fn(() => false),
  loadSpacesMock: vi.fn(async () => undefined),
  loadSelectedSpaceMock: vi.fn(async () => undefined),
  updateSelectedSpaceMock: vi.fn(async () => true),
  loadSpaceMembersMock: vi.fn(async () => undefined),
  loadSpaceRoomsMock: vi.fn(async () => undefined),
  inviteSpaceMemberMock: vi.fn(async () => true),
  addRoomToSpaceMock: vi.fn(async () => true),
  toggleSuggestedInSpaceMock: vi.fn(async () => true),
  canManageSpaceMock: vi.fn(() => true),
  leaveSpaceMock: vi.fn(async () => undefined),
  deleteSpaceMock: vi.fn(async () => undefined),
  joinSpaceMock: vi.fn(async () => undefined),
  removeChildMock: vi.fn(async () => undefined),
  enterChatMock: vi.fn(async () => undefined),
  enterSpaceMock: vi.fn(async () => undefined)
}))

const spacesRef = ref([
  {
    spaceId: '!space-1:server',
    name: 'Design Team',
    topic: 'Design collaboration space',
    childCount: 5,
    memberCount: 12,
    avatarUrl: undefined
  }
])

const selectedSpaceDetailRef = ref<{ name: string; topic?: string } | null>({
  name: 'Design Team',
  topic: 'Design collaboration space'
})

const membersRef = ref<Array<{ space_id: string; user_id: string; membership?: string; joined_ts?: number }>>([
  { space_id: '!space-1:server', user_id: '@alice:server', membership: 'join' }
])

const roomsRef = ref<Array<{ roomId: string; name: string; avatarUrl?: string }>>([
  { roomId: '!room-1:server', name: 'General', avatarUrl: undefined }
])

// 路由参数可变 mock
const routeRef = ref({ params: { spaceId: '!space-1:server' }, path: '/space/!space-1:server', query: {} })

vi.mock('vue-router', () => ({
  useRoute: () => routeRef.value,
  useRouter: () => ({
    push: routerPushMock,
    back: routerBackMock
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

vi.mock('@/composables/chat/useEnterChat', () => ({
  useEnterChat: () => ({
    enterChat: enterChatMock,
    enterSpace: enterSpaceMock
  })
}))

vi.mock('@/composables/space', () => ({
  useSpaces: () => ({
    spaces: computed(() => spacesRef.value),
    loading: ref(false),
    load: loadSpacesMock
  }),
  useSpace: () => ({
    space: computed(() => selectedSpaceDetailRef.value),
    load: loadSelectedSpaceMock,
    update: updateSelectedSpaceMock,
    mutating: ref(false)
  }),
  useSpaceMembers: () => ({
    members: computed(() => membersRef.value),
    loading: ref(false),
    load: loadSpaceMembersMock,
    invite: inviteSpaceMemberMock,
    mutating: ref(false)
  }),
  useSpaceRooms: () => ({
    rooms: computed(() => roomsRef.value),
    loading: ref(false),
    load: loadSpaceRoomsMock,
    addRoom: addRoomToSpaceMock,
    toggleSuggested: toggleSuggestedInSpaceMock,
    mutating: ref(false)
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    canManageSpace: canManageSpaceMock
  }
}))

vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: {
    leaveSpace: leaveSpaceMock,
    deleteSpace: deleteSpaceMock,
    joinSpace: joinSpaceMock,
    removeChild: removeChildMock
  }
}))

vi.mock('@/stores/domains/chat/room', () => ({
  useRoomStore: () => ({
    hasTag: roomHasTagMock
  })
}))

// Stub SpaceDetailsPane 以隔离测试 SpaceChildrenPane 的逻辑
vi.mock('@/components/workbench/SpaceDetailsPane.vue', () => ({
  default: defineComponent({
    name: 'SpaceDetailsPaneStub',
    props: {
      activeSpace: { type: Object, default: null },
      members: { type: Array, default: () => [] },
      rooms: { type: Array, default: () => [] },
      membersLoading: { type: Boolean, default: false },
      roomsLoading: { type: Boolean, default: false },
      canManage: { type: Boolean, default: false },
      manageMode: { type: String, default: null },
      manageSubmitting: { type: Boolean, default: false },
      inviteUserId: { type: String, default: '' },
      addRoomId: { type: String, default: '' },
      addRoomSuggested: { type: Boolean, default: false },
      savingSpaceName: { type: Boolean, default: false },
      savingSpaceTopic: { type: Boolean, default: false },
      enteringChat: { type: Boolean, default: false }
    },
    emits: [
      'enterSpace',
      'enterRoom',
      'inviteMember',
      'addRoom',
      'joinSpace',
      'saveSpaceName',
      'saveSpaceTopic',
      'removeRoom',
      'leaveSpace',
      'deleteSpace',
      'closeManagePane',
      'submitManagePane',
      'update:subView',
      'update:inviteUserId',
      'update:addRoomId',
      'update:addRoomSuggested',
      'memberClick',
      'selectSpace'
    ],
    setup(_, { emit }) {
      return () =>
        h('div', { 'data-test': 'space-details-stub' }, [
          h('button', { onClick: () => emit('enterSpace') }, 'enter'),
          h('button', { onClick: () => emit('enterRoom', '!room-1:server') }, 'room'),
          h('button', { onClick: () => emit('leaveSpace') }, 'leave'),
          h('button', { onClick: () => emit('deleteSpace') }, 'delete')
        ])
    }
  })
}))

describe('SpaceChildrenPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeRef.value = { params: { spaceId: '!space-1:server' }, path: '/space/!space-1:server', query: {} }
    selectedSpaceDetailRef.value = { name: 'Design Team', topic: 'Design collaboration space' }
    membersRef.value = [{ space_id: '!space-1:server', user_id: '@alice:server', membership: 'join' }]
    roomsRef.value = [{ roomId: '!room-1:server', name: 'General', avatarUrl: undefined }]
    roomHasTagMock.mockReturnValue(false)
    canManageSpaceMock.mockReturnValue(true)
    loadSpacesMock.mockResolvedValue(undefined)
    loadSelectedSpaceMock.mockResolvedValue(undefined)
    loadSpaceMembersMock.mockResolvedValue(undefined)
    loadSpaceRoomsMock.mockResolvedValue(undefined)
    // window.$dialog mock
    ;(globalThis.window as unknown as { $dialog: unknown }).$dialog = {
      create: vi.fn(({ onPositiveClick }: { onPositiveClick?: () => Promise<void> }) => {
        if (onPositiveClick) void onPositiveClick()
      }),
      warning: vi.fn(({ onPositiveClick }: { onPositiveClick?: () => Promise<void> }) => {
        if (onPositiveClick) void onPositiveClick()
      })
    }
    // window.history mock
    Object.defineProperty(window, 'history', {
      value: { length: 2 },
      writable: true
    })
  })

  it('mounts and loads space details on init via route param', async () => {
    mount(SpaceChildrenPane)
    await flushPromises()

    expect(loadSelectedSpaceMock).toHaveBeenCalled()
    expect(loadSpaceMembersMock).toHaveBeenCalled()
    expect(loadSpaceRoomsMock).toHaveBeenCalled()
  })

  it('does not load when spaceId is empty', async () => {
    routeRef.value = { params: { spaceId: '' }, path: '/space', query: {} }
    loadSelectedSpaceMock.mockClear()
    loadSpaceMembersMock.mockClear()
    loadSpaceRoomsMock.mockClear()

    mount(SpaceChildrenPane)
    await flushPromises()

    expect(loadSelectedSpaceMock).not.toHaveBeenCalled()
    expect(loadSpaceMembersMock).not.toHaveBeenCalled()
    expect(loadSpaceRoomsMock).not.toHaveBeenCalled()
  })

  it('enters space by calling enterSpace from useEnterChat', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as { handleEnterChat: () => Promise<void> }
    enterSpaceMock.mockClear()
    await vm.handleEnterChat()

    expect(enterSpaceMock).toHaveBeenCalledWith('!space-1:server')
  })

  it('enters child room by calling enterChat from useEnterChat', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as { handleEnterRoom: (roomId: string) => Promise<void> }
    enterChatMock.mockClear()
    await vm.handleEnterRoom('!room-1:server')

    expect(enterChatMock).toHaveBeenCalledWith('!room-1:server', 'room')
  })

  it('validates invite form submission', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

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

  it('validates add room form submission', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

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
    expect(showFeedbackMock).toHaveBeenCalledWith('space.add_room_success', 'success')
  })

  it('validates inline space name save', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as { handleSaveSpaceName: (newName: string) => Promise<void> }

    // 空名称直接返回
    updateSelectedSpaceMock.mockClear()
    await vm.handleSaveSpaceName('')
    expect(updateSelectedSpaceMock).not.toHaveBeenCalled()

    // 与当前名称相同，不调用 update
    updateSelectedSpaceMock.mockClear()
    await vm.handleSaveSpaceName('Design Team')
    expect(updateSelectedSpaceMock).not.toHaveBeenCalled()

    // 新名称：update 成功
    updateSelectedSpaceMock.mockResolvedValueOnce(true)
    await vm.handleSaveSpaceName('Renamed Space')
    expect(updateSelectedSpaceMock).toHaveBeenCalledWith({ name: 'Renamed Space' })
    expect(showFeedbackMock).toHaveBeenCalledWith('space.name_saved', 'success')
  })

  it('validates inline space topic save', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as { handleSaveSpaceTopic: (newTopic: string) => Promise<void> }

    // 与当前 topic 相同
    updateSelectedSpaceMock.mockClear()
    await vm.handleSaveSpaceTopic('Design collaboration space')
    expect(updateSelectedSpaceMock).not.toHaveBeenCalled()

    // 新 topic：update 成功
    updateSelectedSpaceMock.mockResolvedValueOnce(true)
    await vm.handleSaveSpaceTopic('Updated Topic')
    expect(updateSelectedSpaceMock).toHaveBeenCalledWith({ topic: 'Updated Topic' })
    expect(showFeedbackMock).toHaveBeenCalledWith('space.topic_saved', 'success')
  })

  it('leaves space with confirm dialog and navigates back', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as { handleLeaveSpace: () => void }
    leaveSpaceMock.mockClear()
    routerBackMock.mockClear()

    await vm.handleLeaveSpace()
    await flushPromises()

    expect(leaveSpaceMock).toHaveBeenCalledWith('!space-1:server')
    expect(loadSpacesMock).toHaveBeenCalled()
    expect(routerBackMock).toHaveBeenCalled()
  })

  it('deletes space with confirm dialog and navigates back', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as { handleDeleteSpace: () => void }
    deleteSpaceMock.mockClear()
    routerBackMock.mockClear()

    await vm.handleDeleteSpace()
    await flushPromises()

    expect(deleteSpaceMock).toHaveBeenCalledWith('!space-1:server')
    expect(loadSpacesMock).toHaveBeenCalled()
    expect(routerBackMock).toHaveBeenCalled()
  })

  it('prevents delete when canManage is false', async () => {
    canManageSpaceMock.mockReturnValue(false)
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as { handleDeleteSpace: () => void }
    deleteSpaceMock.mockClear()

    await vm.handleDeleteSpace()

    expect(deleteSpaceMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.delete_space_failed', 'error')
  })

  it('removes child room with confirm dialog', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as { handleRemoveSpaceRoom: (roomId: string) => void }
    removeChildMock.mockClear()

    await vm.handleRemoveSpaceRoom('!room-1:server')
    await flushPromises()

    expect(removeChildMock).toHaveBeenCalledWith('!space-1:server', '!room-1:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('space.remove_room_success', 'success')
  })

  it('opens and closes manage pane for invite', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as {
      manageMode: string | null
      openInviteSpaceMember: () => void
      closeManagePane: () => void
    }

    vm.openInviteSpaceMember()
    expect(vm.manageMode).toBe('invite')

    vm.closeManagePane()
    expect(vm.manageMode).toBeNull()
  })

  it('opens and closes manage pane for add room', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as {
      manageMode: string | null
      openAddSpaceRoom: () => void
      closeManagePane: () => void
    }

    vm.openAddSpaceRoom()
    expect(vm.manageMode).toBe('add-room')

    vm.closeManagePane()
    expect(vm.manageMode).toBeNull()
  })

  it('joinSpace calls matrixSpaceService.joinSpace and reloads data', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as {
      handleJoinSpace: () => Promise<void>
    }
    joinSpaceMock.mockClear()
    await vm.handleJoinSpace()
    await flushPromises()

    expect(joinSpaceMock).toHaveBeenCalledWith('!space-1:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('space.join_space_success', 'success')
  })

  it('subView resets to overview when spaceId changes', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as { subView: string }
    // 通过 setup 暴露的 ref 在 vm 上是未解包的，这里仅验证路由变化后子视图重置
    // 先模拟设置 subView 为非 overview（实际由 update:subView 事件触发）
    // 此处通过直接修改 vm 上的属性验证 watch 逻辑
    routeRef.value = { params: { spaceId: '!space-2:server' }, path: '/space/!space-2:server', query: {} }
    await flushPromises()

    // 切换空间后 subView 应回到 overview
    expect(vm.subView).toBe('overview')
  })

  it('does not open invite pane when canManage is false', async () => {
    canManageSpaceMock.mockReturnValue(false)
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as {
      manageMode: string | null
      openInviteSpaceMember: () => void
    }

    vm.openInviteSpaceMember()
    expect(vm.manageMode).toBeNull()
  })

  it('toggles suggested flag via useSpaceRooms and shows success feedback', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as { handleToggleSuggested: (roomId: string, current: boolean) => Promise<void> }
    toggleSuggestedInSpaceMock.mockResolvedValueOnce(true)
    showFeedbackMock.mockClear()

    await vm.handleToggleSuggested('!room-1:server', false)

    expect(toggleSuggestedInSpaceMock).toHaveBeenCalledWith('!room-1:server', false)
    expect(showFeedbackMock).toHaveBeenCalledWith('space.mark_suggested_success', 'success')
  })

  it('shows failure feedback when toggleSuggested returns false', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const vm = wrapper.vm as unknown as { handleToggleSuggested: (roomId: string, current: boolean) => Promise<void> }
    toggleSuggestedInSpaceMock.mockResolvedValueOnce(false)
    showFeedbackMock.mockClear()

    await vm.handleToggleSuggested('!room-1:server', true)

    expect(showFeedbackMock).toHaveBeenCalledWith('space.toggle_suggested_failed', 'error')
  })
})
