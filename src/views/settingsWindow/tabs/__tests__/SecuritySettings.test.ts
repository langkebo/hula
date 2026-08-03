import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentPublicInstance } from 'vue'
import SecuritySettings from '../SecuritySettings.vue'

const {
  messageSuccessMock,
  messageWarningMock,
  messageErrorMock,
  dialogWarningMock,
  getIgnoredUsersMock,
  setIgnoredUsersMock,
  isEncryptionAvailableMock,
  getKeyBackupInfoMock,
  isSecretChatConfiguredMock,
  setSecretChatPasswordMock,
  clearSecretChatPasswordMock,
  setSecretChatEnabledMock,
  setSecretChatHideSessionsMock,
  setSecretChatAutoLockMock,
  setSecretChatLockTimeoutMock,
  translationMap
} = vi.hoisted(() => {
  const messageSuccessMock = vi.fn()
  const messageWarningMock = vi.fn()
  const messageErrorMock = vi.fn()
  const dialogWarningMock = vi.fn()

  const getIgnoredUsersMock = vi.fn().mockResolvedValue([])
  const setIgnoredUsersMock = vi.fn().mockResolvedValue(undefined)
  const isEncryptionAvailableMock = vi.fn().mockResolvedValue(false)
  const getKeyBackupInfoMock = vi.fn().mockResolvedValue(null)

  const isSecretChatConfiguredMock = vi.fn().mockReturnValue(false)
  const setSecretChatPasswordMock = vi.fn()
  const clearSecretChatPasswordMock = vi.fn()
  const setSecretChatEnabledMock = vi.fn()
  const setSecretChatHideSessionsMock = vi.fn()
  const setSecretChatAutoLockMock = vi.fn()
  const setSecretChatLockTimeoutMock = vi.fn()
  const translationMap: Record<string, string> = {
    'setting.security.encryption_status': '加密状态',
    'setting.security.encryption_disabled_title': '端到端加密未启用',
    'setting.security.user_already_blocked': '该用户已在屏蔽列表中',
    'setting.private_chat.clear_confirm_title': '确认清除',
    'setting.private_chat.password_mismatch': '两次输入的密码不一致',
    'setting.private_chat.password_too_short': '密码长度不能少于4位'
  }
  return {
    messageSuccessMock,
    messageWarningMock,
    messageErrorMock,
    dialogWarningMock,
    getIgnoredUsersMock,
    setIgnoredUsersMock,
    isEncryptionAvailableMock,
    getKeyBackupInfoMock,
    isSecretChatConfiguredMock,
    setSecretChatPasswordMock,
    clearSecretChatPasswordMock,
    setSecretChatEnabledMock,
    setSecretChatHideSessionsMock,
    setSecretChatAutoLockMock,
    setSecretChatLockTimeoutMock,
    translationMap
  }
})

type SecuritySettingsVm = ComponentPublicInstance & {
  encryptionEnabled: boolean
  blockedUsers: string[]
  inviteBlocklist: string[]
  inviteAllowlist: string[]
  showOnlineStatus: boolean
  showTypingStatus: boolean
  sendReadReceipts: boolean
  newBlockedUser: string
  newBlocklistUser: string
  secretChatEnabled: boolean
  secretChatHideSessions: boolean
  secretChatAutoLock: boolean
  secretChatLockTimeout: number
  secretChatForm: {
    password: string
    confirmPassword: string
  }
  handleOnlineStatusChange: (value: boolean) => void
  handleTypingStatusChange: (value: boolean) => void
  handleAddBlocked: () => void
  handleUnblock: (userId: string) => void
  handleAddInviteBlocklist: () => void
  handleRemoveInviteAllowlist: (userId: string) => void
  handleClearSecretChat: () => void
  handleSaveSecretChat: () => Promise<void>
}

vi.mock('naive-ui', () => ({
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['size', 'type', 'loading'] },
  NCard: { template: '<div><slot /></div>' },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NSpin: { name: 'NSpin', template: '<div class="n-spin"><slot /></div>', props: ['show'] },
  NEmpty: { name: 'NEmpty', template: '<div class="n-empty" />', props: ['description'] },
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'] },
  NModal: { name: 'NModal', template: '<div class="n-modal"><slot /></div>', props: ['show'] },
  NForm: { name: 'NForm', template: '<form><slot /></form>', props: ['model', 'rules'] },
  NFormItem: { name: 'NFormItem', template: '<div><slot /></div>', props: ['path', 'label'] },
  NInput: { name: 'NInput', template: '<input />', props: ['value', 'type', 'placeholder'] },
  NAlert: { name: 'NAlert', template: '<div class="n-alert"><slot /></div>', props: ['type', 'showIcon'] },
  useMessage: () => ({ success: messageSuccessMock, warning: messageWarningMock, error: messageErrorMock }),
  useDialog: () => ({ warning: dialogWarningMock })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width'] }
}))

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: {
    getIgnoredUsers: (...args: unknown[]) => getIgnoredUsersMock(...args),
    setIgnoredUsers: (...args: unknown[]) => setIgnoredUsersMock(...args)
  }
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionService', () => ({
  matrixEncryptionService: {
    isEncryptionAvailable: (...args: unknown[]) => isEncryptionAvailableMock(...args),
    getKeyBackupInfo: (...args: unknown[]) => getKeyBackupInfoMock(...args)
  }
}))

let _encryptionEnabled = false
vi.mock('@/stores/domains/settings/encryption', () => ({
  useEncryptionStore: () => ({
    get encryptionEnabled() {
      return _encryptionEnabled
    },
    securityKeyConfigured: false,
    loadEncryptionStatus: vi.fn()
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    secretChatEnabled: false,
    secretChatHideSessions: false,
    secretChatAutoLock: false,
    secretChatLockTimeout: 5,
    isSecretChatConfigured: () => isSecretChatConfiguredMock(),
    setSecretChatPassword: (password: string) => setSecretChatPasswordMock(password),
    clearSecretChatPassword: () => clearSecretChatPasswordMock(),
    setSecretChatEnabled: (enabled: boolean) => setSecretChatEnabledMock(enabled),
    setSecretChatHideSessions: (enabled: boolean) => setSecretChatHideSessionsMock(enabled),
    setSecretChatAutoLock: (enabled: boolean) => setSecretChatAutoLockMock(enabled),
    setSecretChatLockTimeout: (value: number) => setSecretChatLockTimeoutMock(value)
  })
}))

vi.mock('@/components/encryption/KeyBackupSetupDialog.vue', () => ({
  default: { name: 'KeyBackupSetupDialog', template: '<div class="key-backup-dialog" />', props: ['show'] }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
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

describe('SecuritySettings', () => {
  const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as SecuritySettingsVm

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(window as any).$message = { success: messageSuccessMock, warning: messageWarningMock, error: messageErrorMock }
    localStorage.clear()
    getIgnoredUsersMock.mockResolvedValue([])
    isEncryptionAvailableMock.mockResolvedValue(false)
    getKeyBackupInfoMock.mockResolvedValue(null)
    isSecretChatConfiguredMock.mockReturnValue(false)
  })

  it('renders correctly', async () => {
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    expect(wrapper.find('.security-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('加密状态')
  })

  it('shows encryption disabled state by default', async () => {
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    expect(getVm(wrapper).encryptionEnabled).toBe(false)
    expect(wrapper.text()).toContain('端到端加密未启用')
  })

  it('shows encryption enabled state', async () => {
    isEncryptionAvailableMock.mockResolvedValue(true)
    _encryptionEnabled = true
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    expect(getVm(wrapper).encryptionEnabled).toBe(true)
  })

  it('loads ignored users on mount', async () => {
    getIgnoredUsersMock.mockResolvedValue(['@user1:test.com', '@user2:test.com'])
    mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    expect(getIgnoredUsersMock).toHaveBeenCalled()
  })

  it('loads blocked users from localStorage', async () => {
    localStorage.setItem('hula-blocked-users', JSON.stringify(['@blocked:test.com']))
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    expect(getVm(wrapper).blockedUsers).toContain('@blocked:test.com')
  })

  it('loads invite lists from localStorage', async () => {
    localStorage.setItem('hula-invite-blocklist', JSON.stringify(['@block:test.com']))
    localStorage.setItem('hula-invite-allowlist', JSON.stringify(['@allow:test.com']))
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    expect(vm.inviteBlocklist).toContain('@block:test.com')
    expect(vm.inviteAllowlist).toContain('@allow:test.com')
  })

  it('loads privacy settings from localStorage', async () => {
    localStorage.setItem('hula-show-online', 'false')
    localStorage.setItem('hula-show-typing', 'false')
    localStorage.setItem('hula-send-receipts', 'false')
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    expect(vm.showOnlineStatus).toBe(false)
    expect(vm.showTypingStatus).toBe(false)
    expect(vm.sendReadReceipts).toBe(false)
  })

  it('saves online status to localStorage', async () => {
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.handleOnlineStatusChange(false)
    expect(localStorage.getItem('hula-show-online')).toBe('false')
    expect(messageSuccessMock).toHaveBeenCalled()
  })

  it('saves typing status to localStorage', async () => {
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.handleTypingStatusChange(false)
    expect(localStorage.getItem('hula-show-typing')).toBe('false')
  })

  it('adds blocked user and saves to localStorage', async () => {
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.newBlockedUser = '@newblocked:test.com'
    vm.handleAddBlocked()
    expect(vm.blockedUsers).toContain('@newblocked:test.com')
    const saved = JSON.parse(localStorage.getItem('hula-blocked-users')!)
    expect(saved).toContain('@newblocked:test.com')
  })

  it('rejects duplicate blocked user', async () => {
    localStorage.setItem('hula-blocked-users', JSON.stringify(['@dup:test.com']))
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.newBlockedUser = '@dup:test.com'
    vm.handleAddBlocked()
    expect(messageWarningMock).toHaveBeenCalledWith('该用户已在屏蔽列表中')
  })

  it('removes blocked user', async () => {
    localStorage.setItem('hula-blocked-users', JSON.stringify(['@rm:test.com', '@keep:test.com']))
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.handleUnblock('@rm:test.com')
    expect(vm.blockedUsers).not.toContain('@rm:test.com')
    expect(vm.blockedUsers).toContain('@keep:test.com')
  })

  it('adds user to invite blocklist', async () => {
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.newBlocklistUser = '@blockuser:test.com'
    vm.handleAddInviteBlocklist()
    expect(vm.inviteBlocklist).toContain('@blockuser:test.com')
    expect(JSON.parse(localStorage.getItem('hula-invite-blocklist')!)).toContain('@blockuser:test.com')
  })

  it('removes user from invite allowlist', async () => {
    localStorage.setItem('hula-invite-allowlist', JSON.stringify(['@rm:test.com', '@keep:test.com']))
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.handleRemoveInviteAllowlist('@rm:test.com')
    expect(vm.inviteAllowlist).not.toContain('@rm:test.com')
  })

  it('clears secret chat triggers dialog', async () => {
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.handleClearSecretChat()
    expect(dialogWarningMock).toHaveBeenCalledWith(expect.objectContaining({ title: '确认清除' }))
  })

  it('saves secret chat password', async () => {
    isSecretChatConfiguredMock.mockReturnValue(true)
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.secretChatForm.password = '1234'
    vm.secretChatForm.confirmPassword = '1234'
    await vm.handleSaveSecretChat()
    expect(setSecretChatPasswordMock).toHaveBeenCalledWith('1234')
  })

  it('rejects mismatched secret chat passwords', async () => {
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.secretChatForm.password = '1234'
    vm.secretChatForm.confirmPassword = '5678'
    await vm.handleSaveSecretChat()
    expect(messageErrorMock).toHaveBeenCalledWith('两次输入的密码不一致')
  })

  it('rejects short secret chat password', async () => {
    const wrapper = mount(SecuritySettings, { global: { stubs: { InvitePermissionPanel: true } } })
    await vi.dynamicImportSettled()
    const vm = getVm(wrapper)
    vm.secretChatForm.password = '12'
    vm.secretChatForm.confirmPassword = '12'
    await vm.handleSaveSecretChat()
    expect(messageErrorMock).toHaveBeenCalledWith('密码长度不能少于4位')
  })
})
