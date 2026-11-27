import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import SecuritySettings from '../SecuritySettings.vue'
import { MOBILE_SETTINGS_PASSWORD_PATH } from '../settingsRoutes'

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
  loadEncryptionStatusMock,
  exportKeysMock,
  encryptionFlags
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
    loadEncryptionStatusMock: vi.fn().mockResolvedValue(undefined),
    exportKeysMock: vi.fn().mockResolvedValue(''),
    // 导出前需要判断加密是否开启（与桌面端同一判定），默认开启以保留原有用例语义
    encryptionFlags: { enabled: true }
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

vi.mock('@/shared/composables/useLoginFlow', () => ({
  useLoginFlow: () => ({ logout: logoutMock })
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => ({
    userId: '@user:test.com',
    deviceId: 'DEVICE123'
  })
}))

// Helper to mount SecuritySettings with $t global mock (needed for template usage)
function buildStubs(): Record<string, any> {
  return {
    'van-cell': {
      inheritAttrs: true,
      props: ['title', 'label', 'value', 'isLink'],
      template:
        '<div v-bind="$attrs" data-test="van-cell"><span>{{ title }}</span><span>{{ label }}</span><slot name="icon" /><slot name="right-icon" /></div>'
    },
    MobilePrivateChatSection: { template: '<div data-test="private-chat-section" />' }
  }
}

function mountSecuritySettings(extraOpts: Record<string, any> = {}) {
  return mount(SecuritySettings, {
    global: {
      mocks: {
        $t: (key: string) => key
      },
      stubs: { ...buildStubs(), ...(extraOpts.stubs || {}) }
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

// 交叉签名/密钥备份状态与桌面端同源：统一由 encryption store 汇总（不再直连 crypto service）
vi.mock('@/stores/domains/settings/encryption', async () => {
  const { ref } = await import('vue')
  const securityKeyConfigured = ref(false)
  const backupEnabled = ref(false)
  return {
    useEncryptionStore: () => ({
      get encryptionEnabled() {
        return encryptionFlags.enabled
      },
      get securityKeyConfigured() {
        return securityKeyConfigured.value
      },
      get backupEnabled() {
        return backupEnabled.value
      },
      get backupVersion() {
        return ''
      },
      get backupKeyCount() {
        return 0
      },
      loading: false,
      loadEncryptionStatus: () => loadEncryptionStatusMock(),
      loadBackupStatus: vi.fn(),
      markSecurityKeyConfigured: vi.fn()
    })
  }
})

// 导出与下载由 useKeyExport 统一实现（桌面/移动共用），组件只关心结果文案
vi.mock('@/composables/encryption/useKeyExport', async () => {
  const { ref } = await import('vue')
  return {
    useKeyExport: () => ({
      isExporting: ref(false),
      exportKeys: (...args: any[]) => exportKeysMock(...args)
    })
  }
})

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
    loadEncryptionStatusMock.mockResolvedValue(undefined)
    exportKeysMock.mockResolvedValue('')
    encryptionFlags.enabled = true
  })

  it('renders correctly', () => {
    const wrapper = mountSecuritySettings()
    expect(wrapper.html()).not.toBe('')
  })

  it('loads device count on mount', async () => {
    getDevicesMock.mockResolvedValue([{ device_id: 'd1' }, { device_id: 'd2' }])
    mountSecuritySettings()
    await vi.dynamicImportSettled()
    expect(getDevicesMock).toHaveBeenCalled()
  })

  it('loads ignored users count on mount', async () => {
    getIgnoredUsersMock.mockResolvedValue(['@user1:test.com'])
    mountSecuritySettings()
    await vi.dynamicImportSettled()
    expect(getIgnoredUsersMock).toHaveBeenCalled()
  })

  it('loads encryption status from the shared store on mount', async () => {
    mountSecuritySettings()
    await vi.dynamicImportSettled()
    expect(loadEncryptionStatusMock).toHaveBeenCalled()
  })

  it('navigates to devices page', async () => {
    mountSecuritySettings()
    await vi.dynamicImportSettled()
    routerPushMock('/mobile/mobileMy/devices')
    expect(routerPushMock).toHaveBeenCalledWith('/mobile/mobileMy/devices')
  })

  it('navigates to the dedicated password page instead of an in-page dialog', async () => {
    // 修改密码统一走 PasswordSettings（强度校验 + 退出其他设备都在那一页），
    // 安全页只负责跳转，避免两套交互规则漂移。
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const passwordCell = wrapper
      .findAll('[data-test="van-cell"]')
      .find((cell) => cell.text().includes('mobile_security.change_password'))

    expect(passwordCell).toBeDefined()
    await passwordCell!.trigger('click')
    expect(routerPushMock).toHaveBeenCalledWith(MOBILE_SETTINGS_PASSWORD_PATH)
  })

  it('navigates to the dedicated triple-confirm page for deactivate', async () => {
    // 单次确认对话框已移到独立页面（MobileDeactivateAccount.vue）：
    // 注销不可撤销，确认强度要求在 P0 里被明确提高。
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.openDeactivateAccount()
    expect(routerPushMock).toHaveBeenCalledWith('/mobile/mobileMy/deactivateAccount')
  })

  it('no longer deactivates directly from the security page', async () => {
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).handleDeactivate).toBeUndefined()
  })

  it('calls exportKeys on export', async () => {
    exportKeysMock.mockResolvedValue('{"keys":[]}')
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleExportKeys()
    expect(exportKeysMock).toHaveBeenCalled()
  })

  it('shows error when export returns empty content', async () => {
    exportKeysMock.mockResolvedValue('')
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleExportKeys()
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('未开启加密时不触发导出，提示先开启加密（与桌面端同一判定）', async () => {
    encryptionFlags.enabled = false
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleExportKeys()
    expect(exportKeysMock).not.toHaveBeenCalled()
    expect(showToastMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'fail', message: 'setting.security.enable_encryption_first' })
    )
  })

  it('no longer keeps a parallel key-backup setup path', async () => {
    // 旧的口令对话框（matrixCryptoService.setupKeyBackup）已删除：
    // 密钥备份统一走 MobileSecureBackupDialog → useSecureBackupFlow（单一实现）。
    const wrapper = mountSecuritySettings()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    expect(vm.handleSetupBackup).toBeUndefined()
    expect(vm.showBackupDialog).toBeUndefined()
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

/**
 * keep-alive 下的刷新语义。
 *
 * 本页挂在 `MyLayout` 的 RouterView 下，该 RouterView **没有** keep-alive
 * ⇒ 「进二级页再返回」会重新挂载，onMounted 自己会重跑（无需 onActivated）。
 * 但 `MyLayout` 被外层 tab 布局的 keep-alive 缓存
 * ⇒ 「切到别的 Tab 再切回来」是 deactivate/activate，onMounted 不触发，
 * 设备数、已忽略用户数、加密状态都会停在旧值 —— 这才是 onActivated 要覆盖的场景。
 *
 * 两个用例分别钉住两半：首次进入不能双请求，再次激活必须刷新。
 */
function mountInKeepAlive() {
  const Host = defineComponent({
    name: 'SecuritySettingsKeepAliveHost',
    components: { SecuritySettings },
    props: { visible: { type: Boolean, default: true } },
    template: '<KeepAlive><SecuritySettings v-if="visible" /></KeepAlive>'
  })
  return mount(Host, {
    props: { visible: true },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: buildStubs()
    }
  })
}

describe('SecuritySettings keep-alive 刷新', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDevicesMock.mockResolvedValue([])
    getIgnoredUsersMock.mockResolvedValue([])
  })

  it('首次进入只加载一次，activated 不重复请求', async () => {
    mountInKeepAlive()
    await flushPromises()

    // mounted 与 activated 在首次挂载时都会触发，若不做判断这里会是 2
    expect(getDevicesMock).toHaveBeenCalledTimes(1)
    expect(getIgnoredUsersMock).toHaveBeenCalledTimes(1)
  })

  it('切走 Tab 再切回来（activate）时重新加载计数', async () => {
    const wrapper = mountInKeepAlive()
    await flushPromises()
    expect(getDevicesMock).toHaveBeenCalledTimes(1)

    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    await flushPromises()

    expect(getDevicesMock).toHaveBeenCalledTimes(2)
    expect(getIgnoredUsersMock).toHaveBeenCalledTimes(2)
  })
})
