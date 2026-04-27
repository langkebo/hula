import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DeviceManagement from '../DeviceManagement.vue'

const showToastMock = vi.fn()
const showConfirmDialogMock = vi.fn().mockResolvedValue(undefined)

const getDevicesMock = vi.fn().mockResolvedValue([])
const getCurrentDeviceIdMock = vi.fn().mockReturnValue('CURRENT')
const deleteDeviceMock = vi.fn().mockResolvedValue(undefined)
const deleteDevicesMock = vi.fn().mockResolvedValue(undefined)

vi.mock('vant', () => ({
  showToast: (...args: any[]) => showToastMock(...args),
  showConfirmDialog: (...args: any[]) => showConfirmDialogMock(...args)
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color'] }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/services/matrix/user/MatrixDeviceService', () => ({
  matrixDeviceService: {
    getDevices: () => getDevicesMock(),
    getCurrentDeviceId: () => getCurrentDeviceIdMock(),
    deleteDevice: (...args: any[]) => deleteDeviceMock(...args),
    deleteDevices: (...args: any[]) => deleteDevicesMock(...args)
  }
}))

vi.mock('@/services/matrix', () => ({
  matrixDeviceService: {
    getDevices: () => getDevicesMock(),
    getCurrentDeviceId: () => getCurrentDeviceIdMock(),
    deleteDevice: (...args: any[]) => deleteDeviceMock(...args),
    deleteDevices: (...args: any[]) => deleteDevicesMock(...args)
  }
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: {
    name: 'HeaderBar',
    template: '<div />',
    props: ['border', 'isOfficial', 'hiddenRight', 'roomName']
  }
}))

vi.mock('@/router', () => ({
  default: { push: vi.fn(), back: vi.fn() }
}))

describe('DeviceManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getDevicesMock.mockResolvedValue([])
    getCurrentDeviceIdMock.mockReturnValue('CURRENT')
  })

  it('renders correctly', () => {
    const wrapper = mount(DeviceManagement)
    expect(wrapper.html()).toBeTruthy()
  })

  it('loads devices on mount', async () => {
    const _wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    expect(getDevicesMock).toHaveBeenCalled()
    expect(getCurrentDeviceIdMock).toHaveBeenCalled()
  })

  it('identifies current device', async () => {
    getDevicesMock.mockResolvedValue([
      { device_id: 'CURRENT', display_name: 'My Laptop' },
      { device_id: 'OTHER', display_name: 'My Phone' }
    ])
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).isCurrentDevice('CURRENT')).toBe(true)
    expect((wrapper.vm as any).isCurrentDevice('OTHER')).toBe(false)
  })

  it('getDeviceIcon returns mobile for mobile UA', async () => {
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).getDeviceIcon({ last_seen_user_agent: 'Android Mobile' })).toBe('mdi:cellphone')
    expect((wrapper.vm as any).getDeviceIcon({ last_seen_user_agent: 'iPhone Safari' })).toBe('mdi:cellphone')
  })

  it('getDeviceIcon returns tablet for tablet UA', async () => {
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).getDeviceIcon({ last_seen_user_agent: 'iPad Safari' })).toBe('mdi:tablet')
  })

  it('getDeviceIcon returns laptop for desktop UA', async () => {
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).getDeviceIcon({ last_seen_user_agent: 'Mozilla/5.0 Windows' })).toBe('mdi:laptop')
  })

  it('formatDeviceLabel shows IP and date', async () => {
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const result = (wrapper.vm as any).formatDeviceLabel({ last_seen_ip: '192.168.1.1', last_seen_ts: 1700000000000 })
    expect(result).toContain('192.168.1.1')
  })

  it('formatDeviceLabel returns no_info for empty device', async () => {
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).formatDeviceLabel({})).toBeTruthy()
  })

  it('deletes device after confirmation', async () => {
    deleteDeviceMock.mockResolvedValue(undefined)
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleDeleteDevice({ device_id: 'OTHER', display_name: 'Phone' })
    expect(showConfirmDialogMock).toHaveBeenCalled()
    expect(deleteDeviceMock).toHaveBeenCalledWith('OTHER')
  })

  it('shows error on delete failure', async () => {
    deleteDeviceMock.mockRejectedValue(new Error('fail'))
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleDeleteDevice({ device_id: 'OTHER', display_name: 'Phone' })
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('deletes other devices after confirmation', async () => {
    getDevicesMock.mockResolvedValue([
      { device_id: 'CURRENT', display_name: 'Current' },
      { device_id: 'OTHER1', display_name: 'Other 1' },
      { device_id: 'OTHER2', display_name: 'Other 2' }
    ])
    deleteDevicesMock.mockResolvedValue(undefined)
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleDeleteOtherDevices()
    expect(deleteDevicesMock).toHaveBeenCalledWith(['OTHER1', 'OTHER2'])
  })

  it('shows toast when no other devices', async () => {
    getDevicesMock.mockResolvedValue([{ device_id: 'CURRENT', display_name: 'Current' }])
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleDeleteOtherDevices()
    expect(showToastMock).toHaveBeenCalled()
  })
})
