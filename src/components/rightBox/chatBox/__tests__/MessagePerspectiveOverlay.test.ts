import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

const { getRoomEventPerspectiveMock } = vi.hoisted(() => ({
  getRoomEventPerspectiveMock: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomReadFacade: {
    getRoomEventPerspective: getRoomEventPerspectiveMock
  }
}))

import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import MessagePerspectiveOverlay from '../MessagePerspectiveOverlay.vue'

const mountOverlay = () => mount(MessagePerspectiveOverlay, { global: { stubs: { teleport: true } } })

const open = async (roomId = '!room:id', eventId = '$event:id') => {
  useMitt.emit(MittEnum.OPEN_EVENT_PERSPECTIVE, { roomId, eventId })
  await flushPromises()
}

describe('MessagePerspectiveOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('打开后调用服务并渲染统计', async () => {
    getRoomEventPerspectiveMock.mockResolvedValue({
      status: 'ok',
      stats: {
        eventCount: 42,
        latestEventId: '$latest:id',
        senderActivity: [
          { userId: '@alice:example.org', count: 10 },
          { userId: '@bob:example.org', count: 2 }
        ],
        eventTypes: [{ type: 'm.room.message', count: 41 }]
      }
    })
    const wrapper = mountOverlay()
    expect(wrapper.find('[data-testid="message-perspective-overlay"]').exists()).toBe(false)

    await open()

    expect(getRoomEventPerspectiveMock).toHaveBeenCalledWith('!room:id', '$event:id')
    expect(wrapper.find('[data-testid="perspective-event-count"]').text()).toBe('42')
    expect(wrapper.find('[data-testid="perspective-senders"]').text()).toContain('@alice:example.org')
    expect(wrapper.find('[data-testid="perspective-types"]').text()).toContain('m.room.message')
  })

  it.each([
    ['unsupported', 'message.event_perspective.unsupported'],
    ['error', 'message.event_perspective.error'],
    ['empty', 'message.event_perspective.empty']
  ] as const)('%s 状态展示说明文案且不渲染统计块', async (status, key) => {
    getRoomEventPerspectiveMock.mockResolvedValue({ status })
    const wrapper = mountOverlay()

    await open()

    expect(wrapper.find('[data-testid="message-perspective-status"]').text()).toBe(key)
    expect(wrapper.find('[data-testid="perspective-event-count"]').exists()).toBe(false)
  })

  it('关闭按钮隐藏浮层', async () => {
    getRoomEventPerspectiveMock.mockResolvedValue({ status: 'empty' })
    const wrapper = mountOverlay()
    await open()

    await wrapper.find('[data-testid="message-perspective-close"]').trigger('click')

    expect(wrapper.find('[data-testid="message-perspective-overlay"]').exists()).toBe(false)
  })

  it('缺少 roomId 或 eventId 时不打开', async () => {
    const wrapper = mountOverlay()

    useMitt.emit(MittEnum.OPEN_EVENT_PERSPECTIVE, { roomId: '!room:id' })
    await flushPromises()

    expect(wrapper.find('[data-testid="message-perspective-overlay"]').exists()).toBe(false)
    expect(getRoomEventPerspectiveMock).not.toHaveBeenCalled()
  })
})
