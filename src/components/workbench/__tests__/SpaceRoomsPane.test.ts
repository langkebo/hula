import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import SpaceRoomsPane from '../SpaceRoomsPane.vue'

const { showFeedbackMock, loadRoomsMock, removeRoomMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  loadRoomsMock: vi.fn(async () => undefined),
  removeRoomMock: vi.fn(async () => true)
}))

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

vi.mock('@/composables/space/useSpaceRooms', () => ({
  useSpaceRooms: () => ({
    rooms: roomsRef,
    loading: ref(false),
    mutating: ref(false),
    error: ref(null),
    load: loadRoomsMock,
    removeRoom: removeRoomMock
  })
}))

describe('SpaceRoomsPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    roomsRef.value = [
      { roomId: '!room-1:server', name: 'General', avatarUrl: undefined },
      { roomId: '!room-2:server', name: 'Random', avatarUrl: undefined }
    ]
    removeRoomMock.mockResolvedValue(true)
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
