import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SessionSettings from '../SessionSettings.vue'

const messageSuccessMock = vi.fn()
const messageErrorMock = vi.fn()
const messageWarningMock = vi.fn()
const dialogWarningMock = vi.fn()

const getDevicesMock = vi.fn().mockResolvedValue([])
const setDeviceNameMock = vi.fn().mockResolvedValue(undefined)
const deleteDeviceMock = vi.fn().mockResolvedValue(undefined)
const deleteDevicesMock = vi.fn().mockResolvedValue(undefined)

vi.mock('naive-ui', () => ({
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['size', 'type', 'loading', 'disabled'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NSpin: { name: 'NSpin', template: '<div class="n-spin"><slot /></div>', props: ['show'] },
  NEmpty: { name: 'NEmpty', template: '<div class="n-empty" />', props: ['description'] },
  NModal: { name: 'NModal', template: '<div class="n-modal"><slot /></div>', props: ['show'] },
  NForm: { name: 'NForm', template: '<form><slot /></form>' },
  NFormItem: { name: 'NFormItem', template: '<div><slot /></div>', props: ['label'] },
  NInput: { name: 'NInput', template: '<input />', props: ['value', 'placeholder'] },
  useMessage: () => ({ success: messageSuccessMock, error: messageErrorMock, warning: messageWarningMock }),
  useDialog: () => ({ warning: dialogWarningMock })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width'] }
}))

vi.mock('@/services/matrix/MatrixAccountService', () => ({
  matrixAccountService: {
    getDevices: () => getDevicesMock(),
    setDeviceName: (...args: any[]) => setDeviceNameMock(...args),
    deleteDevice: (...args: any[]) => deleteDeviceMock(...args),
    deleteDevices: (...args: any[]) => deleteDevicesMock(...args)
  }
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => ({
    deviceId: 'CURRENT_DEVICE'
  })
}))

describe('SessionSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getDevicesMock.mockResolvedValue([])
  })

  it('renders correctly', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    expect(wrapper.find('.session-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('当前设备')
  })

  it('loads devices on mount', async () => {
    const _wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    expect(getDevicesMock).toHaveBeenCalled()
  })

  it('shows error when loading devices fails', async () => {
    getDevicesMock.mockRejectedValue(new Error('fail'))
    const _wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    expect(messageErrorMock).toHaveBeenCalledWith('获取设备列表失败')
  })

  it('identifies current device', async () => {
    getDevicesMock.mockResolvedValue([
      { deviceId: 'CURRENT_DEVICE', displayName: 'My Laptop' },
      { deviceId: 'OTHER_DEVICE', displayName: 'My Phone' }
    ])
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).currentDevice?.deviceId).toBe('CURRENT_DEVICE')
    expect((wrapper.vm as any).otherDevices).toHaveLength(1)
    expect((wrapper.vm as any).otherDevices[0].deviceId).toBe('OTHER_DEVICE')
  })

  it('shows rename dialog', async () => {
    const device = { deviceId: 'DEV1', displayName: 'Device 1' }
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.showRenameDialog(device)
    expect((wrapper.vm as any).renameDialogVisible).toBe(true)
    expect((wrapper.vm as any).newDeviceName).toBe('Device 1')
    expect((wrapper.vm as any).editingDevice).toEqual(device)
  })

  it('does not show rename dialog for undefined device', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.showRenameDialog(undefined)
    expect((wrapper.vm as any).renameDialogVisible).toBe(false)
  })

  it('warns when renaming with empty name', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.editingDevice = { deviceId: 'DEV1', displayName: 'Device 1' }
    vm.newDeviceName = '  '
    await vm.handleRenameDevice()
    expect(messageWarningMock).toHaveBeenCalledWith('请输入设备名称')
  })

  it('calls setDeviceName on rename', async () => {
    setDeviceNameMock.mockResolvedValue(undefined)
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.editingDevice = { deviceId: 'DEV1', displayName: 'Device 1' }
    vm.newDeviceName = 'New Name'
    await vm.handleRenameDevice()
    expect(setDeviceNameMock).toHaveBeenCalledWith('DEV1', 'New Name')
  })

  it('shows error on rename failure', async () => {
    setDeviceNameMock.mockRejectedValue(new Error('fail'))
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.editingDevice = { deviceId: 'DEV1', displayName: 'Device 1' }
    vm.newDeviceName = 'New Name'
    await vm.handleRenameDevice()
    expect(messageErrorMock).toHaveBeenCalledWith('重命名失败')
  })

  it('shows delete device dialog', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.handleDeleteDevice({ deviceId: 'DEV1', displayName: 'Device 1' })
    expect(dialogWarningMock).toHaveBeenCalledWith(expect.objectContaining({ title: '登出设备' }))
  })

  it('shows logout all devices dialog', async () => {
    getDevicesMock.mockResolvedValue([
      { deviceId: 'CURRENT_DEVICE', displayName: 'Current' },
      { deviceId: 'OTHER1', displayName: 'Other 1' },
      { deviceId: 'OTHER2', displayName: 'Other 2' }
    ])
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.handleLogoutAllDevices()
    expect(dialogWarningMock).toHaveBeenCalledWith(expect.objectContaining({ title: '登出所有其他设备' }))
  })

  it('does not logout when no other devices', async () => {
    getDevicesMock.mockResolvedValue([{ deviceId: 'CURRENT_DEVICE', displayName: 'Current' }])
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.handleLogoutAllDevices()
    expect(dialogWarningMock).not.toHaveBeenCalled()
  })

  it('getDeviceIcon returns mobile for mobile UA', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).getDeviceIcon({ lastSeenUserAgent: 'Android Mobile' })).toBe('mdi:cellphone')
    expect((wrapper.vm as any).getDeviceIcon({ lastSeenUserAgent: 'iPhone Safari' })).toBe('mdi:cellphone')
  })

  it('getDeviceIcon returns tablet for tablet UA', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).getDeviceIcon({ lastSeenUserAgent: 'iPad Safari' })).toBe('mdi:tablet')
  })

  it('getDeviceIcon returns laptop for desktop UA', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).getDeviceIcon({ lastSeenUserAgent: 'Mozilla/5.0 Windows' })).toBe('mdi:laptop')
  })

  it('formatDate returns formatted date', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const ts = new Date('2025-01-15T10:30:00').getTime()
    const result = (wrapper.vm as any).formatDate(ts)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('formatDate returns unknown for zero timestamp', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).formatDate(0)).toBe('未知')
  })
})
