import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentPublicInstance } from 'vue'
import type { DeviceInfo } from '@/services/matrix/user/MatrixAccountService'
import SessionSettings from '../SessionSettings.vue'

const messageSuccessMock = vi.fn()
const messageErrorMock = vi.fn()
const messageWarningMock = vi.fn()
const dialogWarningMock = vi.fn()

const getDevicesMock = vi.fn().mockResolvedValue([])
const setDeviceNameMock = vi.fn().mockResolvedValue(undefined)
const deleteDeviceMock = vi.fn().mockResolvedValue(undefined)
const deleteDevicesMock = vi.fn().mockResolvedValue(undefined)
const translationMap: Record<string, string> = {
  'setting.sessions.current_device': '当前设备',
  'setting.sessions.fetch_failed': '获取设备列表失败',
  'setting.sessions.enter_device_name': '请输入设备名称',
  'setting.sessions.rename_failed': '重命名失败',
  'setting.sessions.logout_device_title': '登出设备',
  'setting.sessions.logout_all_other_devices': '登出所有其他设备',
  'setting.sessions.unknown': '未知'
}

type SessionSettingsVm = ComponentPublicInstance & {
  currentDevice?: DeviceInfo
  otherDevices: DeviceInfo[]
  renameDialogVisible: boolean
  newDeviceName: string
  editingDevice: DeviceInfo | null
  showRenameDialog: (device?: DeviceInfo) => void
  handleRenameDevice: () => Promise<void>
  handleDeleteDevice: (device: DeviceInfo) => void
  handleLogoutAllDevices: () => void
  getDeviceIcon: (device: Partial<DeviceInfo>) => string
  formatDate: (timestamp: number) => string
}

const createDevice = (overrides: Partial<DeviceInfo> = {}): DeviceInfo => ({
  deviceId: 'DEV1',
  userId: '@user:example.com',
  displayName: 'Device 1',
  lastSeenIp: '',
  lastSeenTs: 0,
  lastSeenUserAgent: '',
  ...overrides
})

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

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: {
    getDevices: () => getDevicesMock(),
    setDeviceName: (deviceId: string, displayName: string) => setDeviceNameMock(deviceId, displayName),
    deleteDevice: (deviceId: string) => deleteDeviceMock(deviceId),
    deleteDevices: (deviceIds: string[]) => deleteDevicesMock(deviceIds)
  }
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => ({
    deviceId: 'CURRENT_DEVICE'
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    locale: { value: 'zh-CN' },
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

describe('SessionSettings', () => {
  const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as SessionSettingsVm

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
    mount(SessionSettings)
    await vi.dynamicImportSettled()
    expect(getDevicesMock).toHaveBeenCalled()
  })

  it('shows error when loading devices fails', async () => {
    getDevicesMock.mockRejectedValue(new Error('fail'))
    mount(SessionSettings)
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
    const vm = getVm(wrapper)
    expect(vm.currentDevice?.deviceId).toBe('CURRENT_DEVICE')
    expect(vm.otherDevices).toHaveLength(1)
    expect(vm.otherDevices[0].deviceId).toBe('OTHER_DEVICE')
  })

  it('shows rename dialog', async () => {
    const device = createDevice()
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.showRenameDialog(device)
    expect(vm.renameDialogVisible).toBe(true)
    expect(vm.newDeviceName).toBe('Device 1')
    expect(vm.editingDevice).toEqual(device)
  })

  it('does not show rename dialog for undefined device', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.showRenameDialog(undefined)
    expect(vm.renameDialogVisible).toBe(false)
  })

  it('warns when renaming with empty name', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.editingDevice = createDevice()
    vm.newDeviceName = '  '
    await vm.handleRenameDevice()
    expect(messageWarningMock).toHaveBeenCalledWith('请输入设备名称')
  })

  it('calls setDeviceName on rename', async () => {
    setDeviceNameMock.mockResolvedValue(undefined)
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.editingDevice = createDevice()
    vm.newDeviceName = 'New Name'
    await vm.handleRenameDevice()
    expect(setDeviceNameMock).toHaveBeenCalledWith('DEV1', 'New Name')
  })

  it('shows error on rename failure', async () => {
    setDeviceNameMock.mockRejectedValue(new Error('fail'))
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.editingDevice = createDevice()
    vm.newDeviceName = 'New Name'
    await vm.handleRenameDevice()
    expect(messageErrorMock).toHaveBeenCalledWith('重命名失败')
  })

  it('shows delete device dialog', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.handleDeleteDevice(createDevice())
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
    const vm = getVm(wrapper)
    vm.handleLogoutAllDevices()
    expect(dialogWarningMock).toHaveBeenCalledWith(expect.objectContaining({ title: '登出所有其他设备' }))
  })

  it('does not logout when no other devices', async () => {
    getDevicesMock.mockResolvedValue([{ deviceId: 'CURRENT_DEVICE', displayName: 'Current' }])
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.handleLogoutAllDevices()
    expect(dialogWarningMock).not.toHaveBeenCalled()
  })

  it('getDeviceIcon returns mobile for mobile UA', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    expect(vm.getDeviceIcon({ lastSeenUserAgent: 'Android Mobile' })).toBe('mdi:cellphone')
    expect(vm.getDeviceIcon({ lastSeenUserAgent: 'iPhone Safari' })).toBe('mdi:cellphone')
  })

  it('getDeviceIcon returns tablet for tablet UA', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    expect(getVm(wrapper).getDeviceIcon({ lastSeenUserAgent: 'iPad Safari' })).toBe('mdi:tablet')
  })

  it('getDeviceIcon returns laptop for desktop UA', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    expect(getVm(wrapper).getDeviceIcon({ lastSeenUserAgent: 'Mozilla/5.0 Windows' })).toBe('mdi:laptop')
  })

  it('formatDate returns formatted date', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    const ts = new Date('2025-01-15T10:30:00').getTime()
    const result = getVm(wrapper).formatDate(ts)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('formatDate returns unknown for zero timestamp', async () => {
    const wrapper = mount(SessionSettings)
    await vi.dynamicImportSettled()
    expect(getVm(wrapper).formatDate(0)).toBe('未知')
  })
})
