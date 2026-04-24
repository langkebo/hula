import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BurnAfterReadSettings from '../BurnAfterReadSettings.vue'

const { mockManager, messageSuccessMock, messageErrorMock } = vi.hoisted(() => ({
  mockManager: {
    getBurnStats: vi.fn(),
    enableBurn: vi.fn(),
    disableBurn: vi.fn()
  },
  messageSuccessMock: vi.fn(),
  messageErrorMock: vi.fn()
}))

vi.mock('naive-ui', () => ({
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NSelect: { name: 'NSelect', template: '<div class="n-select" />', props: ['value', 'options'] },
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['size', 'type'] },
  NSpin: { name: 'NSpin', template: '<div><slot /></div>', props: ['show'] },
  NTag: { name: 'NTag', template: '<span><slot /></span>', props: ['type', 'size'] },
  NAlert: { name: 'NAlert', template: '<div><slot /></div>', props: ['type'] },
  NModal: { name: 'NModal', template: '<div v-if="show"><slot /></div>', props: ['show'] },
  NForm: { name: 'NForm', template: '<form><slot /></form>' },
  NFormItem: { name: 'NFormItem', template: '<div><slot /></div>', props: ['label'] },
  useMessage: () => ({ success: messageSuccessMock, error: messageErrorMock }),
  useDialog: () => ({ warning: vi.fn() })
}))

vi.mock('@/services/matrix', () => ({
  matrixBurnAfterReadService: mockManager
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({ error: vi.fn() }))
}))

describe('BurnAfterReadSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockManager.getBurnStats.mockResolvedValue({ totalBurned: 128, pendingBurns: 3, activeRooms: 2 })
  })

  it('renders correctly', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect(wrapper.find('.burn-after-read-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('全局设置')
    expect(wrapper.text()).toContain('房间级别设置')
    expect(wrapper.text()).toContain('焚毁统计')
  })

  it('shows all global settings', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect(wrapper.text()).toContain('全局默认开启阅后即焚')
    expect(wrapper.text()).toContain('默认焚毁时间')
    expect(wrapper.text()).toContain('已读消息自动开始倒计时')
    expect(wrapper.text()).toContain('显示焚毁倒计时')
  })

  it('loads settings from localStorage', () => {
    localStorage.setItem(
      'hula-burn-after-read-settings',
      JSON.stringify({
        globalBurnEnabled: true,
        globalBurnDuration: 300,
        autoBurnRead: false,
        burnSound: true,
        burnRooms: []
      })
    )
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).globalBurnEnabled).toBe(true)
    expect((wrapper.vm as any).globalBurnDuration).toBe(300)
    expect((wrapper.vm as any).autoBurnRead).toBe(false)
    expect((wrapper.vm as any).burnSound).toBe(true)
  })

  it('saves settings to localStorage', () => {
    const wrapper = mount(BurnAfterReadSettings)
    const vm = wrapper.vm as any
    vm.globalBurnEnabled = true
    vm.saveSettings()
    const saved = JSON.parse(localStorage.getItem('hula-burn-after-read-settings')!)
    expect(saved.globalBurnEnabled).toBe(true)
  })

  it('defaults globalBurnEnabled to false', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).globalBurnEnabled).toBe(false)
  })

  it('defaults globalBurnDuration to 60', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).globalBurnDuration).toBe(60)
  })

  it('formatDuration works correctly', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).formatDuration(30)).toBe('30秒')
    expect((wrapper.vm as any).formatDuration(60)).toBe('1分钟')
    expect((wrapper.vm as any).formatDuration(300)).toBe('5分钟')
    expect((wrapper.vm as any).formatDuration(3600)).toBe('1小时')
    expect((wrapper.vm as any).formatDuration(86400)).toBe('1天')
  })

  it('handles burn duration change', () => {
    const wrapper = mount(BurnAfterReadSettings)
    const vm = wrapper.vm as any
    vm.handleBurnDurationChange(300)
    expect((wrapper.vm as any).globalBurnDuration).toBe(300)
    expect(messageSuccessMock).toHaveBeenCalled()
  })

  it('shows security warning', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect(wrapper.text()).toContain('阅后即焚不能保证对方未截图或保存消息')
  })

  it('enables room burn', async () => {
    mockManager.enableBurn.mockResolvedValue({ enabled: true, burn_after_ms: 60000 })
    const wrapper = mount(BurnAfterReadSettings)
    const room = { roomId: '!room:test', name: 'Test Room', burnEnabled: false, burnDuration: 60 }
    const vm = wrapper.vm as any
    await vm.handleEnableRoomBurn(room)
    expect(mockManager.enableBurn).toHaveBeenCalledWith('!room:test', 60000)
    expect(room.burnEnabled).toBe(true)
    expect(messageSuccessMock).toHaveBeenCalledWith('已开启房间阅后即焚')
  })

  it('disables room burn', async () => {
    mockManager.disableBurn.mockResolvedValue({ enabled: false })
    const wrapper = mount(BurnAfterReadSettings)
    const room = { roomId: '!room:test', name: 'Test Room', burnEnabled: true, burnDuration: 60 }
    const vm = wrapper.vm as any
    await vm.handleDisableRoomBurn(room)
    expect(mockManager.disableBurn).toHaveBeenCalledWith('!room:test')
    expect(room.burnEnabled).toBe(false)
    expect(messageSuccessMock).toHaveBeenCalledWith('已关闭房间阅后即焚')
  })

  it('handles service errors gracefully', async () => {
    mockManager.enableBurn.mockRejectedValue(new Error('network error'))
    const wrapper = mount(BurnAfterReadSettings)
    const room = { roomId: '!room:test', name: 'Test Room', burnEnabled: false, burnDuration: 60 }
    const vm = wrapper.vm as any
    await vm.handleEnableRoomBurn(room)
    expect(messageErrorMock).toHaveBeenCalledWith('开启房间阅后即焚失败')
  })
})
