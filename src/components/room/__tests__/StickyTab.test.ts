import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getStickyEventsMock,
  setStickyEventsMock,
  clearStickyEventMock,
  hasCapabilityMock,
  resolveMessageInfoMock,
  showFeedbackMock,
  emitMock,
  getRoomMock
} = vi.hoisted(() => ({
  getStickyEventsMock: vi.fn(),
  setStickyEventsMock: vi.fn(),
  clearStickyEventMock: vi.fn(),
  hasCapabilityMock: vi.fn(),
  resolveMessageInfoMock: vi.fn(),
  showFeedbackMock: vi.fn(),
  emitMock: vi.fn(),
  getRoomMock: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomActionFacade: {
    getStickyEvents: getStickyEventsMock,
    setStickyEvents: setStickyEventsMock,
    clearStickyEvent: clearStickyEventMock
  }
}))

vi.mock('@/services/matrix/MatrixCapabilityService', () => ({
  matrixCapabilityService: { hasCapability: hasCapabilityMock }
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: { emit: emitMock, on: vi.fn(), off: vi.fn() }
}))

vi.mock('@/composables/room/resolveMessageInfo', () => ({
  resolveMessageInfo: resolveMessageInfoMock
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getRoom: getRoomMock }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    props: { disabled: Boolean, loading: Boolean, type: String, quaternary: Boolean, ghost: Boolean },
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /><slot name="icon" /></button>'
  },
  NSpin: {
    name: 'NSpin',
    template: '<div><slot /></div>'
  },
  NEmpty: {
    name: 'NEmpty',
    props: { description: String },
    template: '<div data-testid="n-empty">{{ description }}</div>'
  }
}))

import StickyTab from '../settings-tabs/StickyTab.vue'

const ROOM_ID = '!room:server'

function makeEvent(id: string, type: string, body: string) {
  return {
    getId: () => id,
    getSender: () => '@alice:server',
    getContent: () => ({ body }),
    getTs: () => 1000,
    getType: () => type
  }
}

function mountTab() {
  return mount(StickyTab, {
    props: { roomId: ROOM_ID },
    global: { stubs: { 'n-button': false, 'n-spin': false, 'n-empty': false } }
  })
}

describe('StickyTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasCapabilityMock.mockReturnValue(true)
    getStickyEventsMock.mockResolvedValue({ events: [] })
    setStickyEventsMock.mockResolvedValue(undefined)
    clearStickyEventMock.mockResolvedValue(undefined)
    resolveMessageInfoMock.mockResolvedValue(null)
    getRoomMock.mockReturnValue({
      getLiveTimeline: () => ({ getEvents: () => [makeEvent('$m1:server', 'm.room.message', 'recent body')] })
    })
  })

  it('服务端未声明能力时不渲染列表，仅显示只读提示', async () => {
    hasCapabilityMock.mockReturnValue(false)
    const wrapper = mountTab()
    await flushPromises()

    expect(wrapper.find('[data-testid="sticky-unsupported"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="sticky-item"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="recent-item"]')).toHaveLength(0)
    expect(getStickyEventsMock).not.toHaveBeenCalled()
  })

  it('渲染粘性事件并支持按 event_type 取消', async () => {
    getStickyEventsMock.mockResolvedValue({
      events: [{ event_id: '$p1:server', event_type: 'm.room.message', user_id: '@alice:server' }]
    })
    resolveMessageInfoMock.mockResolvedValue({
      eventId: '$p1:server',
      sender: '@alice:server',
      body: 'pinned body',
      timestamp: 1000,
      msgtype: 'm.text'
    })

    const wrapper = mountTab()
    await flushPromises()

    const items = wrapper.findAll('[data-testid="sticky-item"]')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('pinned body')
    expect(items[0].text()).toContain('m.room.message')

    await wrapper.find('[data-testid="sticky-remove"]').trigger('click')
    await flushPromises()

    expect(clearStickyEventMock).toHaveBeenCalledWith(ROOM_ID, 'm.room.message')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.settings_drawer.saved_success', 'success')
  })

  it('最近消息可选择提升为粘性事件', async () => {
    const wrapper = mountTab()
    await flushPromises()

    const recent = wrapper.findAll('[data-testid="recent-item"]')
    expect(recent).toHaveLength(1)
    expect(recent[0].text()).toContain('recent body')

    await wrapper.find('[data-testid="recent-promote"]').trigger('click')
    await flushPromises()

    expect(setStickyEventsMock).toHaveBeenCalledWith(ROOM_ID, {
      events: [{ event_type: 'm.room.message', event_id: '$m1:server' }]
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('room.settings_drawer.saved_success', 'success')
  })

  it('取消失败时提示错误', async () => {
    getStickyEventsMock.mockResolvedValue({
      events: [{ event_id: '$p1:server', event_type: 'm.room.message', user_id: '@alice:server' }]
    })
    resolveMessageInfoMock.mockResolvedValue({
      eventId: '$p1:server',
      sender: '@alice:server',
      body: 'pinned body',
      timestamp: 1000,
      msgtype: 'm.text'
    })
    clearStickyEventMock.mockRejectedValueOnce(new Error('boom'))

    const wrapper = mountTab()
    await flushPromises()

    await wrapper.find('[data-testid="sticky-remove"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.settings_drawer.saved_failed', 'error')
  })
})
