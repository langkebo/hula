import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomKeyRequestsSection from '../RoomKeyRequestsSection.vue'

const mocks = vi.hoisted(() => ({
  showFeedback: vi.fn(),
  getRoomKeyRequests: vi.fn(),
  fulfillRoomKeyRequest: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: mocks.showFeedback })
}))

vi.mock('@/services/matrix/user/MatrixDeviceService', () => ({
  matrixDeviceService: {
    getRoomKeyRequests: mocks.getRoomKeyRequests,
    fulfillRoomKeyRequest: mocks.fulfillRoomKeyRequest
  }
}))

const NButtonStub = {
  name: 'NButton',
  emits: ['click'],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>'
}

function mountSection() {
  return mount(RoomKeyRequestsSection, {
    global: {
      stubs: { NButton: NButtonStub }
    }
  })
}

describe('RoomKeyRequestsSection', () => {
  beforeEach(() => {
    mocks.showFeedback.mockReset()
    mocks.getRoomKeyRequests.mockReset()
    mocks.fulfillRoomKeyRequest.mockReset()
  })

  it('挂载时拉取并渲染待处理密钥请求', async () => {
    mocks.getRoomKeyRequests.mockResolvedValue([
      { request_id: 'req-1', room_id: '!room:example.org', sender_key: 'sender-key-1' }
    ])

    const wrapper = mountSection()
    await flushPromises()

    expect(mocks.getRoomKeyRequests).toHaveBeenCalledTimes(1)
    expect(wrapper.findAll('[data-testid="room-key-request"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('!room:example.org')
  })

  it('兑现成功后移除条目并给出成功反馈', async () => {
    mocks.getRoomKeyRequests.mockResolvedValue([{ request_id: 'req-1', room_id: '!room:example.org' }])
    mocks.fulfillRoomKeyRequest.mockResolvedValue(true)

    const wrapper = mountSection()
    await flushPromises()

    await wrapper.find('[data-testid="room-key-request-fulfill"]').trigger('click')
    await flushPromises()

    expect(mocks.fulfillRoomKeyRequest).toHaveBeenCalledWith('req-1')
    expect(wrapper.findAll('[data-testid="room-key-request"]')).toHaveLength(0)
    expect(mocks.showFeedback).toHaveBeenCalledWith('setting.encryption.room_key_requests_fulfilled', 'success')
  })

  it('兑现失败时保留条目并给出错误反馈', async () => {
    mocks.getRoomKeyRequests.mockResolvedValue([{ request_id: 'req-1', room_id: '!room:example.org' }])
    mocks.fulfillRoomKeyRequest.mockResolvedValue(false)

    const wrapper = mountSection()
    await flushPromises()

    await wrapper.find('[data-testid="room-key-request-fulfill"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="room-key-request"]')).toHaveLength(1)
    expect(mocks.showFeedback).toHaveBeenCalledWith('setting.encryption.room_key_requests_failed', 'error')
  })

  it('缺少 request_id 的条目被忽略，空列表展示空态', async () => {
    mocks.getRoomKeyRequests.mockResolvedValue([{ room_id: '!room:example.org' }])

    const wrapper = mountSection()
    await flushPromises()

    expect(wrapper.find('[data-testid="room-key-requests-empty"]').exists()).toBe(true)
  })

  it('非 pending 状态（已兑现 / 已取消）不渲染', async () => {
    mocks.getRoomKeyRequests.mockResolvedValue([
      { request_id: 'req-pending', room_id: '!pending:example.org', status: 'pending' },
      { request_id: 'req-fulfilled', room_id: '!fulfilled:example.org', status: 'fulfilled' },
      { request_id: 'req-cancelled', room_id: '!cancelled:example.org', status: 'cancelled' }
    ])

    const wrapper = mountSection()
    await flushPromises()

    const rows = wrapper.findAll('[data-testid="room-key-request"]')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain('!pending:example.org')
  })
})
