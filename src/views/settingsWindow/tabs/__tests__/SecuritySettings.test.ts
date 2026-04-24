import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SecuritySettings from '../SecuritySettings.vue'

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

vi.mock('naive-ui', () => ({
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['size', 'type', 'loading'] },
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

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {
    getIgnoredUsers: () => getIgnoredUsersMock(),
    setIgnoredUsers: (...args: any[]) => setIgnoredUsersMock(...args)
  },
  matrixEncryptionService: {
    isEncryptionAvailable: () => isEncryptionAvailableMock(),
    getKeyBackupInfo: () => getKeyBackupInfoMock()
  }
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    secretChat: { password: null },
    isSecretChatConfigured: () => isSecretChatConfiguredMock(),
    setSecretChatPassword: (...args: any[]) => setSecretChatPasswordMock(...args),
    clearSecretChatPassword: () => clearSecretChatPasswordMock()
  })
}))

vi.mock('@/components/encryption/KeyBackupSetupDialog.vue', () => ({
  default: { name: 'KeyBackupSetupDialog', template: '<div class="key-backup-dialog" />', props: ['show'] }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

describe('SecuritySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getIgnoredUsersMock.mockResolvedValue([])
    isEncryptionAvailableMock.mockResolvedValue(false)
    getKeyBackupInfoMock.mockResolvedValue(null)
    isSecretChatConfiguredMock.mockReturnValue(false)
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
    expect((wrapper.vm as any).encryptionEnabled).toBe(false)
    expect(wrapper.text()).toContain('端到端加密未启用')
  })

  it('shows encryption enabled state', async () => {
    isEncryptionAvailableMock.mockResolvedValue(true)
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).encryptionEnabled).toBe(true)
  })

  it('loads ignored users on mount', async () => {
    getIgnoredUsersMock.mockResolvedValue(['@user1:test.com', '@user2:test.com'])
    const _wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    expect(getIgnoredUsersMock).toHaveBeenCalled()
  })

  it('loads blocked users from localStorage', async () => {
    localStorage.setItem('hula-blocked-users', JSON.stringify(['@blocked:test.com']))
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).blockedUsers).toContain('@blocked:test.com')
  })

  it('loads invite lists from localStorage', async () => {
    localStorage.setItem('hula-invite-blocklist', JSON.stringify(['@block:test.com']))
    localStorage.setItem('hula-invite-allowlist', JSON.stringify(['@allow:test.com']))
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).inviteBlocklist).toContain('@block:test.com')
    expect((wrapper.vm as any).inviteAllowlist).toContain('@allow:test.com')
  })

  it('loads privacy settings from localStorage', async () => {
    localStorage.setItem('hula-show-online', 'false')
    localStorage.setItem('hula-show-typing', 'false')
    localStorage.setItem('hula-send-receipts', 'false')
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).showOnlineStatus).toBe(false)
    expect((wrapper.vm as any).showTypingStatus).toBe(false)
    expect((wrapper.vm as any).sendReadReceipts).toBe(false)
  })

  it('saves online status to localStorage', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.handleOnlineStatusChange(false)
    expect(localStorage.getItem('hula-show-online')).toBe('false')
    expect(messageSuccessMock).toHaveBeenCalled()
  })

  it('saves typing status to localStorage', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.handleTypingStatusChange(false)
    expect(localStorage.getItem('hula-show-typing')).toBe('false')
  })

  it('adds blocked user and saves to localStorage', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.newBlockedUser = '@newblocked:test.com'
    vm.handleAddBlocked()
    expect(vm.blockedUsers).toContain('@newblocked:test.com')
    const saved = JSON.parse(localStorage.getItem('hula-blocked-users')!)
    expect(saved).toContain('@newblocked:test.com')
  })

  it('rejects duplicate blocked user', async () => {
    localStorage.setItem('hula-blocked-users', JSON.stringify(['@dup:test.com']))
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.newBlockedUser = '@dup:test.com'
    vm.handleAddBlocked()
    expect(messageWarningMock).toHaveBeenCalledWith('该用户已在屏蔽列表中')
  })

  it('removes blocked user', async () => {
    localStorage.setItem('hula-blocked-users', JSON.stringify(['@rm:test.com', '@keep:test.com']))
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.handleUnblock('@rm:test.com')
    expect(vm.blockedUsers).not.toContain('@rm:test.com')
    expect(vm.blockedUsers).toContain('@keep:test.com')
  })

  it('adds user to invite blocklist', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.newBlocklistUser = '@blockuser:test.com'
    vm.handleAddInviteBlocklist()
    expect(vm.inviteBlocklist).toContain('@blockuser:test.com')
    expect(JSON.parse(localStorage.getItem('hula-invite-blocklist')!)).toContain('@blockuser:test.com')
  })

  it('removes user from invite allowlist', async () => {
    localStorage.setItem('hula-invite-allowlist', JSON.stringify(['@rm:test.com', '@keep:test.com']))
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.handleRemoveInviteAllowlist('@rm:test.com')
    expect(vm.inviteAllowlist).not.toContain('@rm:test.com')
  })

  it('clears secret chat triggers dialog', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.handleClearSecretChat()
    expect(dialogWarningMock).toHaveBeenCalledWith(expect.objectContaining({ title: '确认清除' }))
  })

  it('saves secret chat password', async () => {
    isSecretChatConfiguredMock.mockReturnValue(true)
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.secretChatForm.password = '1234'
    vm.secretChatForm.confirmPassword = '1234'
    await vm.handleSaveSecretChat()
    expect(setSecretChatPasswordMock).toHaveBeenCalledWith('1234')
  })

  it('rejects mismatched secret chat passwords', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.secretChatForm.password = '1234'
    vm.secretChatForm.confirmPassword = '5678'
    await vm.handleSaveSecretChat()
    expect(messageErrorMock).toHaveBeenCalledWith('两次输入的密码不一致')
  })

  it('rejects short secret chat password', async () => {
    const wrapper = mount(SecuritySettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.secretChatForm.password = '12'
    vm.secretChatForm.confirmPassword = '12'
    await vm.handleSaveSecretChat()
    expect(messageErrorMock).toHaveBeenCalledWith('密码长度不能少于4位')
  })
})
