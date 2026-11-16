import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import SpaceChildrenList from '../SpaceChildrenList.vue'

// === Mocks ===
const { showToastMock, createRoomInSpaceMock, addRoomMock, loadMock } = vi.hoisted(() => ({
  showToastMock: vi.fn(),
  createRoomInSpaceMock: vi.fn(),
  addRoomMock: vi.fn(),
  loadMock: vi.fn()
}))

// 真实 ref 在 mock 工厂调用时（组件 setup 阶段）才被读取，此处不会触发 TDZ
const roomsRef = ref<{ roomId: string; name: string; joined?: boolean; suggested?: boolean }[]>([])
const loadingRef = ref(false)
const mutatingRef = ref(false)

vi.mock('vant', () => ({ showToast: showToastMock }))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

vi.mock('@/composables/space', () => ({
  useSpaceRooms: () => ({
    rooms: roomsRef,
    loading: loadingRef,
    mutating: mutatingRef,
    load: loadMock,
    createRoomInSpace: createRoomInSpaceMock,
    addRoom: addRoomMock
  })
}))

vi.mock('@/mobile/composables/useMobileErrorText', () => ({
  useMobileErrorText: () => ({ resolve: (e: unknown) => String(e) })
}))

vi.mock('@/services/matrix/room/MembershipService', () => ({
  matrixRoomMembershipService: { joinRoom: vi.fn(async () => undefined) }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

vi.mock('@/mobile/components/common/MobileAsyncState.vue', () => ({
  default: {
    name: 'MobileAsyncState',
    props: ['state', 'testId', 'emptyText', 'minHeight'],
    setup:
      (_props: unknown, { slots }: { slots: { default?: () => unknown } }) =>
      () =>
        slots.default?.()
  }
}))

// === Stubs ===
const VanFieldStub = defineComponent({
  name: 'VanField',
  props: { modelValue: { type: String, default: '' }, placeholder: String },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        class: 'van-field-input',
        value: props.modelValue,
        onInput: (e: Event) => emit('update:modelValue', (e.target as HTMLInputElement).value)
      })
  }
})

const VanButtonStub = defineComponent({
  name: 'VanButton',
  props: { loading: Boolean, plain: Boolean, size: String, type: String },
  emits: ['click'],
  setup(_, { slots, emit }) {
    return () => h('button', { class: 'van-button', onClick: () => emit('click') }, [slots.default?.()])
  }
})

const mountList = () =>
  mount(SpaceChildrenList, {
    props: { spaceId: '!space:server' },
    global: {
      stubs: { 'van-field': VanFieldStub, 'van-button': VanButtonStub, 'van-icon': true },
      directives: { clickable: {} }
    }
  })

/** 打开内联新建表单并提交一个房间名 */
const submitNewRoom = async (wrapper: ReturnType<typeof mountList>) => {
  await wrapper.find('[data-testid="space-create-room"]').trigger('click')
  await wrapper.find('.van-field-input').setValue('New Room')
  await wrapper.find('[data-testid="space-room-submit"]').trigger('click')
  await flushPromises()
}

describe('SpaceChildrenList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    roomsRef.value = []
    loadingRef.value = false
    mutatingRef.value = false
    loadMock.mockResolvedValue(undefined)
    addRoomMock.mockResolvedValue(true)
  })

  it('shows a retry action when the created room was not attached to the space', async () => {
    createRoomInSpaceMock.mockResolvedValue({ roomId: '!new-room:server', attached: false })
    const wrapper = mountList()
    await flushPromises()

    await submitNewRoom(wrapper)

    expect(showToastMock).toHaveBeenCalledWith('space.create_room_attach_failed')
    // 房间已建：给出重新加入入口，而不是让用户重新建房
    expect(wrapper.find('[data-testid="space-room-attach"]').exists()).toBe(true)
  })

  it('re-attaches the pending room and clears the retry action when retry succeeds', async () => {
    createRoomInSpaceMock.mockResolvedValue({ roomId: '!new-room:server', attached: false })
    addRoomMock.mockResolvedValue(true)
    const wrapper = mountList()
    await flushPromises()

    await submitNewRoom(wrapper)
    await wrapper.find('[data-testid="space-room-attach-retry"]').trigger('click')
    await flushPromises()

    expect(addRoomMock).toHaveBeenCalledWith('!new-room:server')
    expect(showToastMock).toHaveBeenCalledWith('space.create_room_success')
    expect(wrapper.find('[data-testid="space-room-attach"]').exists()).toBe(false)
  })

  it('keeps the retry action when re-attaching fails', async () => {
    createRoomInSpaceMock.mockResolvedValue({ roomId: '!new-room:server', attached: false })
    addRoomMock.mockResolvedValue(false)
    const wrapper = mountList()
    await flushPromises()

    await submitNewRoom(wrapper)
    await wrapper.find('[data-testid="space-room-attach-retry"]').trigger('click')
    await flushPromises()

    expect(showToastMock).toHaveBeenCalledWith('space.add_room_failed')
    expect(wrapper.find('[data-testid="space-room-attach"]').exists()).toBe(true)
  })
})
