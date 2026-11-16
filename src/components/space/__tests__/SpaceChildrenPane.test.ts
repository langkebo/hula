import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { buildSpaceRoute } from '@/router/spaceNavigation'
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
  removeRoomFromSpaceMock,
  canManageSpaceMock,
  leaveSpaceMock,
  deleteSpaceMock,
  joinSpaceMock,
  removeChildMock,
  enterChatMock,
  enterSpaceMock,
  refreshErrorRef
} = vi.hoisted(() => ({
  routerPushMock: vi.fn(async () => undefined),
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
  removeRoomFromSpaceMock: vi.fn(async () => true),
  canManageSpaceMock: vi.fn(() => true),
  leaveSpaceMock: vi.fn(async () => undefined),
  deleteSpaceMock: vi.fn(async () => undefined),
  joinSpaceMock: vi.fn(async () => undefined),
  removeChildMock: vi.fn(async () => undefined),
  enterChatMock: vi.fn(async () => undefined),
  enterSpaceMock: vi.fn(async () => undefined),
  refreshErrorRef: { current: null as null | { value: string | null } }
}))

// 每个用例结束后卸载组件：路由 mock 是跨用例共享的 reactive 对象，
// 残留的 watch 会在下一个用例重置路由时触发额外 load，污染调用次数断言。
enableAutoUnmount(afterEach)

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

const roomsRef = ref<Array<{ roomId: string; name: string; avatarUrl?: string; suggested?: boolean }>>([
  { roomId: '!room-1:server', name: 'General', suggested: false }
])

// 路由 mock：useRoute() 返回稳定的 reactive 对象（真实 vue-router 的 route 也是响应式代理）。
// 返回 routeRef.value 普通对象快照会让 computed(spaceId) 失去响应式依赖，watch 永不触发。
const routeRef = reactive({
  params: { spaceId: '!space-1:server' as string },
  path: '/space/!space-1:server',
  query: {} as Record<string, string>
})

vi.mock('vue-router', () => ({
  useRoute: () => routeRef,
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
  useSpaceRooms: () => {
    // 工厂内构造真 ref：hoisted 阶段拿不到 vue 的 ref
    const refreshError = ref<string | null>(null)
    refreshErrorRef.current = refreshError
    return {
      rooms: computed(() => roomsRef.value),
      loading: ref(false),
      load: loadSpaceRoomsMock,
      addRoom: addRoomToSpaceMock,
      removeRoom: removeRoomFromSpaceMock,
      toggleSuggested: toggleSuggestedInSpaceMock,
      refreshError,
      mutating: ref(false)
    }
  }
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

// Stub SpaceDetailsPane 以隔离测试 SpaceChildrenPane 的逻辑。
// 所有交互都通过 emit 真实事件触发，用例不再直调组件内部 handler。
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
      isMember: { type: Boolean, default: true },
      joinRule: { type: String, default: undefined },
      subView: { type: String, default: 'overview' },
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
      const button = (test: string, onClick: () => void) => h('button', { 'data-test': test, onClick }, test)
      return () =>
        h('div', { 'data-test': 'space-details-stub' }, [
          button('stub-enter-space', () => emit('enterSpace')),
          button('stub-enter-room', () => emit('enterRoom', '!room-1:server')),
          button('stub-leave-space', () => emit('leaveSpace')),
          button('stub-delete-space', () => emit('deleteSpace')),
          button('stub-select-space', () =>
            emit('selectSpace', { spaceId: '!space-2:server', name: 'Design Team', memberCount: 0, childCount: 0 })
          ),
          button('stub-select-empty-space', () =>
            emit('selectSpace', { spaceId: '', name: '', memberCount: 0, childCount: 0 })
          ),
          button('stub-member-click', () => emit('memberClick', '@alice:server')),
          button('stub-member-click-empty', () => emit('memberClick', '')),
          button('stub-invite-member', () => emit('inviteMember')),
          button('stub-add-room', () => emit('addRoom')),
          button('stub-join-space', () => emit('joinSpace')),
          button('stub-save-empty-name', () => emit('saveSpaceName', '')),
          button('stub-save-same-name', () => emit('saveSpaceName', 'Design Team')),
          button('stub-save-name', () => emit('saveSpaceName', 'Renamed Space')),
          button('stub-save-same-topic', () => emit('saveSpaceTopic', 'Design collaboration space')),
          button('stub-save-topic', () => emit('saveSpaceTopic', 'Updated Topic')),
          button('stub-remove-room', () => emit('removeRoom', '!room-1:server')),
          button('stub-close-manage', () => emit('closeManagePane')),
          button('stub-submit-manage', () => emit('submitManagePane')),
          button('stub-set-subview', () => emit('update:subView', 'members')),
          button('stub-set-invite-user', () => emit('update:inviteUserId', '@alice:server')),
          button('stub-clear-invite-user', () => emit('update:inviteUserId', '')),
          button('stub-set-add-room', () => emit('update:addRoomId', '!child:server')),
          button('stub-clear-add-room', () => emit('update:addRoomId', '')),
          button('stub-set-suggested', () => emit('update:addRoomSuggested', true))
        ])
    }
  })
}))

const detailsStub = (wrapper: ReturnType<typeof mount>) => wrapper.findComponent({ name: 'SpaceDetailsPaneStub' })

describe('SpaceChildrenPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(routeRef, {
      params: { spaceId: '!space-1:server' },
      path: '/space/!space-1:server',
      query: {}
    })
    selectedSpaceDetailRef.value = { name: 'Design Team', topic: 'Design collaboration space' }
    membersRef.value = [{ space_id: '!space-1:server', user_id: '@alice:server', membership: 'join' }]
    roomsRef.value = [{ roomId: '!room-1:server', name: 'General', suggested: false }]
    roomHasTagMock.mockReturnValue(false)
    canManageSpaceMock.mockReturnValue(true)
    loadSpacesMock.mockResolvedValue(undefined)
    loadSelectedSpaceMock.mockResolvedValue(undefined)
    loadSpaceMembersMock.mockResolvedValue(undefined)
    loadSpaceRoomsMock.mockResolvedValue(undefined)
    removeRoomFromSpaceMock.mockResolvedValue(true)
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
    routeRef.params = { spaceId: '' }
    routeRef.path = '/space'
    loadSelectedSpaceMock.mockClear()
    loadSpaceMembersMock.mockClear()
    loadSpaceRoomsMock.mockClear()

    mount(SpaceChildrenPane)
    await flushPromises()

    expect(loadSelectedSpaceMock).not.toHaveBeenCalled()
    expect(loadSpaceMembersMock).not.toHaveBeenCalled()
    expect(loadSpaceRoomsMock).not.toHaveBeenCalled()
  })

  it('enters space when the details pane emits enter-space', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    enterSpaceMock.mockClear()
    await wrapper.get('[data-test="stub-enter-space"]').trigger('click')
    await flushPromises()

    expect(enterSpaceMock).toHaveBeenCalledWith('!space-1:server')
  })

  it('enters child room when the details pane emits enter-room', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    enterChatMock.mockClear()
    await wrapper.get('[data-test="stub-enter-room"]').trigger('click')
    await flushPromises()

    expect(enterChatMock).toHaveBeenCalledWith('!room-1:server', 'room')
  })

  // 回归：SpaceDetailsPane 的层级树选中/成员点击原先无人监听（守门基线 32 条之一）。
  // 行为必须与参考实现一致：SpaceList.vue:183-187 / GroupDetails.vue:176-181。
  it('routes to the selected space when the hierarchy tree emits select-space', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()
    routerPushMock.mockClear()

    await wrapper.get('[data-test="stub-select-space"]').trigger('click')
    await flushPromises()

    expect(routerPushMock).toHaveBeenCalledWith(buildSpaceRoute('!space-2:server'))
  })

  // 与参考实现 SpaceList.vue:184-189 同语义：选择空间时向屏幕阅读器播报空间名。
  it('announces the selected space for screen readers', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    const { messages, clearAnnouncements } = useAriaLive()
    clearAnnouncements()

    await wrapper.get('[data-test="stub-select-space"]').trigger('click')

    expect(messages.value.map((m) => m.text)).toContain('space.space_selected:{"name":"Design Team"}')
  })

  it('ignores select-space with an empty space id', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()
    routerPushMock.mockClear()

    await wrapper.get('[data-test="stub-select-empty-space"]').trigger('click')
    await flushPromises()

    expect(routerPushMock).not.toHaveBeenCalled()
  })

  it('routes to friend details when a member row emits member-click', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()
    routerPushMock.mockClear()

    await wrapper.get('[data-test="stub-member-click"]').trigger('click')
    await flushPromises()

    expect(routerPushMock).toHaveBeenCalledWith({ path: `/friend/${encodeURIComponent('@alice:server')}` })
  })

  it('ignores member-click with an empty user id', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()
    routerPushMock.mockClear()

    await wrapper.get('[data-test="stub-member-click-empty"]').trigger('click')
    await flushPromises()

    expect(routerPushMock).not.toHaveBeenCalled()
  })

  it('validates invite form submission', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    await wrapper.get('[data-test="stub-invite-member"]').trigger('click')
    await wrapper.get('[data-test="stub-clear-invite-user"]').trigger('click')
    await wrapper.get('[data-test="stub-submit-manage"]').trigger('click')
    await flushPromises()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.invite_user_required', 'warning')

    await wrapper.get('[data-test="stub-set-invite-user"]').trigger('click')
    inviteSpaceMemberMock.mockResolvedValueOnce(false)
    await wrapper.get('[data-test="stub-submit-manage"]').trigger('click')
    await flushPromises()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.invite_failed', 'error')

    inviteSpaceMemberMock.mockResolvedValueOnce(true)
    await wrapper.get('[data-test="stub-submit-manage"]').trigger('click')
    await flushPromises()
    expect(inviteSpaceMemberMock).toHaveBeenCalledWith('@alice:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('space.invite_success', 'success')
  })

  it('validates add room form submission', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    await wrapper.get('[data-test="stub-add-room"]').trigger('click')
    await wrapper.get('[data-test="stub-clear-add-room"]').trigger('click')
    await wrapper.get('[data-test="stub-submit-manage"]').trigger('click')
    await flushPromises()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.add_room_required', 'warning')

    await wrapper.get('[data-test="stub-set-add-room"]').trigger('click')
    await wrapper.get('[data-test="stub-set-suggested"]').trigger('click')
    addRoomToSpaceMock.mockResolvedValueOnce(false)
    await wrapper.get('[data-test="stub-submit-manage"]').trigger('click')
    await flushPromises()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.add_room_failed', 'error')

    addRoomToSpaceMock.mockResolvedValueOnce(true)
    await wrapper.get('[data-test="stub-submit-manage"]').trigger('click')
    await flushPromises()
    expect(addRoomToSpaceMock).toHaveBeenCalledWith('!child:server', { suggested: true })
    expect(showFeedbackMock).toHaveBeenCalledWith('space.add_room_success', 'success')
  })

  it('validates inline space name save', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    // 空名称直接返回
    updateSelectedSpaceMock.mockClear()
    await wrapper.get('[data-test="stub-save-empty-name"]').trigger('click')
    await flushPromises()
    expect(updateSelectedSpaceMock).not.toHaveBeenCalled()

    // 与当前名称相同，不调用 update
    await wrapper.get('[data-test="stub-save-same-name"]').trigger('click')
    await flushPromises()
    expect(updateSelectedSpaceMock).not.toHaveBeenCalled()

    // 新名称：update 成功
    updateSelectedSpaceMock.mockResolvedValueOnce(true)
    await wrapper.get('[data-test="stub-save-name"]').trigger('click')
    await flushPromises()
    expect(updateSelectedSpaceMock).toHaveBeenCalledWith({ name: 'Renamed Space' })
    expect(showFeedbackMock).toHaveBeenCalledWith('space.name_saved', 'success')
  })

  it('validates inline space topic save', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    // 与当前 topic 相同
    updateSelectedSpaceMock.mockClear()
    await wrapper.get('[data-test="stub-save-same-topic"]').trigger('click')
    await flushPromises()
    expect(updateSelectedSpaceMock).not.toHaveBeenCalled()

    // 新 topic：update 成功
    updateSelectedSpaceMock.mockResolvedValueOnce(true)
    await wrapper.get('[data-test="stub-save-topic"]').trigger('click')
    await flushPromises()
    expect(updateSelectedSpaceMock).toHaveBeenCalledWith({ topic: 'Updated Topic' })
    expect(showFeedbackMock).toHaveBeenCalledWith('space.topic_saved', 'success')
  })

  it('leaves space with confirm dialog and navigates back', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    leaveSpaceMock.mockClear()
    routerBackMock.mockClear()

    await wrapper.get('[data-test="stub-leave-space"]').trigger('click')
    await flushPromises()

    expect(leaveSpaceMock).toHaveBeenCalledWith('!space-1:server')
    expect(loadSpacesMock).toHaveBeenCalled()
    expect(routerBackMock).toHaveBeenCalled()
  })

  it('deletes space with confirm dialog and navigates back', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    deleteSpaceMock.mockClear()
    routerBackMock.mockClear()

    await wrapper.get('[data-test="stub-delete-space"]').trigger('click')
    await flushPromises()

    expect(deleteSpaceMock).toHaveBeenCalledWith('!space-1:server')
    expect(loadSpacesMock).toHaveBeenCalled()
    expect(routerBackMock).toHaveBeenCalled()
  })

  it('prevents delete when canManage is false', async () => {
    canManageSpaceMock.mockReturnValue(false)
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    deleteSpaceMock.mockClear()

    await wrapper.get('[data-test="stub-delete-space"]').trigger('click')
    await flushPromises()

    expect(deleteSpaceMock).not.toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.delete_space_failed', 'error')
  })

  it('removes child room with confirm dialog', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    removeRoomFromSpaceMock.mockClear()

    await wrapper.get('[data-test="stub-remove-room"]').trigger('click')
    await flushPromises()

    expect(removeRoomFromSpaceMock).toHaveBeenCalledWith('!room-1:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('space.remove_room_success', 'success')
  })

  it('移除成功但列表刷新失败时按成功反馈，并由局部提示说明列表可能过期', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    removeRoomFromSpaceMock.mockImplementationOnce(async () => {
      refreshErrorRef.current!.value = 'refresh boom'
      return true
    })
    showFeedbackMock.mockClear()

    await wrapper.get('[data-test="stub-remove-room"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('space.remove_room_success', 'success')
    expect(showFeedbackMock).not.toHaveBeenCalledWith('space.remove_room_failed', 'error')
    expect(wrapper.find('[data-test="space-children-refresh-error"]').exists()).toBe(true)
  })

  it('局部刷新失败提示可重试，重试调用 load 拉取最新列表', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    refreshErrorRef.current!.value = 'refresh boom'
    await flushPromises()

    expect(wrapper.find('[data-test="space-children-refresh-error"]').exists()).toBe(true)
    expect(wrapper.get('[data-test="space-children-refresh-error"]').text()).toContain('space.rooms_refresh_failed')

    loadSpaceRoomsMock.mockClear()
    await wrapper.get('[data-test="space-children-refresh-error"] [data-testid="partial-retry"]').trigger('click')
    await flushPromises()

    expect(loadSpaceRoomsMock).toHaveBeenCalledTimes(1)
  })

  it('opens and closes manage pane for invite', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()
    const stub = detailsStub(wrapper)

    await wrapper.get('[data-test="stub-invite-member"]').trigger('click')
    expect(stub.props('manageMode')).toBe('invite')

    await wrapper.get('[data-test="stub-close-manage"]').trigger('click')
    expect(stub.props('manageMode')).toBeNull()
  })

  it('opens and closes manage pane for add room', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()
    const stub = detailsStub(wrapper)

    await wrapper.get('[data-test="stub-add-room"]').trigger('click')
    expect(stub.props('manageMode')).toBe('add-room')

    await wrapper.get('[data-test="stub-close-manage"]').trigger('click')
    expect(stub.props('manageMode')).toBeNull()
  })

  it('joinSpace CTA success only reloads data without calling joinSpace directly', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    joinSpaceMock.mockClear()
    loadSpacesMock.mockClear()
    loadSelectedSpaceMock.mockClear()
    await wrapper.get('[data-test="stub-join-space"]').trigger('click')
    await flushPromises()

    // join / knock 已由 TjgSpaceJoinCta 内部完成，壳层仅负责刷新
    expect(joinSpaceMock).not.toHaveBeenCalled()
    expect(loadSpacesMock).toHaveBeenCalled()
    expect(loadSelectedSpaceMock).toHaveBeenCalled()
  })

  it('subView resets to overview when spaceId changes', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()
    const stub = detailsStub(wrapper)

    expect(stub.props('subView')).toBe('overview')

    // 先经真实事件把子视图切到非 overview
    await wrapper.get('[data-test="stub-set-subview"]').trigger('click')
    expect(stub.props('subView')).toBe('members')

    // 切换空间：useRoute 返回 reactive 对象，spaceId computed 才能驱动 watch
    loadSpaceRoomsMock.mockClear()
    routeRef.params = { spaceId: '!space-2:server' }
    routeRef.path = '/space/!space-2:server'
    await flushPromises()

    expect(stub.props('subView')).toBe('overview')
    expect(loadSpaceRoomsMock).toHaveBeenCalledTimes(1)
  })

  it('does not open invite pane when canManage is false', async () => {
    canManageSpaceMock.mockReturnValue(false)
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    await wrapper.get('[data-test="stub-invite-member"]').trigger('click')

    expect(detailsStub(wrapper).props('manageMode')).toBeNull()
  })

  it('toggles suggested flag via useSpaceRooms and shows success feedback', async () => {
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    toggleSuggestedInSpaceMock.mockResolvedValueOnce(true)
    showFeedbackMock.mockClear()

    // 真实入口：SpaceRoomGrid 的星标按钮 → toggle-suggested 事件
    await wrapper.get('.space-room-grid__star-btn').trigger('click')
    await flushPromises()

    expect(toggleSuggestedInSpaceMock).toHaveBeenCalledWith('!room-1:server', false)
    expect(showFeedbackMock).toHaveBeenCalledWith('space.mark_suggested_success', 'success')
  })

  it('shows failure feedback when toggleSuggested returns false', async () => {
    roomsRef.value = [{ roomId: '!room-1:server', name: 'General', suggested: true }]
    const wrapper = mount(SpaceChildrenPane)
    await flushPromises()

    toggleSuggestedInSpaceMock.mockResolvedValueOnce(false)
    showFeedbackMock.mockClear()

    await wrapper.get('.space-room-grid__star-btn').trigger('click')
    await flushPromises()

    expect(toggleSuggestedInSpaceMock).toHaveBeenCalledWith('!room-1:server', true)
    expect(showFeedbackMock).toHaveBeenCalledWith('space.toggle_suggested_failed', 'error')
  })
})
