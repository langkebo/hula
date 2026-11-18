import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RecentMemberChangesSection from '../RecentMemberChangesSection.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/utils/ComputedTime', () => ({
  formatChatTime: (timestamp: number) => `time:${timestamp}`
}))

const mocks = vi.hoisted(() => ({
  getRecentMemberChanges: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomReadFacade: { getRecentMemberChanges: mocks.getRecentMemberChanges }
}))

const naiveStubs = {
  Spin: { template: '<div class="n-spin" data-testid="recent-members-loading" />', props: ['size'] }
}

const mountSection = async (roomId = '!room:hs') => {
  const wrapper = mount(RecentMemberChangesSection, {
    props: { roomId },
    global: { stubs: naiveStubs }
  })
  await flushPromises()
  return wrapper
}

const change = (userId: string, membership: string, displayName = '', timestamp = 1700000000000, eventId = '') => ({
  userId,
  displayName,
  avatarUrl: '',
  membership,
  eventId,
  sender: userId,
  timestamp
})

const changesOk = {
  status: 'ok',
  changes: [change('@b:hs', 'join', 'Bob', 1700000000000, '$1'), change('@c:hs', 'ban', '', 1700000001000, '$2')]
}

describe('RecentMemberChangesSection — 最近成员变更', () => {
  beforeEach(() => {
    mocks.getRecentMemberChanges.mockReset()
  })

  it('挂载时按 roomId 与 8 条上限读取', async () => {
    mocks.getRecentMemberChanges.mockResolvedValue(changesOk)
    await mountSection()

    expect(mocks.getRecentMemberChanges).toHaveBeenCalledWith('!room:hs', 8)
  })

  it('渲染动作标签、姓名（缺失回退 userId）与时间', async () => {
    mocks.getRecentMemberChanges.mockResolvedValue(changesOk)
    const wrapper = await mountSection()

    const rows = wrapper.findAll('[data-testid="recent-members-item"]')
    expect(rows).toHaveLength(2)
    expect(rows[0].find('[data-testid="recent-members-action"]').text()).toBe(
      'room.settings_drawer.membership_action_join'
    )
    expect(rows[0].find('[data-testid="recent-members-name"]').text()).toBe('Bob')
    expect(rows[0].find('[data-testid="recent-members-time"]').text()).toBe('time:1700000000000')
    expect(rows[1].find('[data-testid="recent-members-action"]').text()).toBe(
      'room.settings_drawer.membership_action_ban'
    )
    expect(rows[1].find('[data-testid="recent-members-name"]').text()).toBe('@c:hs')
  })

  it('未知动作原样展示而非隐藏', async () => {
    mocks.getRecentMemberChanges.mockResolvedValue({ status: 'ok', changes: [change('@d:hs', 'weird')] })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="recent-members-action"]').text()).toBe('weird')
  })

  it('空态展示空提示', async () => {
    mocks.getRecentMemberChanges.mockResolvedValue({ status: 'empty' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="recent-members-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="recent-members-item"]').exists()).toBe(false)
  })

  it('服务器不支持时展示 unsupported 局部状态', async () => {
    mocks.getRecentMemberChanges.mockResolvedValue({ status: 'unsupported' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="recent-members-unsupported"]').exists()).toBe(true)
  })

  it('读取失败时展示局部失败并可重试', async () => {
    mocks.getRecentMemberChanges.mockResolvedValueOnce({ status: 'error' })
    const wrapper = await mountSection()

    expect(wrapper.find('[data-testid="recent-members-error"]').exists()).toBe(true)

    mocks.getRecentMemberChanges.mockResolvedValue(changesOk)
    await wrapper.find('[data-testid="recent-members-error"] [data-testid="partial-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="recent-members-error"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="recent-members-item"]')).toHaveLength(2)
  })

  it('roomId 变化时重新读取', async () => {
    mocks.getRecentMemberChanges.mockResolvedValue(changesOk)
    const wrapper = await mountSection()

    await wrapper.setProps({ roomId: '!other:hs' })
    await flushPromises()

    expect(mocks.getRecentMemberChanges).toHaveBeenLastCalledWith('!other:hs', 8)
  })
})
