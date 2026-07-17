import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

const { flowState, getRoomMessageMock } = vi.hoisted(() => {
  const targetRoomIds = { value: [] as string[] }
  return {
    flowState: {
      targetRoomIds,
      forwarding: { value: false },
      recentRooms: {
        value: [
          { roomId: '!alpha:hs', name: 'Alpha 群', avatar: '' },
          { roomId: '!beta:hs', name: 'Beta 讨论组', avatar: '' }
        ]
      },
      toggleRoom: undefined as unknown,
      forward: undefined as unknown,
      reset: undefined as unknown,
      setSourceEvent: undefined as unknown
    },
    getRoomMessageMock: vi.fn()
  }
})

vi.mock('@/composables/messaging/useMessageForward', () => ({
  useMessageForward: () => {
    const targetRoomIds = ref<string[]>(flowState.targetRoomIds.value)
    const forwarding = ref(flowState.forwarding.value)
    const recentRooms = computed(() => flowState.recentRooms.value)
    const toggleRoom = vi.fn((roomId: string) => {
      targetRoomIds.value = targetRoomIds.value.includes(roomId)
        ? targetRoomIds.value.filter((id) => id !== roomId)
        : [...targetRoomIds.value, roomId]
    })
    const forwardFn = vi.fn(async () => targetRoomIds.value.length)
    const resetFn = vi.fn(() => {
      targetRoomIds.value = []
    })
    const setSourceEventFn = vi.fn()
    flowState.toggleRoom = toggleRoom
    flowState.forward = forwardFn
    flowState.reset = resetFn
    flowState.setSourceEvent = setSourceEventFn
    return {
      targetRoomIds,
      forwarding,
      error: ref(null),
      recentRooms,
      toggleRoom,
      isRoomSelected: (roomId: string) => targetRoomIds.value.includes(roomId),
      setSourceEvent: setSourceEventFn,
      forward: forwardFn,
      reset: resetFn
    }
  }
}))

vi.mock('@/services/matrix/messaging/MatrixMessageService', () => ({
  matrixMessageService: { getRoomMessage: getRoomMessageMock }
}))

import MobileForwardDialog from '../MobileForwardDialog.vue'

const vantStubs = {
  'van-popup': { template: '<div class="van-popup-stub"><slot /></div>', props: ['show'] },
  'van-search': {
    template:
      '<input class="van-search-stub" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue'],
    emits: ['update:modelValue']
  },
  'van-cell': {
    template: '<div class="van-cell-stub" @click="$emit(\'click\')"><slot name="icon" /><slot name="title" /></div>',
    emits: ['click']
  },
  'van-checkbox': { template: '<span class="van-checkbox-stub" :data-checked="modelValue" />', props: ['modelValue'] },
  'van-button': {
    template: '<button class="van-button-stub" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'loading'],
    emits: ['click']
  },
  'van-loading': { template: '<span class="van-loading-stub" />' },
  'van-image': { template: '<img class="van-image-stub" />' },
  SmartVirtualList: {
    props: ['items'],
    template: '<div><div v-for="(item, i) in items" :key="i"><slot :item="item" :index="i" /></div></div>'
  }
}

const mountDialog = () =>
  mount(MobileForwardDialog, {
    props: { visible: true, eventId: '$src', roomId: '!origin:hs' },
    global: { stubs: vantStubs }
  })

const flushAll = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('MobileForwardDialog', () => {
  beforeEach(() => {
    getRoomMessageMock.mockReset()
    getRoomMessageMock.mockResolvedValue({
      getContent: () => ({ body: '这是一条要转发的消息', msgtype: 'm.text' })
    })
  })

  it('打开时加载源消息并展示预览', async () => {
    const wrapper = mountDialog()
    await flushAll()

    expect(getRoomMessageMock).toHaveBeenCalledWith('!origin:hs', '$src')
    expect(wrapper.text()).toContain('这是一条要转发的消息')
  })

  it('渲染最近房间列表并支持按名称过滤', async () => {
    const wrapper = mountDialog()
    await flushAll()

    expect(wrapper.findAll('[data-test="forward-room-item"]')).toHaveLength(2)

    await wrapper.find('.van-search-stub').setValue('beta')
    expect(wrapper.findAll('[data-test="forward-room-item"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Beta 讨论组')
  })

  it('点击房间切换选中，选中数量更新', async () => {
    const wrapper = mountDialog()
    await flushAll()

    await wrapper.find('[data-room-id="!alpha:hs"]').trigger('click')

    expect(flowState.toggleRoom).toHaveBeenCalledWith('!alpha:hs')
  })

  it('未选择房间时发送按钮禁用', async () => {
    const wrapper = mountDialog()
    await flushAll()

    const button = wrapper.find('[data-test="forward-submit-btn"]')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('转发成功后 emit forwarded 与关闭事件', async () => {
    const wrapper = mountDialog()
    await flushAll()

    await wrapper.find('[data-room-id="!alpha:hs"]').trigger('click')
    await wrapper.find('[data-test="forward-submit-btn"]').trigger('click')
    await flushAll()

    expect(flowState.forward).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('forwarded')).toEqual([[['!alpha:hs']]])
    expect(wrapper.emitted('update:visible')?.at(-1)).toEqual([false])
  })

  it('源消息加载失败时预览为空且不崩溃', async () => {
    getRoomMessageMock.mockRejectedValueOnce(new Error('M_NOT_FOUND'))

    const wrapper = mountDialog()
    await flushAll()

    expect(wrapper.find('.mobile-forward-dialog__preview-text').exists()).toBe(false)
  })
})
