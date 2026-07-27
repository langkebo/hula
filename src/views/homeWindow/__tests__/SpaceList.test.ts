import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import SpaceListView from '../SpaceList.vue'

const {
  routerPushMock,
  showFeedbackMock,
  announceMock,
  roomHasTagMock,
  addRoomTagMock,
  removeRoomTagMock,
  loadSpacesMock,
  leaveSpaceMock,
  deleteSpaceMock
} = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  announceMock: vi.fn(),
  roomHasTagMock: vi.fn(() => false),
  addRoomTagMock: vi.fn(async () => undefined),
  removeRoomTagMock: vi.fn(async () => undefined),
  loadSpacesMock: vi.fn(async () => undefined),
  leaveSpaceMock: vi.fn(async () => undefined),
  deleteSpaceMock: vi.fn(async () => undefined)
}))

const spacesRef = ref([
  {
    spaceId: '!space-1:server',
    name: 'Design Team',
    topic: 'Design collaboration space',
    childCount: 5,
    memberCount: 12,
    avatarUrl: undefined
  },
  {
    spaceId: '!space-2:server',
    name: 'Engineering',
    topic: 'Engineering space',
    childCount: 8,
    memberCount: 30,
    avatarUrl: undefined
  }
])

vi.mock('vue-router', () => ({
  useRoute: () => ({ name: 'space', path: '/space', params: {}, query: {} }),
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

vi.mock('@/composables/common/useAriaLive', () => ({
  useAriaLive: () => ({
    announce: announceMock
  })
}))

vi.mock('@/composables/search/useSearchShortcut', () => ({
  triggerGlobalSearch: vi.fn()
}))

vi.mock('@/composables/space', () => ({
  useSpaces: () => ({
    spaces: computed(() => spacesRef.value),
    loading: ref(false),
    load: loadSpacesMock
  })
}))

vi.mock('@/services/matrix/room/MatrixSpaceService', () => ({
  matrixSpaceService: {
    leaveSpace: leaveSpaceMock,
    deleteSpace: deleteSpaceMock
  }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    currentSessionRoomId: ''
  })
}))

vi.mock('@/stores/domains/chat/room', () => ({
  useRoomStore: () => ({
    hasTag: roomHasTagMock,
    addRoomTag: addRoomTagMock,
    removeRoomTag: removeRoomTagMock
  })
}))

describe('SpaceListView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    spacesRef.value = [
      {
        spaceId: '!space-1:server',
        name: 'Design Team',
        topic: 'Design collaboration space',
        childCount: 5,
        memberCount: 12,
        avatarUrl: undefined
      },
      {
        spaceId: '!space-2:server',
        name: 'Engineering',
        topic: 'Engineering space',
        childCount: 8,
        memberCount: 30,
        avatarUrl: undefined
      }
    ]
    roomHasTagMock.mockReturnValue(false)
    loadSpacesMock.mockResolvedValue(undefined)
  })

  it('mounts and loads spaces on init', async () => {
    const wrapper = mount(SpaceListView)
    await flushPromises()

    expect(loadSpacesMock).toHaveBeenCalled()
    expect(wrapper.find('[data-test="space-list-pane"]').exists()).toBe(true)
  })

  it('renders only the space list pane (details pane moved to layout/right)', async () => {
    const wrapper = mount(SpaceListView)
    await flushPromises()

    // 中间栏存在
    expect(wrapper.find('.space-list-pane').exists()).toBe(true)
    // SpaceDetailsPane 不再由 SpaceList 渲染（由 layout/right/index.vue 渲染）
    expect(wrapper.find('.space-details-pane').exists()).toBe(false)
  })

  it('navigates to space details route when clicking a list item', async () => {
    const wrapper = mount(SpaceListView)
    await flushPromises()

    // 点击第一个空间项
    const spaceCards = wrapper.findAllComponents({ name: 'SpaceListItemCard' })
    expect(spaceCards.length).toBeGreaterThan(0)
    await spaceCards[0].trigger('click')
    await flushPromises()

    expect(announceMock).toHaveBeenCalled()
    // 应跳转到 /space/:spaceId 路由（由 useRightView 派生 spaceChildren 视图）
    expect(routerPushMock).toHaveBeenCalled()
    const pushCall = routerPushMock.mock.calls[0][0]
    // buildSpaceRoute 返回 { name: 'space-details', params: { spaceId } }
    expect(pushCall).toMatchObject({ name: 'space-details', params: { spaceId: '!space-1:server' } })
  })

  it('shows the create space route when clicking create button', async () => {
    const wrapper = mount(SpaceListView)
    await flushPromises()

    // 找到底部"创建空间"按钮
    const createBtn = wrapper.find('[data-test="space-list-pane"] .space-list-pane__footer-btn')
    await createBtn.trigger('click')

    expect(routerPushMock).toHaveBeenCalled()
    const pushCall = routerPushMock.mock.calls[0][0]
    expect(pushCall).toMatchObject({ name: 'space-create' })
  })

  it('toggles pin state via room tags', async () => {
    roomHasTagMock.mockReturnValue(false)
    const wrapper = mount(SpaceListView)
    await flushPromises()

    const vm = wrapper.vm as unknown as {
      handlePinSpace: (spaceId: string) => Promise<void>
    }
    await vm.handlePinSpace('!space-1:server')

    expect(addRoomTagMock).toHaveBeenCalledWith('!space-1:server', 'm.favourite')
    expect(showFeedbackMock).toHaveBeenCalledWith('space.pin_space', 'success')
  })

  it('unpins when already pinned', async () => {
    roomHasTagMock.mockReturnValue(true)
    const wrapper = mount(SpaceListView)
    await flushPromises()

    const vm = wrapper.vm as unknown as {
      handlePinSpace: (spaceId: string) => Promise<void>
    }
    await vm.handlePinSpace('!space-1:server')

    expect(removeRoomTagMock).toHaveBeenCalledWith('!space-1:server', 'm.favourite')
    expect(showFeedbackMock).toHaveBeenCalledWith('space.unpin_space', 'success')
  })

  it('derives selectedSpaceId from route params', async () => {
    const wrapper = mount(SpaceListView)
    await flushPromises()

    // 默认路由 /space 无 spaceId 参数
    const vm = wrapper.vm as unknown as { selectedSpaceId: string }
    expect(vm.selectedSpaceId).toBe('')
  })
})
