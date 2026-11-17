import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomServerSummaryPanel from '../RoomServerSummaryPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const { getMembersMock, getStateMock, getEphemeralMock } = vi.hoisted(() => ({
  getMembersMock: vi.fn(),
  getStateMock: vi.fn(),
  getEphemeralMock: vi.fn()
}))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomReadFacade: {
    getRoomSummaryMembers: getMembersMock,
    getRoomSummaryState: getStateMock,
    getRoomEphemeral: getEphemeralMock
  }
}))

const naiveStubs = {
  Spin: { template: '<div class="n-spin" />', props: ['size'] },
  Alert: {
    template: '<div class="n-alert"><slot /></div>',
    props: ['type', 'bordered']
  }
}

describe('RoomServerSummaryPanel — 服务端房间摘要', () => {
  beforeEach(() => {
    getMembersMock.mockReset().mockResolvedValue([])
    getStateMock.mockReset().mockResolvedValue([])
    getEphemeralMock.mockReset().mockResolvedValue([])
  })

  const mountPanel = async (roomId = '!room:hs') => {
    const wrapper = mount(RoomServerSummaryPanel, {
      props: { roomId },
      global: { stubs: naiveStubs }
    })
    await flushPromises()
    return wrapper
  }

  it('挂载时并行加载摘要成员、摘要状态与临时事件', async () => {
    await mountPanel()

    expect(getMembersMock).toHaveBeenCalledWith('!room:hs')
    expect(getStateMock).toHaveBeenCalledWith('!room:hs')
    expect(getEphemeralMock).toHaveBeenCalledWith('!room:hs')
  })

  it('渲染成员、Hero 标记、摘要状态与临时事件类型', async () => {
    getMembersMock.mockResolvedValue([
      { user_id: '@alice:hs', display_name: 'Alice', membership: 'join', is_hero: true }
    ])
    getStateMock.mockResolvedValue([{ event_type: 'm.room.name', state_key: '', content: { name: 'Room' } }])
    getEphemeralMock.mockResolvedValue([{ type: 'm.typing', content: { user_ids: ['@alice:hs'] } }])

    const wrapper = await mountPanel()

    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('@alice:hs')
    expect(wrapper.text()).toContain('room.server_summary.hero')
    expect(wrapper.text()).toContain('m.room.name')
    expect(wrapper.text()).toContain('m.typing')
  })

  it('点击摘要状态可展开 JSON 内容，再次点击收起', async () => {
    getStateMock.mockResolvedValue([{ event_type: 'm.room.name', state_key: '', content: { name: 'Room' } }])
    const wrapper = await mountPanel()
    const toggle = wrapper.findAll('.rss-toggle')[0]
    expect(toggle).toBeDefined()

    await toggle?.trigger('click')
    expect(wrapper.find('.rss-json').text()).toContain('"name": "Room"')

    await toggle?.trigger('click')
    expect(wrapper.find('.rss-json').exists()).toBe(false)
  })

  it('空数据时三个区块均展示空态文案', async () => {
    const wrapper = await mountPanel()

    expect(wrapper.findAll('.rss-empty')).toHaveLength(3)
    expect(wrapper.text()).toContain('room.server_summary.empty')
  })

  it('部分接口失败时仍渲染可用区块并展示局部失败信号', async () => {
    getMembersMock.mockRejectedValue(new Error('members down'))
    getStateMock.mockResolvedValue([{ event_type: 'm.room.topic', state_key: '', content: {} }])

    const wrapper = await mountPanel()

    expect(wrapper.find('[data-testid="room-server-summary-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="room-server-summary-partial"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('room.server_summary.partial_failed')
    expect(wrapper.text()).toContain('m.room.topic')
  })

  it('全部接口成功时不展示局部失败信号', async () => {
    const wrapper = await mountPanel()

    expect(wrapper.find('[data-testid="room-server-summary-partial"]').exists()).toBe(false)
  })

  it('三个接口全部失败时只展示整体错误，不再叠加局部失败信号', async () => {
    getMembersMock.mockRejectedValue(new Error('a'))
    getStateMock.mockRejectedValue(new Error('b'))
    getEphemeralMock.mockRejectedValue(new Error('c'))

    const wrapper = await mountPanel()

    expect(wrapper.find('[data-testid="room-server-summary-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="room-server-summary-partial"]').exists()).toBe(false)
  })

  it('点击局部失败信号的重试按钮重新加载全部数据', async () => {
    getMembersMock.mockRejectedValueOnce(new Error('members down'))
    const wrapper = await mountPanel()

    await wrapper.find('[data-testid="room-server-summary-partial"] [data-testid="partial-retry"]').trigger('click')
    await flushPromises()

    expect(getMembersMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="room-server-summary-partial"]').exists()).toBe(false)
  })

  it('三个接口全部失败时展示加载失败提示', async () => {
    getMembersMock.mockRejectedValue(new Error('a'))
    getStateMock.mockRejectedValue(new Error('b'))
    getEphemeralMock.mockRejectedValue(new Error('c'))

    const wrapper = await mountPanel()

    expect(wrapper.find('[data-testid="room-server-summary-error"]').exists()).toBe(true)
  })

  it('roomId 为空时跳过请求', async () => {
    await mountPanel('')

    expect(getMembersMock).not.toHaveBeenCalled()
    expect(getStateMock).not.toHaveBeenCalled()
    expect(getEphemeralMock).not.toHaveBeenCalled()
  })

  it('点击刷新重新加载全部数据', async () => {
    const wrapper = await mountPanel()

    await wrapper.find('[data-testid="room-server-summary-refresh"]').trigger('click')
    await flushPromises()

    expect(getMembersMock).toHaveBeenCalledTimes(2)
    expect(getStateMock).toHaveBeenCalledTimes(2)
    expect(getEphemeralMock).toHaveBeenCalledTimes(2)
  })
})
