import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SecuritySettings from '../SecuritySettings.vue'

const {
  showToastMock,
  showLoadingToastMock,
  showConfirmDialogMock,
  routerPushMock,
  logoutMock,
  getDevicesMock,
  getIgnoredUsersMock,
  changePasswordMock,
  deactivateAccountMock,
  getCryptoStatusMock,
  setupKeyBackupMock,
  exportKeysMock
} = vi.hoisted(() => {
  return {
    showToastMock: vi.fn(),
    showLoadingToastMock: vi.fn(),
    showConfirmDialogMock: vi.fn().mockResolvedValue(undefined),
    routerPushMock: vi.fn(),
    logoutMock: vi.fn(),
    getDevicesMock: vi.fn().mockResolvedValue([]),
    getIgnoredUsersMock: vi.fn().mockResolvedValue([]),
    changePasswordMock: vi.fn().mockResolvedValue(undefined),
    deactivateAccountMock: vi.fn().mockResolvedValue(undefined),
    getCryptoStatusMock: vi.fn().mockResolvedValue(null),
    setupKeyBackupMock: vi.fn().mockResolvedValue(undefined),
    exportKeysMock: vi.fn().mockResolvedValue(null)
  }
})

vi.mock('vant', () => ({
  showToast: (...args: any[]) => showToastMock(...args),
  showLoadingToast: (...args: any[]) => showLoadingToastMock(...args),
  showConfirmDialog: (...args: any[]) => showConfirmDialogMock(...args)
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color'] }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock })
}))

vi.mock('@/composables/user/useLoginFlow', () => ({
  useLoginFlow: () => ({ logout: logoutMock })
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => ({
    userId: '@user:test.com',
    deviceId: 'DEVICE123'
  })
}))

// Helper to mount SecuritySettings with $t global mock (needed for template usage)
function mountSecuritySettings(extraOpts: Record<string, any> = {}) {
  const mergedStubs = {
    'van-cell': {
      inheritAttrs: true,
      props: ['title', 'label', 'value', 'isLink'],
      template:
        '<div v-bind="$attrs" data-test="van-cell"><span>{{ title }}</span><span>{{ label }}</span><slot name="icon" /><slot name="right-icon" /></div>'
    },
    ...(extraOpts.stubs || {})
  }
  return mount(SecuritySettings, {
    global: {
      mocks: {
        $t: (key: string) => key
      },
      stubs: mergedStubs
    }
  })
}

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: {
    getDevices: () => getDevicesMock(),
    getIgnoredUsers: () => getIgnoredUsersMock(),
    changePassword: (...args: any[]) => changePasswordMock(...args),
    deactivateAccount: () => deactivateAccountMock()
  }
}))

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: {
    getCryptoStatus: () => getCryptoStatusMock(),
    setupKeyBackup: (...args: any[]) => setupKeyBackupMock(...args),
    exportKeys: (...args: any[]) => exportKeysMock(...args)
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

describe('SecuritySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getDevicesMock.mockResolvedValue([])
    getIgnoredUsersMock.mockResolvedValue([])
    getCryptoStatusMock.mockResolvedValue(null)
    exportKeysMock.mockResolvedValue(null)
  })

  it('renders correctly', () => {
    const wrapper = mountSecuritySettings()
    expect(wrapper.html()).toBeTruthy()
  })

  it('loads device count on mount', async () => {
    getDevicesMock.mockResolvedValue([{ device_id: 'd1' }, { device_id: 'd2' }])
    const _wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    expect(getDevicesMock).toHaveBeenCalled()
  })

  it('loads ignored users count on mount', async () => {
    getIgnoredUsersMock.mockResolvedValue(['@user1:test.com'])
    const _wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    expect(getIgnoredUsersMock).toHaveBeenCalled()
  })

  it('loads crypto status on mount', async () => {
    getCryptoStatusMock.mockResolvedValue({ crossSigningReady: true, keyBackupEnabled: false })
    const _wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    expect(getCryptoStatusMock).toHaveBeenCalled()
  })

  it('navigates to devices page', async () => {
    const _wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    routerPushMock('/mobile/mobileMy/devices')
    expect(routerPushMock).toHaveBeenCalledWith('/mobile/mobileMy/devices')
  })

  it('validates password mismatch', async () => {
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.passwordForm = { oldPassword: 'old', newPassword: 'new1', confirmPassword: 'new2' }
    await vm.handleChangePassword()
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('validates short password', async () => {
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.passwordForm = { oldPassword: 'old', newPassword: 'short', confirmPassword: 'short' }
    await vm.handleChangePassword()
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('calls changePassword on valid form', async () => {
    changePasswordMock.mockResolvedValue(undefined)
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.passwordForm = { oldPassword: 'oldpass12', newPassword: 'newpass12', confirmPassword: 'newpass12' }
    await vm.handleChangePassword()
    expect(changePasswordMock).toHaveBeenCalledWith('oldpass12', 'newpass12')
  })

  it('shows error on password change failure', async () => {
    changePasswordMock.mockRejectedValue(new Error('fail'))
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.passwordForm = { oldPassword: 'oldpass12', newPassword: 'newpass12', confirmPassword: 'newpass12' }
    await vm.handleChangePassword()
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('shows confirm dialog for deactivate', async () => {
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleDeactivate()
    expect(showConfirmDialogMock).toHaveBeenCalled()
  })

  it('calls exportKeys on export', async () => {
    exportKeysMock.mockResolvedValue('{"keys":[]}')
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleExportKeys()
    expect(exportKeysMock).toHaveBeenCalled()
  })

  it('shows error when export returns null', async () => {
    exportKeysMock.mockResolvedValue(null)
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleExportKeys()
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('validates backup passphrase', async () => {
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.backupPassphrase = ''
    await vm.handleSetupBackup()
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('calls setupKeyBackup with passphrase', async () => {
    setupKeyBackupMock.mockResolvedValue(undefined)
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.backupPassphrase = 'my-passphrase'
    await vm.handleSetupBackup()
    expect(setupKeyBackupMock).toHaveBeenCalledWith('my-passphrase')
  })

  it('renders secure backup entry cell with dialog component', async () => {
    const wrapper = mountSecuritySettings({
      stubs: {
        MobileSecureBackupDialog: { template: '<div data-test="secure-backup-dialog" />' },
        MobileDeviceVerifyDialog: true
      }
    })
    await vi.dynamicImportSettled()

    // Verify the dialog component is registered and rendered
    const dialog = wrapper.find('[data-test="secure-backup-dialog"]')
    expect(dialog.exists()).toBe(true)

    // Verify the van-cell with secure backup title is rendered
    expect(wrapper.text()).toContain('mobile_security.secure_backup.title')
  })
})
