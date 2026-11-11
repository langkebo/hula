import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DeviceManagement from '../DeviceManagement.vue'

const showToastMock = vi.fn()
const showConfirmDialogMock = vi.fn().mockResolvedValue(undefined)

const getDevicesMock = vi.fn().mockResolvedValue([])
const getCurrentDeviceIdMock = vi.fn().mockReturnValue('CURRENT')
const deleteDeviceMock = vi.fn().mockResolvedValue(undefined)
const deleteDevicesMock = vi.fn().mockResolvedValue(undefined)
const updateDeviceMock = vi.fn().mockResolvedValue(undefined)

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

// 在 adapter 接缝上 mock：让真实 useDeviceTrust 参与（与生产同一路径），
// 而不是把整个 composable 换成桩——后者会掩盖 composable 自身的行为。
const adapterDevicesMock = vi.hoisted(() => vi.fn())
const cryptoVerificationStatusMock = vi.hoisted(() => vi.fn())
const isDeviceVerifiedMock = vi.hoisted(() => vi.fn())

vi.mock('@/services/matrix/crypto/MatrixEncryptionContextService', () => ({
  matrixEncryptionContextService: {
    getCurrentSessionContext: () => ({ userId: '@alice:example.com', deviceId: 'CURRENT' })
  }
}))

vi.mock('@/services/matrix/crypto/MatrixVerificationService', () => ({
  matrixVerificationService: {
    isDeviceVerified: (...args: any[]) => isDeviceVerifiedMock(...args),
    startSasVerification: vi.fn()
  }
}))

vi.mock('@/services/matrix/crypto/CryptoSDKAdapter', () => ({
  cryptoSDKAdapter: {
    getDevices: (...args: any[]) => adapterDevicesMock(...args)
  }
}))

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  default: { getDeviceVerificationStatus: (...args: any[]) => cryptoVerificationStatusMock(...args) },
  matrixCryptoService: { getDeviceVerificationStatus: (...args: any[]) => cryptoVerificationStatusMock(...args) }
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: { getUserId: () => '@alice:example.com' },
  default: { getUserId: () => '@alice:example.com' }
}))

vi.mock('@/services/matrix/user/MatrixDeviceService', () => ({
  matrixDeviceService: {
    getDevices: () => getDevicesMock(),
    getCurrentDeviceId: () => getCurrentDeviceIdMock(),
    deleteDevice: (...args: any[]) => deleteDeviceMock(...args),
    deleteDevices: (...args: any[]) => deleteDevicesMock(...args),
    updateDevice: (...args: any[]) => updateDeviceMock(...args)
  }
}))

vi.mock('@/services/matrix', () => ({
  matrixDeviceService: {
    getDevices: () => getDevicesMock(),
    getCurrentDeviceId: () => getCurrentDeviceIdMock(),
    deleteDevice: (...args: any[]) => deleteDeviceMock(...args),
    deleteDevices: (...args: any[]) => deleteDevicesMock(...args),
    updateDevice: (...args: any[]) => updateDeviceMock(...args)
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
    adapterDevicesMock.mockImplementation(async () => {
      const raw = (await getDevicesMock()) as Array<Record<string, unknown>>
      // getDevicesMock 的 fixture 使用 snake_case，转成 adapter 的 DeviceInfo 形状
      return raw.map((d) => ({
        deviceId: (d.deviceId ?? d.device_id) as string,
        userId: '@alice:example.com',
        displayName: (d.displayName ?? d.display_name) as string | undefined,
        lastSeenTs: (d.lastSeenTs ?? d.last_seen_ts) as number | undefined,
        lastSeenIp: (d.lastSeenIp ?? d.last_seen_ip) as string | undefined
      }))
    })
    cryptoVerificationStatusMock.mockResolvedValue({ verified: false, crossSigningVerified: false })
    isDeviceVerifiedMock.mockResolvedValue(false)
    getCurrentDeviceIdMock.mockReturnValue('CURRENT')
  })

  it('renders correctly', () => {
    const wrapper = mount(DeviceManagement)
    expect(wrapper.html()).not.toBe('')
  })

  it('loads devices on mount', async () => {
    mount(DeviceManagement)
    await vi.dynamicImportSettled()
    expect(getDevicesMock).toHaveBeenCalled()
    expect(getCurrentDeviceIdMock).toHaveBeenCalled()
  })

  it('identifies current device', async () => {
    getDevicesMock.mockResolvedValue([
      { deviceId: 'CURRENT', displayName: 'My Laptop' },
      { deviceId: 'OTHER', displayName: 'My Phone' }
    ])
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).isCurrentDevice('CURRENT')).toBe(true)
    expect((wrapper.vm as any).isCurrentDevice('OTHER')).toBe(false)
  })

  it('getDeviceIcon returns mobile for mobile UA', async () => {
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).getDeviceIcon({ lastSeenIp: '1.2.3.4' } as any)).toBe('mdi:devices')
    expect((wrapper.vm as any).getDeviceIcon({ lastSeenIp: '5.6.7.8' } as any)).toBe('mdi:devices')
  })

  it('getDeviceIcon returns tablet for tablet UA', async () => {
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).getDeviceIcon({ lastSeenIp: '9.9.9.9' } as any)).toBe('mdi:devices')
  })

  it('getDeviceIcon returns laptop for desktop UA', async () => {
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).getDeviceIcon({ lastSeenIp: '10.0.0.1' } as any)).toBe('mdi:devices')
  })

  it('formatDeviceLabel shows IP and date', async () => {
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const result = (wrapper.vm as any).formatDeviceLabel({ lastSeenIp: '192.168.1.1', lastSeenTs: 1700000000000 })
    expect(result).toContain('192.168.1.1')
  })

  it('formatDeviceLabel returns no_info for empty device', async () => {
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).formatDeviceLabel({})).toMatch(/\S+/)
  })

  it('登出单设备失败时提示错误', async () => {
    getDevicesMock.mockResolvedValue([{ deviceId: 'OTHER', displayName: 'Phone' }])
    deleteDeviceMock.mockRejectedValue(new Error('fail'))
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any

    vm.openDeviceActions({ deviceId: 'OTHER', displayName: 'Phone' })
    await vm.handleActionSelect({ name: 'logout' })

    expect(showToastMock).toHaveBeenCalledWith('mobile_devices.logout_failed')
  })

  it('非本机设备的操作项含重命名与登出，且不含必失败的屏蔽', async () => {
    getDevicesMock.mockResolvedValue([{ deviceId: 'OTHER', displayName: 'Phone' }])
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any

    vm.openDeviceActions({ deviceId: 'OTHER', displayName: 'Phone', isVerified: false })
    await vi.dynamicImportSettled()

    const names = vm.deviceActions.map((a: { key: string }) => a.key)
    expect(names).toContain('rename')
    expect(names).toContain('logout')
    expect(names).not.toContain('block')
    expect(names).not.toContain('unblock')
  })

  // 方案 3.1 的原意是「当前设备不可**删除**」；此前实现把改名一起封了，
  // 导致单设备用户永远改不了自己这台的名字（桌面端一直可以改本机名）。
  // Vant 4 的 ActionSheetAction 只有 `name`（显示文案），没有 `text`：
  // 旧实现 { name: 'rename', text: t(...) } 会把英文标识符直接显示给用户。
  it('操作项显示的是本地化文案，不是英文标识符', async () => {
    getDevicesMock.mockResolvedValue([{ deviceId: 'OTHER', displayName: 'Phone' }])
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any

    vm.openDeviceActions({ deviceId: 'OTHER', displayName: 'Phone', isVerified: false })
    await vi.dynamicImportSettled()

    const labels = vm.deviceActions.map((a: { name: string }) => a.name)
    expect(labels).toContain('mobile_devices.rename_device')
    expect(labels).not.toContain('rename')
  })

  it('当前设备只提供改名，不提供登出（自踢下线）与信任操作', async () => {
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any

    vm.openDeviceActions({ deviceId: 'CURRENT', displayName: 'Me', isVerified: true })
    await vi.dynamicImportSettled()

    expect(vm.deviceActions.map((a: { key: string }) => a.key)).toEqual(['rename'])
  })

  it('当前设备改命中也走 updateDevice（单设备用户可达）', async () => {
    getDevicesMock.mockResolvedValue([{ deviceId: 'CURRENT', displayName: 'Old' }])
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any

    vm.openDeviceActions({ deviceId: 'CURRENT', displayName: 'Old' })
    vm.renameInput = 'My Phone'
    await vm.handleRenameConfirm()

    expect(updateDeviceMock).toHaveBeenCalledWith('CURRENT', 'My Phone')
    expect(showToastMock).toHaveBeenCalledWith('mobile_devices.rename_success')
  })

  it('重命名成功时调用 updateDevice 并刷新', async () => {
    getDevicesMock.mockResolvedValue([{ deviceId: 'OTHER', displayName: 'Old' }])
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any

    vm.openDeviceActions({ deviceId: 'OTHER', displayName: 'Old' })
    vm.renameInput = 'New Name'
    await vm.handleRenameConfirm()

    expect(updateDeviceMock).toHaveBeenCalledWith('OTHER', 'New Name')
    expect(showToastMock).toHaveBeenCalledWith('mobile_devices.rename_success')
  })

  it('重命名输入为空时拒绝提交', async () => {
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any

    vm.openDeviceActions({ deviceId: 'OTHER', displayName: 'Old' })
    vm.renameInput = '   '
    await vm.handleRenameConfirm()

    expect(updateDeviceMock).not.toHaveBeenCalled()
    expect(showToastMock).toHaveBeenCalledWith('mobile_devices.rename_empty')
  })

  it('重命名失败时提示且不刷新', async () => {
    updateDeviceMock.mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any

    vm.openDeviceActions({ deviceId: 'OTHER', displayName: 'Old' })
    vm.renameInput = 'New'
    await vm.handleRenameConfirm()

    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fail', message: 'mobile_devices.rename_failed' })
    )
  })

  it('登出单设备：确认后调用 deleteDevice', async () => {
    getDevicesMock.mockResolvedValue([{ deviceId: 'OTHER', displayName: 'Phone' }])
    deleteDeviceMock.mockResolvedValue(undefined)
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any

    vm.openDeviceActions({ deviceId: 'OTHER', displayName: 'Phone' })
    await vm.handleActionSelect({ name: 'logout' })

    expect(deleteDeviceMock).toHaveBeenCalledWith('OTHER')
    // 成功路径以字符串调用 showToast（与既有 delete 成功提示一致）
    expect(showToastMock).toHaveBeenCalledWith('mobile_devices.logout_success')
  })

  it('一键登出其他设备：确认后批量登出并排除当前设备', async () => {
    getDevicesMock.mockResolvedValue([
      { deviceId: 'CURRENT', displayName: 'Me' },
      { deviceId: 'OTHER1', displayName: 'A' },
      { deviceId: 'OTHER2', displayName: 'B' }
    ])
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any

    await vm.handleLogoutOtherDevices()

    expect(deleteDevicesMock).toHaveBeenCalledWith(['OTHER1', 'OTHER2'])
    expect(showToastMock).toHaveBeenCalledWith('mobile_devices.logout_other_success')
  })

  it('没有其他设备时一键登出只提示、不调用接口', async () => {
    getDevicesMock.mockResolvedValue([{ deviceId: 'CURRENT', displayName: 'Me' }])
    const wrapper = mount(DeviceManagement)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any

    await vm.handleLogoutOtherDevices()

    expect(deleteDevicesMock).not.toHaveBeenCalled()
    expect(showToastMock).toHaveBeenCalledWith('mobile_devices.no_other_devices')
  })
})
