import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeVoiceStats } from '@/services/matrix/media/__tests__/fixtures/voiceStats'
import RoomVoiceStatsPanel from '../RoomVoiceStatsPanel.vue'

const { getRoomVoiceStatsMock } = vi.hoisted(() => ({ getRoomVoiceStatsMock: vi.fn() }))

vi.mock('@/services/matrix/media/MatrixVoiceService', () => ({
  matrixVoiceService: {
    getRoomVoiceStats: getRoomVoiceStatsMock
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

const mountPanel = async (roomId = '!room:hs') => {
  const wrapper = mount(RoomVoiceStatsPanel, { props: { roomId } })
  await flushPromises()
  return wrapper
}

describe('RoomVoiceStatsPanel — VEN-01 房间语音统计', () => {
  beforeEach(() => {
    getRoomVoiceStatsMock.mockReset()
  })

  it('加载成功后展示消息数 / 总时长 / 平均时长', async () => {
    getRoomVoiceStatsMock.mockResolvedValue({ totalMessages: 3, totalDuration: 199, averageDuration: 66 })

    const wrapper = await mountPanel()

    expect(getRoomVoiceStatsMock).toHaveBeenCalledWith('!room:hs')
    expect(wrapper.find('[data-testid="room-voice-stats-data"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('3:19')
    expect(wrapper.text()).toContain('1:06')
  })

  it('零消息时展示空态而非 0 值', async () => {
    getRoomVoiceStatsMock.mockResolvedValue({ totalMessages: 0, totalDuration: 0, averageDuration: 0 })

    const wrapper = await mountPanel()

    expect(wrapper.find('[data-testid="room-voice-stats-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="room-voice-stats-data"]').exists()).toBe(false)
  })

  it('请求失败时展示失败重试，不复用全 0 数据', async () => {
    getRoomVoiceStatsMock.mockRejectedValue(new Error('HTTP 500'))

    const wrapper = await mountPanel()

    expect(wrapper.find('[data-testid="room-voice-stats-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="room-voice-stats-data"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="room-voice-stats-empty"]').exists()).toBe(false)
  })

  it('失败后点击重试可恢复数据', async () => {
    getRoomVoiceStatsMock
      .mockRejectedValueOnce(new Error('HTTP 500'))
      .mockResolvedValueOnce(makeVoiceStats({ totalMessages: 2, totalDuration: 61, averageDuration: 30 }))

    const wrapper = await mountPanel()
    expect(wrapper.find('[data-testid="room-voice-stats-error"]').exists()).toBe(true)

    await wrapper.get('[data-testid="room-voice-stats-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="room-voice-stats-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="room-voice-stats-data"]').exists()).toBe(true)
  })

  it('切换房间时重新拉取统计', async () => {
    getRoomVoiceStatsMock.mockResolvedValue({ totalMessages: 1, totalDuration: 10, averageDuration: 10 })

    const wrapper = await mountPanel()
    await wrapper.setProps({ roomId: '!other:hs' })
    await flushPromises()

    expect(getRoomVoiceStatsMock).toHaveBeenLastCalledWith('!other:hs')
    expect(getRoomVoiceStatsMock).toHaveBeenCalledTimes(2)
  })

  it('roomId 为空时不发请求且展示空态', async () => {
    const wrapper = await mountPanel('')

    expect(getRoomVoiceStatsMock).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="room-voice-stats-empty"]').exists()).toBe(true)
  })
})
