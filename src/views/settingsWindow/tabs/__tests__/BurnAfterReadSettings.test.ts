import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BurnAfterReadSettings from '../BurnAfterReadSettings.vue'

const translationMap: Record<string, string> = {
  'setting.common.cancel': '取消',
  'setting.burn_after_read.global.title': '全局设置',
  'setting.burn_after_read.global.enabled_label': '全局默认开启阅后即焚',
  'setting.burn_after_read.global.enabled_desc': '新私聊默认开启阅后即焚功能',
  'setting.burn_after_read.global.duration_label': '默认焚毁时间',
  'setting.burn_after_read.global.duration_desc': '消息阅后的默认焚毁倒计时',
  'setting.burn_after_read.global.countdown_label': '显示焚毁倒计时',
  'setting.burn_after_read.global.countdown_desc': '在消息上显示焚毁倒计时进度',
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
  'setting.burn_after_read.warning':
    '阅后即焚不能保证对方未截图或保存消息。服务器会在消息到期后删除，但无法控制客户端行为。'
}

const {
  getBurnStatsMock,
  messageSuccessMock,
  messageErrorMock,
  dialogWarningMock,
  setBurnDefaultEnabledMock,
  setBurnDefaultDurationMock,
  setBurnShowCountdownEnabledMock,
  settingStoreMock
} = vi.hoisted(() => ({
  getBurnStatsMock: vi.fn(),
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
    setBurnDefaultEnabled: (...args: unknown[]) => setBurnDefaultEnabledMock(...args),
    setBurnDefaultDuration: (...args: unknown[]) => setBurnDefaultDurationMock(...args),
    setBurnShowCountdownEnabled: (...args: unknown[]) => setBurnShowCountdownEnabledMock(...args)
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
  matrixBurnAfterReadService: { getBurnStats: (...args: unknown[]) => getBurnStatsMock(...args) }
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

const STORAGE_KEY = 'tjg-burn-after-read-settings'

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
    getBurnStatsMock.mockResolvedValue({ totalBurned: 0, totalPending: 0, roomsWithBurnEnabled: 0 })
  })

  it('renders the retained sections, without the removed room list', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect(wrapper.find('.burn-after-read-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('全局设置')
    expect(wrapper.text()).toContain('焚毁统计')
    // 房间列表区块整个移除：它只有这份死 blob 一个写入源，永远显示空
    expect(wrapper.text()).not.toContain('房间级别设置')
    expect(wrapper.find('.room-list').exists()).toBe(false)
    expect(wrapper.find('.room-item').exists()).toBe(false)
  })

  it('shows only the retained global settings', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect(wrapper.text()).toContain('全局默认开启阅后即焚')
    expect(wrapper.text()).toContain('默认焚毁时间')
    expect(wrapper.text()).toContain('显示焚毁倒计时')
    expect(wrapper.text()).not.toContain('已读消息自动开始倒计时')
    expect(wrapper.text()).not.toContain('消息焚毁前发送通知提醒')
    expect(wrapper.text()).not.toContain('消息焚毁完成时播放提示音')
  })

  it('no longer exposes the dead preference refs or the room list state', () => {
    const wrapper = mount(BurnAfterReadSettings)
    const vm = wrapper.vm as any
    expect(vm.autoBurnRead).toBeUndefined()
    expect(vm.burnNotification).toBeUndefined()
    expect(vm.burnSound).toBeUndefined()
    expect(vm.burnRooms).toBeUndefined()
    expect(vm.saveSettings).toBeUndefined()
  })

  it('never writes tjg-burn-after-read-settings when the retained global toggles change', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()

    const vm = wrapper.vm as any
    vm.handleBurnDurationChange(300)
    vm.handleGlobalBurnToggle(false)

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('never writes tjg-burn-after-read-settings when the countdown toggle changes', () => {
    const wrapper = mount(BurnAfterReadSettings)
    const vm = wrapper.vm as any
    vm.handleCountdownToggle()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('ignores the legacy localStorage blob entirely', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        autoBurnRead: false,
        burnSound: true,
        globalBurnEnabled: true,
        globalBurnDuration: 300,
        showBurnCountdown: false,
        burnRooms: [{ roomId: '!room:test', name: 'Test Room', burnEnabled: true, burnDuration: 60 }]
      })
    )
    const wrapper = mount(BurnAfterReadSettings)
    const vm = wrapper.vm as any
    // 全部来自 settingStore，localStorage 中的任何字段都不参与
    expect(vm.globalBurnEnabled).toBe(false)
    expect(vm.globalBurnDuration).toBe(60)
    expect(vm.showBurnCountdown).toBe(true)
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

  it('renders the retained burn statistics', async () => {
    getBurnStatsMock.mockResolvedValue({ totalBurned: 128, totalPending: 3, roomsWithBurnEnabled: 2 })
    const wrapper = mount(BurnAfterReadSettings)
    await flushPromises()
    expect(wrapper.findAll('.stat-value').map((node) => node.text())).toEqual(['128', '3', '2'])
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
    vm.handleCountdownToggle()
    expect(setBurnShowCountdownEnabledMock).toHaveBeenCalledWith(vm.showBurnCountdown)
  })

  it('shows security warning', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect(wrapper.text()).toContain('阅后即焚不能保证对方未截图或保存消息')
  })
})
