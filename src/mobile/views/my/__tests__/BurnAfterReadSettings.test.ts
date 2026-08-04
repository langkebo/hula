import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BurnAfterReadSettings from '../BurnAfterReadSettings.vue'

const showToastMock = vi.fn()
const migrateLegacyPreferenceSettingsMock = vi.fn()
const setBurnDefaultEnabledMock = vi.fn()
const setBurnShowCountdownEnabledMock = vi.fn()
const setBurnDefaultDurationMock = vi.fn()

const settingStoreMock = {
  burnDefaultEnabled: false,
  burnDefaultDuration: 60,
  burnShowCountdownEnabled: true,
  migrateLegacyPreferenceSettings: (...args: any[]) => migrateLegacyPreferenceSettingsMock(...args),
  setBurnDefaultEnabled: (...args: any[]) => setBurnDefaultEnabledMock(...args),
  setBurnShowCountdownEnabled: (...args: any[]) => setBurnShowCountdownEnabledMock(...args),
  setBurnDefaultDuration: (...args: any[]) => setBurnDefaultDurationMock(...args)
}

vi.mock('vant', () => ({
  showToast: (...args: any[]) => showToastMock(...args),
  showDialog: vi.fn()
}))

vi.mock('naive-ui', () => ({
  useMessage: () => ({ success: vi.fn() })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color'] }
}))

vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({
    isRoomBurnEnabled: vi.fn().mockReturnValue(false),
    setRoomBurnEnabled: vi.fn()
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => settingStoreMock
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div class="auto-fix"><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: {
    name: 'HeaderBar',
    template: '<div class="header-bar" />',
    props: ['border', 'isOfficial', 'hiddenRight', 'roomName']
  }
}))

describe('BurnAfterReadSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    settingStoreMock.burnDefaultEnabled = false
    settingStoreMock.burnDefaultDuration = 60
    settingStoreMock.burnShowCountdownEnabled = true
  })

  it('renders correctly', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect(wrapper.html()).toBeTruthy()
  })

  it('has globalEnabled false by default', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).globalEnabled).toBe(false)
  })

  it('loads globalEnabled from settingStore getter', () => {
    settingStoreMock.burnDefaultEnabled = true
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).globalEnabled).toBe(true)
  })

  it('loads defaultDuration from settingStore getter', () => {
    settingStoreMock.burnDefaultDuration = 300
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).defaultDuration).toBe(300)
  })

  it('loads showCountdown from settingStore getter', () => {
    settingStoreMock.burnShowCountdownEnabled = false
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).showCountdown).toBe(false)
  })

  it('calls settingStore on global toggle', () => {
    const wrapper = mount(BurnAfterReadSettings)
    ;(wrapper.vm as any).handleGlobalToggle(true)
    expect(setBurnDefaultEnabledMock).toHaveBeenCalledWith(true)
  })

  it('calls settingStore on countdown toggle', () => {
    const wrapper = mount(BurnAfterReadSettings)
    ;(wrapper.vm as any).handleCountdownToggle(false)
    expect(setBurnShowCountdownEnabledMock).toHaveBeenCalledWith(false)
  })

  it('calls settingStore on duration confirm', () => {
    const wrapper = mount(BurnAfterReadSettings)
    ;(wrapper.vm as any).handleDurationConfirm({ selectedValues: [300] })
    expect(setBurnDefaultDurationMock).toHaveBeenCalledWith(300)
    expect((wrapper.vm as any).defaultDuration).toBe(300)
    expect((wrapper.vm as any).showDurationPicker).toBe(false)
  })

  it('formatDuration returns correct format', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).formatDuration(30)).toBe('30秒')
    expect((wrapper.vm as any).formatDuration(60)).toBe('1分钟')
    expect((wrapper.vm as any).formatDuration(300)).toBe('5分钟')
    expect((wrapper.vm as any).formatDuration(3600)).toBe('1小时')
    expect((wrapper.vm as any).formatDuration(86400)).toBe('1天')
  })

  it('loads burn rooms from localStorage', () => {
    localStorage.setItem(
      'tjg-burn-rooms',
      JSON.stringify([{ roomId: 'r1', name: 'Room 1', duration: 60, enabled: true }])
    )
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).burnRooms).toHaveLength(1)
    expect((wrapper.vm as any).burnRooms[0].roomId).toBe('r1')
  })

  it('loads burn stats from localStorage', () => {
    localStorage.setItem('tjg-burn-stats', JSON.stringify({ totalBurned: 42, activeRooms: 3 }))
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).burnStats.totalBurned).toBe(42)
    expect((wrapper.vm as any).burnStats.activeRooms).toBe(3)
  })

  it('saves room toggle', () => {
    localStorage.setItem(
      'tjg-burn-rooms',
      JSON.stringify([{ roomId: 'r1', name: 'Room 1', duration: 60, enabled: true }])
    )
    const wrapper = mount(BurnAfterReadSettings)
    const room = (wrapper.vm as any).burnRooms[0]
    ;(wrapper.vm as any).handleRoomToggle(room, false)
    expect(room.enabled).toBe(false)
    const saved = JSON.parse(localStorage.getItem('tjg-burn-rooms')!)
    expect(saved[0].enabled).toBe(false)
  })

  it('currentDurationLabel returns correct label', () => {
    const wrapper = mount(BurnAfterReadSettings)
    expect((wrapper.vm as any).currentDurationLabel).toBe('1分钟')
    ;(wrapper.vm as any).defaultDuration = 300
    expect((wrapper.vm as any).currentDurationLabel).toBe('5分钟')
  })
})
