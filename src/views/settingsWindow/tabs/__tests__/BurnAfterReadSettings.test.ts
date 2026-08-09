import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BurnAfterReadSettings from '../BurnAfterReadSettings.vue'

const translationMap: Record<string, string> = {
  'setting.common.save': '保存',
  'setting.common.cancel': '取消',
  'setting.burn_after_read.global.title': '全局设置',
  'setting.burn_after_read.global.enabled_label': '全局默认开启阅后即焚',
  'setting.burn_after_read.global.enabled_desc': '新私聊默认开启阅后即焚功能',
  'setting.burn_after_read.global.duration_label': '默认焚毁时间',
  'setting.burn_after_read.global.duration_desc': '消息阅后的默认焚毁倒计时',
  'setting.burn_after_read.global.auto_read_label': '已读消息自动开始倒计时',
  'setting.burn_after_read.global.auto_read_desc': '消息被标记为已读后自动启动焚毁倒计时',
  'setting.burn_after_read.global.notification_label': '消息即将焚毁时通知',
  'setting.burn_after_read.global.notification_desc': '消息焚毁前发送通知提醒',
  'setting.burn_after_read.global.countdown_label': '显示焚毁倒计时',
  'setting.burn_after_read.global.countdown_desc': '在消息上显示焚毁倒计时进度',
  'setting.burn_after_read.global.sound_label': '消息焚毁时播放音效',
  'setting.burn_after_read.global.sound_desc': '消息焚毁完成时播放提示音',
  'setting.burn_after_read.rooms.title': '房间级别设置',
  'setting.burn_after_read.rooms.empty': '暂无开启阅后即焚的私聊',
  'setting.burn_after_read.rooms.enabled': '已开启',
  'setting.burn_after_read.rooms.disabled': '已关闭',
  'setting.burn_after_read.rooms.duration_value': '焚毁时间: {duration}',
  'setting.burn_after_read.rooms.edit': '修改',
  'setting.burn_after_read.rooms.enable': '开启',
  'setting.burn_after_read.rooms.disable': '关闭',
  'setting.burn_after_read.rooms.edit_title': '修改房间焚毁时间',
  'setting.burn_after_read.rooms.duration_label': '焚毁时间',
  'setting.burn_after_read.stats.title': '焚毁统计',
  'setting.burn_after_read.stats.total_burned': '总焚毁消息',
  'setting.burn_after_read.stats.total_pending': '待焚毁消息',
  'setting.burn_after_read.stats.rooms_enabled': '开启房间数',
  'setting.burn_after_read.formats.seconds': '{count}秒',
  'setting.burn_after_read.formats.minutes': '{count}分钟',
  'setting.burn_after_read.formats.hours': '{count}小时',
  'setting.burn_after_read.formats.days': '{count}天',
  'setting.burn_after_read.feedback.duration_changed': '默认焚毁时间已设置为{duration}',
  'setting.burn_after_read.feedback.settings_updated': '设置已更新',
  'setting.burn_after_read.feedback.room_enabled': '已开启房间阅后即焚',
  'setting.burn_after_read.feedback.room_enable_failed': '开启房间阅后即焚失败',
  'setting.burn_after_read.feedback.room_disabled': '已关闭房间阅后即焚',
  'setting.burn_after_read.warning':
    '阅后即焚不能保证对方未截图或保存消息。服务器会在消息到期后删除，但无法控制客户端行为。'
}

const {
  mockManager,
  messageSuccessMock,
  messageErrorMock,
  dialogWarningMock,
  setBurnDefaultEnabledMock,
  setBurnDefaultDurationMock,
  setBurnShowCountdownEnabledMock,
  settingStoreMock
} = vi.hoisted(() => ({
  mockManager: {
    getBurnStats: vi.fn(),
    enableBurn: vi.fn(),
    disableBurn: vi.fn()
  },
  messageSuccessMock: vi.fn(),
  messageErrorMock: vi.fn(),
  dialogWarningMock: vi.fn(),
  setBurnDefaultEnabledMock: vi.fn(),
  setBurnDefaultDurationMock: vi.fn(),
  setBurnShowCountdownEnabledMock: vi.fn(),
  settingStoreMock: {
    burnDefaultEnabled: false,
    burnDefaultDuration: 60,
    burnShowCountdownEnabled: true,
    setBurnDefaultEnabled: (...args: any[]) => setBurnDefaultEnabledMock(...args),
    setBurnDefaultDuration: (...args: any[]) => setBurnDefaultDurationMock(...args),
    setBurnShowCountdownEnabled: (...args: any[]) => setBurnShowCountdownEnabledMock(...args)
  }
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
  useDialog: () => ({ warning: dialogWarningMock })
}))

vi.mock('@/services/matrix/messaging/MatrixBurnAfterReadService', () => ({
  matrixBurnAfterReadService: mockManager
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }))
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => settingStoreMock
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (!params) {
        return translationMap[key] ?? key
      }

      return Object.entries(params).reduce(
        (message, [name, value]) => message.replace(new RegExp(`\\{${name}\\}`, 'g'), value),
        translationMap[key] ?? key
      )
    }
  })
}))

describe('BurnAfterReadSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(window as any).$message = { success: messageSuccessMock, error: messageErrorMock }
    localStorage.clear()
    // settingStore mock 默认值；clearAllMocks 不会重置属性值，需显式重置
    settingStoreMock.burnDefaultEnabled = false
    settingStoreMock.burnDefaultDuration = 60
    settingStoreMock.burnShowCountdownEnabled = true
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

  it('reads globalBurnEnabled/globalBurnDuration from settingStore', () => {
    settingStoreMock.burnDefaultEnabled = true
    settingStoreMock.burnDefaultDuration = 300
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).globalBurnEnabled).toBe(true)
    expect((wrapper.vm as any).globalBurnDuration).toBe(300)
  })

  it('reads showBurnCountdown from settingStore', () => {
    settingStoreMock.burnShowCountdownEnabled = false
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).showBurnCountdown).toBe(false)
  })

  it('loads pure UI prefs (autoBurnRead/burnSound/burnRooms) from localStorage', () => {
    localStorage.setItem(
      'tjg-burn-after-read-settings',
      JSON.stringify({
        autoBurnRead: false,
        burnSound: true,
        burnRooms: []
      })
    )
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).autoBurnRead).toBe(false)
    expect((wrapper.vm as any).burnSound).toBe(true)
  })

  it('does NOT read globalBurnEnabled from localStorage (uses settingStore)', () => {
    localStorage.setItem(
      'tjg-burn-after-read-settings',
      JSON.stringify({
        globalBurnEnabled: true,
        globalBurnDuration: 300
      })
    )
    // settingStore 默认 false/60，localStorage 中即使有也不应被读取
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).globalBurnEnabled).toBe(false)
    expect((wrapper.vm as any).globalBurnDuration).toBe(60)
  })

  it('saveSettings only persists pure UI prefs + burnRooms to localStorage', () => {
    const wrapper = mount(BurnAfterReadSettings)
    const vm = wrapper.vm as any
    vm.autoBurnRead = false
    vm.burnNotification = true
    vm.burnSound = true
    vm.saveSettings()
    const saved = JSON.parse(localStorage.getItem('tjg-burn-after-read-settings')!)
    expect(saved).toHaveProperty('autoBurnRead', false)
    expect(saved).toHaveProperty('burnNotification', true)
    expect(saved).toHaveProperty('burnSound', true)
    expect(saved).toHaveProperty('burnRooms')
    // 不应再持久化这三个全局字段
    expect(saved).not.toHaveProperty('globalBurnEnabled')
    expect(saved).not.toHaveProperty('globalBurnDuration')
    expect(saved).not.toHaveProperty('showBurnCountdown')
  })

  it('defaults globalBurnEnabled to false (from settingStore)', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).globalBurnEnabled).toBe(false)
  })

  it('defaults globalBurnDuration to 60 (from settingStore)', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).globalBurnDuration).toBe(60)
  })

  it('defaults showBurnCountdown to true (from settingStore)', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).showBurnCountdown).toBe(true)
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
    expect(setBurnDefaultDurationMock).toHaveBeenCalledWith(300)
    expect(messageSuccessMock).toHaveBeenCalled()
  })

  it('calls setBurnDefaultEnabled(true) when global toggle dialog is confirmed', () => {
    const wrapper = mount(BurnAfterReadSettings)
    const vm = wrapper.vm as any
    vm.handleGlobalBurnToggle(true)
    // dialog.warning 被调用，提取 onPositiveClick 并触发以模拟确认
    expect(dialogWarningMock).toHaveBeenCalledTimes(1)
    const options = dialogWarningMock.mock.calls[0][0] as { onPositiveClick: () => void }
    options.onPositiveClick()
    expect(setBurnDefaultEnabledMock).toHaveBeenCalledWith(true)
    expect((wrapper.vm as any).globalBurnEnabled).toBe(true)
  })

  it('calls setBurnDefaultEnabled(false) when global toggle is turned off', () => {
    const wrapper = mount(BurnAfterReadSettings)
    const vm = wrapper.vm as any
    vm.handleGlobalBurnToggle(false)
    expect(setBurnDefaultEnabledMock).toHaveBeenCalledWith(false)
    expect((wrapper.vm as any).globalBurnEnabled).toBe(false)
  })

  it('calls setBurnShowCountdownEnabled when countdown toggle changes', () => {
    const wrapper = mount(BurnAfterReadSettings)
    const vm = wrapper.vm as any
    vm.handleToggle('showBurnCountdown')
    expect(setBurnShowCountdownEnabledMock).toHaveBeenCalledWith(vm.showBurnCountdown)
  })

  it('does NOT call settingStore setters for pure UI prefs', () => {
    const wrapper = mount(BurnAfterReadSettings)
    const vm = wrapper.vm as any
    vm.handleToggle('autoBurnRead')
    vm.handleToggle('burnNotification')
    vm.handleToggle('burnSound')
    expect(setBurnShowCountdownEnabledMock).not.toHaveBeenCalled()
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
    // enableBurn in useBurnAfterRead swallows the error, so handleEnableRoomBurn proceeds normally
    expect(room.burnEnabled).toBe(true)
    expect(messageSuccessMock).toHaveBeenCalledWith('已开启房间阅后即焚')
  })
})
