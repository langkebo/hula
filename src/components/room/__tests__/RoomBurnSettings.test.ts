import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomBurnSettings from '../RoomBurnSettings.vue'

const refreshBurnSettingsMock = vi.fn().mockResolvedValue(undefined)
const enableBurnMock = vi.fn().mockResolvedValue(true)
const disableBurnMock = vi.fn().mockResolvedValue(true)
const getPendingBurnsMock = vi.fn().mockResolvedValue([])

vi.mock('@/composables/useBurnAfterRead', () => ({
  useBurnAfterRead: () => ({
    isRoomBurnEnabled: () => false,
    getRoomBurnDuration: () => 60,
    refreshBurnSettings: refreshBurnSettingsMock,
    enableBurn: enableBurnMock,
    disableBurn: disableBurnMock,
    getPendingBurns: getPendingBurnsMock
  })
}))

vi.mock('naive-ui', () => ({
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch-stub" />', props: ['value', 'loading'] },
  NSelect: { name: 'NSelect', template: '<div class="n-select-stub" />', props: ['value', 'options'] },
  NSpin: { name: 'NSpin', template: '<div class="n-spin-stub"><slot /></div>' }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params && 'count' in params) {
        return `${params.count}`
      }
      return key
    },
    locale: { value: 'zh-CN' }
  })
}))

describe('RoomBurnSettings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders toggle switch, duration select, and pending count', async () => {
    const wrapper = mount(RoomBurnSettings, {
      props: { roomId: '!room1:server' },
      global: { stubs: ['n-switch', 'n-select', 'n-spin'] }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="room-burn-toggle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="room-burn-duration"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="room-burn-pending-count"]').exists()).toBe(true)
  })

  it('calls enableBurn when toggle turned on', async () => {
    const wrapper = mount(RoomBurnSettings, {
      props: { roomId: '!room1:server' },
      global: { stubs: ['n-switch', 'n-select', 'n-spin'] }
    })
    await flushPromises()
    await wrapper.findComponent({ name: 'NSwitch' }).vm.$emit('update:value', true)
    await flushPromises()
    expect(enableBurnMock).toHaveBeenCalledWith('!room1:server', expect.any(Number))
  })

  it('calls disableBurn when toggle turned off', async () => {
    const wrapper = mount(RoomBurnSettings, {
      props: { roomId: '!room1:server' },
      global: { stubs: ['n-switch', 'n-select', 'n-spin'] }
    })
    await flushPromises()
    await wrapper.findComponent({ name: 'NSwitch' }).vm.$emit('update:value', false)
    await flushPromises()
    expect(disableBurnMock).toHaveBeenCalledWith('!room1:server')
  })

  it('refreshes settings on mount', async () => {
    mount(RoomBurnSettings, {
      props: { roomId: '!room1:server' },
      global: { stubs: ['n-switch', 'n-select', 'n-spin'] }
    })
    await flushPromises()
    expect(refreshBurnSettingsMock).toHaveBeenCalledWith('!room1:server')
  })

  it('shows pending count from getPendingBurns', async () => {
    getPendingBurnsMock.mockResolvedValueOnce([
      { eventId: '$e1', createdAt: 0, deleteAt: 0 },
      { eventId: '$e2', createdAt: 0, deleteAt: 0 }
    ])
    const wrapper = mount(RoomBurnSettings, {
      props: { roomId: '!room1:server' },
      global: { stubs: ['n-switch', 'n-select', 'n-spin'] }
    })
    await flushPromises()
    expect(wrapper.find('[data-testid="room-burn-pending-count"]').text()).toContain('2')
  })
})
