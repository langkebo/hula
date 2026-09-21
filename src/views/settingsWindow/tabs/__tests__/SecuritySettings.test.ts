import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentPublicInstance } from 'vue'
import SecuritySettings from '../SecuritySettings.vue'
import BlockedUsersSection from '../sections/BlockedUsersSection.vue'
import PrivacySettingsSection from '../sections/PrivacySettingsSection.vue'
import PrivateChatSection from '../sections/PrivateChatSection.vue'

const {
  messageSuccessMock,
  messageWarningMock,
  messageErrorMock,
  dialogWarningMock,
  getIgnoredUsersMock,
  setIgnoredUsersMock,
  getInvitePolicyMock,
  setInvitePolicyMock,
  invitePolicyState,
  isEncryptionAvailableMock,
  getKeyBackupInfoMock,
  isSecretChatConfiguredMock,
  setSecretChatPasswordMock,
  clearSecretChatPasswordMock,
  setSecretChatEnabledMock,
  setSecretChatHideSessionsMock,
  setSecretChatAutoLockMock,
  setSecretChatLockTimeoutMock,
  setShowOnlineStatusEnabledMock,
  setSendTypingNotificationsEnabledMock,
  setSendReadReceiptsEnabledMock,
  migrateLegacyPreferenceSettingsMock,
  privacyState,
  translationMap
} = vi.hoisted(() => {
  const messageSuccessMock = vi.fn()
  const messageWarningMock = vi.fn()
  const messageErrorMock = vi.fn()
  const dialogWarningMock = vi.fn()

  const getIgnoredUsersMock = vi.fn().mockResolvedValue([])
  const setIgnoredUsersMock = vi.fn().mockResolvedValue(undefined)

  /**
   * 屏蔽名单已统一到账号级邀请策略（account data）。
   *
   * 用可变 state 而不是固定返回值：组件挂载时读一次、写回后再读一次，
   * 断言的是「写回的策略是什么」而不是「mock 自己返回了什么」。
   */
  const invitePolicyState = {
    mode: 'allow_all',
    blocklist: [] as string[],
    allowlist: [] as string[],
    allowStrangers: false,
    contacts: [] as string[]
  }
  const getInvitePolicyMock = vi.fn(async () => ({ ...invitePolicyState }))
  const setInvitePolicyMock = vi.fn(async (policy: typeof invitePolicyState) => {
    Object.assign(invitePolicyState, policy)
    return true
  })

  const isEncryptionAvailableMock = vi.fn().mockResolvedValue(false)
  const getKeyBackupInfoMock = vi.fn().mockResolvedValue(null)

  const isSecretChatConfiguredMock = vi.fn().mockReturnValue(false)
  const setSecretChatPasswordMock = vi.fn()
  const clearSecretChatPasswordMock = vi.fn()
  const setSecretChatEnabledMock = vi.fn()
  const setSecretChatHideSessionsMock = vi.fn()
  const setSecretChatAutoLockMock = vi.fn()
  const setSecretChatLockTimeoutMock = vi.fn()
  const setShowOnlineStatusEnabledMock = vi.fn()
  const setSendTypingNotificationsEnabledMock = vi.fn()
  const setSendReadReceiptsEnabledMock = vi.fn()
  const migrateLegacyPreferenceSettingsMock = vi.fn()
  const privacyState = {
    showOnlineStatus: true,
    sendTypingNotifications: true,
    sendReadReceipts: true
  }
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
    getInvitePolicyMock,
    setInvitePolicyMock,
    invitePolicyState,
    isEncryptionAvailableMock,
    getKeyBackupInfoMock,
    isSecretChatConfiguredMock,
    setSecretChatPasswordMock,
    clearSecretChatPasswordMock,
    setSecretChatEnabledMock,
    setSecretChatHideSessionsMock,
    setSecretChatAutoLockMock,
    setSecretChatLockTimeoutMock,
    setShowOnlineStatusEnabledMock,
    setSendTypingNotificationsEnabledMock,
    setSendReadReceiptsEnabledMock,
    migrateLegacyPreferenceSettingsMock,
    privacyState,
    translationMap
  }
})

type SecuritySettingsVm = ComponentPublicInstance & {
  encryptionEnabled: boolean
}

type BlockedUsersVm = ComponentPublicInstance & {
  blockedUsers: string[]
  newBlockedUser: string
  handleAddBlocked: () => void
  handleUnblock: (userId: string) => Promise<void>
}

type PrivacySettingsVm = ComponentPublicInstance & {
  showOnlineStatus: boolean
  showTypingStatus: boolean
  sendReadReceipts: boolean
  handleOnlineStatusChange: (value: boolean) => void
  handleTypingStatusChange: (value: boolean) => void
  handleReadReceiptsChange: (value: boolean) => void
}

type PrivateChatVm = ComponentPublicInstance & {
  secretChatForm: {
    password: string
    confirmPassword: string
  }
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
  NSelect: { name: 'NSelect', template: '<select />', props: ['value', 'options'] },
  useMessage: () => ({ success: messageSuccessMock, warning: messageWarningMock, error: messageErrorMock }),
  useDialog: () => ({ warning: dialogWarningMock })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width'] }
}))

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: {
    getIgnoredUsers: (...args: unknown[]) => getIgnoredUsersMock(...args),
    setIgnoredUsers: (...args: unknown[]) => setIgnoredUsersMock(...args),
    getInvitePolicy: (...args: Parameters<typeof getInvitePolicyMock>) => getInvitePolicyMock(...args),
    setInvitePolicy: (...args: Parameters<typeof setInvitePolicyMock>) => setInvitePolicyMock(...args)
  }
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionService', () => ({
  matrixEncryptionService: {
    isEncryptionAvailable: (...args: unknown[]) => isEncryptionAvailableMock(...args),
    getKeyBackupInfo: (...args: unknown[]) => getKeyBackupInfoMock(...args)
  }
}))

let _encryptionEnabled = false
vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    waitForClientReady: vi.fn().mockResolvedValue(undefined),
    getClient: vi.fn()
  },
  default: {
    waitForClientReady: vi.fn().mockResolvedValue(undefined),
    getClient: vi.fn()
  }
}))

vi.mock('@/stores/domains/settings/encryption', () => ({
  useEncryptionStore: () => ({
    get encryptionEnabled() {
      return _encryptionEnabled
    },
    securityKeyConfigured: false,
    loadEncryptionStatus: vi.fn(),
    markSecurityKeyConfigured: vi.fn()
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
    setSecretChatLockTimeout: (value: number) => setSecretChatLockTimeoutMock(value),
    get showOnlineStatusEnabled() {
      return privacyState.showOnlineStatus
    },
    get sendTypingNotificationsEnabled() {
      return privacyState.sendTypingNotifications
    },
    get sendReadReceiptsEnabled() {
      return privacyState.sendReadReceipts
    },
    setShowOnlineStatusEnabled: (enabled: boolean) => {
      privacyState.showOnlineStatus = enabled
      setShowOnlineStatusEnabledMock(enabled)
    },
    setSendTypingNotificationsEnabled: (enabled: boolean) => {
      privacyState.sendTypingNotifications = enabled
      setSendTypingNotificationsEnabledMock(enabled)
    },
    setSendReadReceiptsEnabled: (enabled: boolean) => {
      privacyState.sendReadReceipts = enabled
      setSendReadReceiptsEnabledMock(enabled)
    },
    migrateLegacyPreferenceSettings: () => migrateLegacyPreferenceSettingsMock()
  })
}))

vi.mock('@/components/encryption/KeyBackupSetupDialog.vue', () => ({
  default: { name: 'KeyBackupSetupDialog', template: '<div class="key-backup-dialog" />', props: ['show'] }
}))

vi.mock('@/components/encryption/SecureBackupDialog.vue', () => ({
  default: { name: 'SecureBackupDialog', template: '<div />', props: ['show'] }
}))

vi.mock('@/components/encryption/SecurityKeySetupDialog.vue', () => ({
  default: { name: 'SecurityKeySetupDialog', template: '<div />', props: ['show'] }
}))

vi.mock('@/components/settings/InvitePermissionPanel.vue', () => ({
  default: { name: 'InvitePermissionPanel', template: '<div />' }
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
  const getBlockedVm = (wrapper: ReturnType<typeof mount>) =>
    wrapper.findComponent(BlockedUsersSection).vm as BlockedUsersVm
  const getPrivacyVm = (wrapper: ReturnType<typeof mount>) =>
    wrapper.findComponent(PrivacySettingsSection).vm as PrivacySettingsVm
  const getPrivateChatVm = (wrapper: ReturnType<typeof mount>) =>
    wrapper.findComponent(PrivateChatSection).vm as PrivateChatVm

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(window as any).$message = { success: messageSuccessMock, warning: messageWarningMock, error: messageErrorMock }
    localStorage.clear()
    getIgnoredUsersMock.mockResolvedValue([])
    invitePolicyState.mode = 'allow_all'
    invitePolicyState.blocklist = []
    invitePolicyState.allowlist = []
    invitePolicyState.allowStrangers = false
    invitePolicyState.contacts = []
    isEncryptionAvailableMock.mockResolvedValue(false)
    getKeyBackupInfoMock.mockResolvedValue(null)
    isSecretChatConfiguredMock.mockReturnValue(false)
    privacyState.showOnlineStatus = true
    privacyState.sendTypingNotifications = true
    privacyState.sendReadReceipts = true
  })

  it('renders correctly', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    expect(wrapper.find('.security-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('加密状态')
  })

  it('shows encryption disabled state by default', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    expect(getVm(wrapper).encryptionEnabled).toBe(false)
    expect(wrapper.text()).toContain('端到端加密未启用')
  })

  it('shows encryption enabled state', async () => {
    isEncryptionAvailableMock.mockResolvedValue(true)
    _encryptionEnabled = true
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    expect(getVm(wrapper).encryptionEnabled).toBe(true)
  })

  it('loads ignored users on mount', async () => {
    getIgnoredUsersMock.mockResolvedValue(['@user1:test.com', '@user2:test.com'])
    mount(SecuritySettings)
    await vi.dynamicImportSettled()
    expect(getIgnoredUsersMock).toHaveBeenCalled()
  })

  it('loads blocked users from the invite policy (not localStorage)', async () => {
    invitePolicyState.blocklist = ['@blocked:test.com']
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    expect(getBlockedVm(wrapper).blockedUsers).toContain('@blocked:test.com')
    expect(localStorage.getItem('tjg-blocked-users')).toBeNull()
  })

  it('loads privacy settings from the setting store', async () => {
    privacyState.showOnlineStatus = false
    privacyState.sendTypingNotifications = false
    privacyState.sendReadReceipts = false
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = getPrivacyVm(wrapper)
    expect(vm.showOnlineStatus).toBe(false)
    expect(vm.showTypingStatus).toBe(false)
    expect(vm.sendReadReceipts).toBe(false)
    expect(migrateLegacyPreferenceSettingsMock).toHaveBeenCalled()
  })

  it('writes online status to the setting store', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = getPrivacyVm(wrapper)
    vm.handleOnlineStatusChange(false)
    expect(setShowOnlineStatusEnabledMock).toHaveBeenCalledWith(false)
    expect(privacyState.showOnlineStatus).toBe(false)
    // 组件不再写 localStorage 死 key
    expect(localStorage.getItem('tjg-show-online')).toBeNull()
    expect(messageSuccessMock).toHaveBeenCalled()
  })

  it('writes typing status to the setting store', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = getPrivacyVm(wrapper)
    vm.handleTypingStatusChange(false)
    expect(setSendTypingNotificationsEnabledMock).toHaveBeenCalledWith(false)
    expect(privacyState.sendTypingNotifications).toBe(false)
    expect(localStorage.getItem('tjg-show-typing')).toBeNull()
  })

  it('writes read receipts to the setting store', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = getPrivacyVm(wrapper)
    vm.handleReadReceiptsChange(false)
    expect(setSendReadReceiptsEnabledMock).toHaveBeenCalledWith(false)
    expect(privacyState.sendReadReceipts).toBe(false)
    expect(localStorage.getItem('tjg-send-receipts')).toBeNull()
  })

  it('adds blocked user through the invite policy without flipping mode', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = getBlockedVm(wrapper)
    vm.newBlockedUser = '@newblocked:test.com'
    await vm.handleAddBlocked()
    expect(vm.blockedUsers).toContain('@newblocked:test.com')
    expect(setInvitePolicyMock).toHaveBeenCalledWith(expect.objectContaining({ blocklist: ['@newblocked:test.com'] }))
    // mode 是用户显式选择，屏蔽操作不得把它改成 blocklist
    expect(invitePolicyState.mode).toBe('allow_all')
    expect(localStorage.getItem('tjg-blocked-users')).toBeNull()
  })

  it('rejects duplicate blocked user', async () => {
    invitePolicyState.blocklist = ['@dup:test.com']
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = getBlockedVm(wrapper)
    vm.newBlockedUser = '@dup:test.com'
    await vm.handleAddBlocked()
    expect(messageWarningMock).toHaveBeenCalledWith('该用户已在屏蔽列表中')
  })

  it('removes blocked user', async () => {
    invitePolicyState.blocklist = ['@rm:test.com', '@keep:test.com']
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = getBlockedVm(wrapper)
    await vm.handleUnblock('@rm:test.com')
    expect(vm.blockedUsers).not.toContain('@rm:test.com')
    expect(vm.blockedUsers).toContain('@keep:test.com')
    expect(setInvitePolicyMock).toHaveBeenCalledWith(expect.objectContaining({ blocklist: ['@keep:test.com'] }))
  })

  it('clears secret chat triggers dialog', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = getPrivateChatVm(wrapper)
    vm.handleClearSecretChat()
    expect(dialogWarningMock).toHaveBeenCalledWith(expect.objectContaining({ title: '确认清除' }))
  })

  it('saves secret chat password', async () => {
    isSecretChatConfiguredMock.mockReturnValue(true)
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = getPrivateChatVm(wrapper)
    vm.secretChatForm.password = '1234'
    vm.secretChatForm.confirmPassword = '1234'
    await vm.handleSaveSecretChat()
    expect(setSecretChatPasswordMock).toHaveBeenCalledWith('1234')
  })

  it('rejects mismatched secret chat passwords', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = getPrivateChatVm(wrapper)
    vm.secretChatForm.password = '1234'
    vm.secretChatForm.confirmPassword = '5678'
    await vm.handleSaveSecretChat()
    expect(messageErrorMock).toHaveBeenCalledWith('两次输入的密码不一致')
  })

  it('rejects short secret chat password', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = getPrivateChatVm(wrapper)
    vm.secretChatForm.password = '12'
    vm.secretChatForm.confirmPassword = '12'
    await vm.handleSaveSecretChat()
    expect(messageErrorMock).toHaveBeenCalledWith('密码长度不能少于4位')
  })
})
