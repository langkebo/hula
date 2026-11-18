import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MembershipHistoryTab from '../MembershipHistoryTab.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/utils/ComputedTime', () => ({
  formatChatTime: (timestamp: number) => `time:${timestamp}`
}))

const mocks = vi.hoisted(() => ({
  getMembershipEvents: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomReadFacade: { getMembershipEvents: mocks.getMembershipEvents }
}))

const naiveStubs = {
  Spin: { template: '<div class="n-spin" data-testid="membership-history-loading" />', props: ['size'] }
}

const mountTab = async (roomId = '!room:hs') => {
  const wrapper = mount(MembershipHistoryTab, {
    props: { roomId },
    global: { stubs: naiveStubs }
  })
  await flushPromises()
  return wrapper
}

const eventsOk = {
  status: 'ok',
  events: [
    { eventId: '$1', sender: '@a:hs', userId: '@b:hs', membership: 'join', timestamp: 1700000000000 },
    { eventId: '$2', sender: '@a:hs', userId: '@c:hs', membership: 'leave', timestamp: 1700000001000 },
    { eventId: '$3', sender: '@a:hs', userId: '@d:hs', membership: 'weird', timestamp: 1700000002000 }
  ]
}

describe('MembershipHistoryTab — 成员变更历史', () => {
  beforeEach(() => {
    mocks.getMembershipEvents.mockReset()
  })

  it('挂载时按 roomId 与默认上限读取', async () => {
    mocks.getMembershipEvents.mockResolvedValue(eventsOk)
    await mountTab()

    expect(mocks.getMembershipEvents).toHaveBeenCalledWith('!room:hs', 100)
  })

  it('渲染动作标签、目标用户、操作者与时间', async () => {
    mocks.getMembershipEvents.mockResolvedValue(eventsOk)
    const wrapper = await mountTab()

    const rows = wrapper.findAll('[data-testid="membership-history-item"]')
    expect(rows).toHaveLength(3)
    expect(rows[0].find('[data-testid="membership-history-action"]').text()).toBe(
      'room.settings_drawer.membership_action_join'
    )
    expect(rows[0].find('[data-testid="membership-history-user"]').text()).toBe('@b:hs')
    expect(rows[0].find('[data-testid="membership-history-sender"]').text()).toBe('@a:hs')
    expect(rows[0].find('[data-testid="membership-history-time"]').text()).toBe('time:1700000000000')
  })

  it('未知动作原样展示而非隐藏', async () => {
    mocks.getMembershipEvents.mockResolvedValue(eventsOk)
    const wrapper = await mountTab()

    const rows = wrapper.findAll('[data-testid="membership-history-item"]')
    expect(rows[2].find('[data-testid="membership-history-action"]').text()).toBe('weird')
  })

  it('空态展示空提示', async () => {
    mocks.getMembershipEvents.mockResolvedValue({ status: 'empty' })
    const wrapper = await mountTab()

    expect(wrapper.find('[data-testid="membership-history-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="membership-history-item"]').exists()).toBe(false)
  })

  it('服务器不支持时展示 unsupported 局部状态', async () => {
    mocks.getMembershipEvents.mockResolvedValue({ status: 'unsupported' })
    const wrapper = await mountTab()

    expect(wrapper.find('[data-testid="membership-history-unsupported"]').exists()).toBe(true)
  })

  it('读取失败时展示局部失败并可重试', async () => {
    mocks.getMembershipEvents.mockResolvedValueOnce({ status: 'error' })
    const wrapper = await mountTab()

    expect(wrapper.find('[data-testid="membership-history-error"]').exists()).toBe(true)

    mocks.getMembershipEvents.mockResolvedValue(eventsOk)
    await wrapper.find('[data-testid="membership-history-error"] [data-testid="partial-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="membership-history-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="membership-history-item"]')).toHaveLength(3)
  })
})
