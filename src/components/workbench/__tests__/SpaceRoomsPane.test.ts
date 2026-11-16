import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import SpaceRoomsPane from '../SpaceRoomsPane.vue'

const { showFeedbackMock, loadRoomsMock, removeRoomMock, loadingRef, errorRef } = vi.hoisted(() => {
  // 三态要能被用例直接驱动，故用 hoisted 构造后填入真 ref（见下方 vi.mock 内的引用）
  return {
    showFeedbackMock: vi.fn(),
    loadRoomsMock: vi.fn(async () => undefined),
    removeRoomMock: vi.fn(async () => true),
    loadingRef: { current: null as null | { value: boolean } },
    errorRef: { current: null as null | { value: string | null } }
  }
})

const roomsRef = ref([
  { roomId: '!room-1:server', name: 'General', avatarUrl: undefined },
  { roomId: '!room-2:server', name: 'Random', avatarUrl: undefined }
])

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/composables/space/useSpaceRooms', async () => {
  // 必须在工厂里造 ref：hoisted 阶段拿不到 vue 的 ref
  const loading = ref(false)
  const error = ref<string | null>(null)
  loadingRef.current = loading
  errorRef.current = error
  return {
    useSpaceRooms: () => ({
      rooms: roomsRef,
      loading,
      mutating: ref(false),
      error,
      load: loadRoomsMock,
      removeRoom: removeRoomMock
    })
  }
})

describe('SpaceRoomsPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    roomsRef.value = [
      { roomId: '!room-1:server', name: 'General', avatarUrl: undefined },
      { roomId: '!room-2:server', name: 'Random', avatarUrl: undefined }
    ]
    removeRoomMock.mockResolvedValue(true)
    loadingRef.current!.value = false
    errorRef.current!.value = null
    ;(globalThis.window as unknown as { $dialog: unknown }).$dialog = {
      warning: vi.fn(({ onPositiveClick }: { onPositiveClick?: () => Promise<void> | void }) => {
        if (onPositiveClick) void onPositiveClick()
      })
    }
  })

  it('loads rooms on mount', async () => {
    mount(SpaceRoomsPane, {
      props: { spaceId: '!space-1:server' }
    })
    await flushPromises()
    expect(loadRoomsMock).toHaveBeenCalled()
  })

  it('renders room list from composable', () => {
    const wrapper = mount(SpaceRoomsPane, {
      props: { spaceId: '!space-1:server' }
    })
    const items = wrapper.findAll('[data-test="space-room-item"]')
    expect(items).toHaveLength(2)
    expect(wrapper.text()).toContain('General')
    expect(wrapper.text()).toContain('Random')
  })

  it('emits back when clicking back button', async () => {
    const wrapper = mount(SpaceRoomsPane, {
      props: { spaceId: '!space-1:server' }
    })
    await wrapper.find('[data-test="space-rooms-back"]').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('emits enterRoom when clicking a room', async () => {
    const wrapper = mount(SpaceRoomsPane, {
      props: { spaceId: '!space-1:server' }
    })
    const items = wrapper.findAll('[data-test="space-room-item"]')
    await items[0].trigger('click')
    expect(wrapper.emitted('enterRoom')).toEqual([['!room-1:server']])
  })

  it('hides remove button when canManage=false', () => {
    const wrapper = mount(SpaceRoomsPane, {
      props: { spaceId: '!space-1:server', canManage: false }
    })
    expect(wrapper.find('[data-test="space-room-remove"]').exists()).toBe(false)
  })

  it('shows remove button when canManage=true', () => {
    const wrapper = mount(SpaceRoomsPane, {
      props: { spaceId: '!space-1:server', canManage: true }
    })
    const removeBtns = wrapper.findAll('[data-test="space-room-remove"]')
    expect(removeBtns.length).toBe(2)
  })

  it('removes room with confirm dialog', async () => {
    const wrapper = mount(SpaceRoomsPane, {
      props: { spaceId: '!space-1:server', canManage: true }
    })
    const vm = wrapper.vm as unknown as { handleRemove: (roomId: string) => Promise<void> }
    removeRoomMock.mockClear()
    await vm.handleRemove('!room-1:server')
    await flushPromises()
    expect(removeRoomMock).toHaveBeenCalledWith('!room-1:server')
    expect(showFeedbackMock).toHaveBeenCalledWith('space.remove_room_success', 'success')
  })

  it('shows error when remove fails', async () => {
    removeRoomMock.mockResolvedValueOnce(false)
    const wrapper = mount(SpaceRoomsPane, {
      props: { spaceId: '!space-1:server', canManage: true }
    })
    const vm = wrapper.vm as unknown as { handleRemove: (roomId: string) => Promise<void> }
    await vm.handleRemove('!room-1:server')
    await flushPromises()
    expect(showFeedbackMock).toHaveBeenCalledWith('space.remove_room_failed', 'error')
  })

  it('加载中显示 loading 而不是空态', async () => {
    roomsRef.value = []
    loadingRef.current!.value = true

    const wrapper = mount(SpaceRoomsPane, { props: { spaceId: '!space-1:server' } })
    await flushPromises()

    expect(wrapper.find('[data-test="space-rooms-loading"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="space-rooms-empty"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="space-rooms-error"]').exists()).toBe(false)
  })

  it('加载失败显示错误态 + 重试，而不是「暂无子房间」', async () => {
    roomsRef.value = []
    errorRef.current!.value = 'network down'

    const wrapper = mount(SpaceRoomsPane, { props: { spaceId: '!space-1:server' } })
    await flushPromises()

    expect(wrapper.find('[data-test="space-rooms-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="space-rooms-empty"]').exists()).toBe(false)

    loadRoomsMock.mockClear()
    await wrapper.find('[data-test="space-rooms-error"] [data-testid="error-retry"]').trigger('click')
    await flushPromises()

    expect(loadRoomsMock).toHaveBeenCalledTimes(1)
  })

  it('已有数据时刷新失败不遮住旧列表', async () => {
    errorRef.current!.value = 'network down'

    const wrapper = mount(SpaceRoomsPane, { props: { spaceId: '!space-1:server' } })
    await flushPromises()

    expect(wrapper.findAll('[data-test="space-room-item"]')).toHaveLength(2)
    expect(wrapper.find('[data-test="space-rooms-error"]').exists()).toBe(false)
  })

  it('shows empty state when no rooms', () => {
    roomsRef.value = []
    const wrapper = mount(SpaceRoomsPane, {
      props: { spaceId: '!space-1:server' }
    })
    expect(wrapper.find('[data-test="space-rooms-empty"]').exists()).toBe(true)
  })

  it('shows room count in header', () => {
    const wrapper = mount(SpaceRoomsPane, {
      props: { spaceId: '!space-1:server' }
    })
    expect(wrapper.find('[data-test="space-rooms-header"]').text()).toContain('2')
  })
})
