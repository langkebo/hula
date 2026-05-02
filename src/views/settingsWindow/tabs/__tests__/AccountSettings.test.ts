import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccountSettings from '../AccountSettings.vue'

const {
  updateDisplayNameMock,
  changePasswordMock,
  deactivateAccountMock,
  updateAvatarMock,
  uploadImageMock,
  messageSuccessMock,
  messageWarningMock,
  messageErrorMock,
  dialogWarningMock,
  translationMap
} = vi.hoisted(() => {
  return {
    updateDisplayNameMock: vi.fn().mockResolvedValue(undefined),
    changePasswordMock: vi.fn().mockResolvedValue(undefined),
    deactivateAccountMock: vi.fn().mockResolvedValue(undefined),
    updateAvatarMock: vi.fn().mockResolvedValue(undefined),
    uploadImageMock: vi.fn().mockResolvedValue({ contentUri: 'mxc://test/avatar' }),
    messageSuccessMock: vi.fn(),
    messageWarningMock: vi.fn(),
    messageErrorMock: vi.fn(),
    dialogWarningMock: vi.fn(),
    translationMap: {
      'setting.account.profile': '个人资料',
      'setting.account.password_incomplete': '请填写完整密码信息',
      'setting.account.password_mismatch': '两次输入的密码不一致',
      'setting.account.password_change_failed_with_hint': '密码修改失败，请检查当前密码是否正确',
      'setting.account.deactivate_confirm_title': '确认停用账户'
    } as Record<string, string>
  }
})

vi.mock('naive-ui', () => ({
  NAvatar: { name: 'NAvatar', template: '<div class="n-avatar" />', props: ['round', 'size', 'src', 'fallbackSrc'] },
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['size', 'type', 'loading'] },
  NForm: { name: 'NForm', template: '<form><slot /></form>', props: ['model', 'labelPlacement', 'labelWidth'] },
  NFormItem: { name: 'NFormItem', template: '<div><slot /></div>', props: ['label', 'path'] },
  NInput: {
    name: 'NInput',
    template: '<input />',
    props: ['value', 'type', 'placeholder', 'disabled', 'maxlength', 'showPasswordOn']
  },
  NDivider: { name: 'NDivider', template: '<hr />' },
  useMessage: () => ({
    success: messageSuccessMock,
    warning: messageWarningMock,
    error: messageErrorMock
  }),
  useDialog: () => ({ warning: dialogWarningMock })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    currentUserDisplayName: 'TestUser',
    currentUserAvatarUrl: '',
    updateAvatar: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => ({
    userId: '@test:localhost',
    deviceId: 'DEVICE123'
  })
}))

vi.mock('@/services/matrix/user/MatrixAccountService', () => ({
  matrixAccountService: {
    updateDisplayName: (...args: any[]) => updateDisplayNameMock(...args),
    changePassword: (...args: any[]) => changePasswordMock(...args),
    deactivateAccount: () => deactivateAccountMock(),
    updateAvatar: (...args: any[]) => updateAvatarMock(...args)
  }
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    uploadImage: (...args: any[]) => uploadImageMock(...args),
    getMediaUrl: (url: string) => url
  }
}))

vi.mock('@/components/common/AvatarCropper.vue', () => ({
  default: { name: 'AvatarCropper', template: '<div />', props: ['show', 'imageUrl'] }
}))

vi.mock('@/assets/img/win.png', () => ({
  default: 'default-avatar.png'
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
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

describe('AccountSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders correctly', () => {
    const wrapper = mount(AccountSettings)
    expect(wrapper.find('.account-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('个人资料')
  })

  it('displays user ID', () => {
    const wrapper = mount(AccountSettings)
    expect((wrapper.vm as any).userId).toBe('@test:localhost')
  })

  it('displays display name from store', () => {
    const wrapper = mount(AccountSettings)
    expect((wrapper.vm as any).formData.displayName).toBe('TestUser')
  })

  it('has empty password form by default', () => {
    const wrapper = mount(AccountSettings)
    expect((wrapper.vm as any).passwordForm.oldPassword).toBe('')
    expect((wrapper.vm as any).passwordForm.newPassword).toBe('')
    expect((wrapper.vm as any).passwordForm.confirmPassword).toBe('')
  })

  it('warns when password fields are empty', async () => {
    const wrapper = mount(AccountSettings)
    const vm = wrapper.vm as any
    await vm.handlePasswordChange()
    expect(messageWarningMock).toHaveBeenCalledWith('请填写完整密码信息')
  })

  it('warns when passwords do not match', async () => {
    const wrapper = mount(AccountSettings)
    const vm = wrapper.vm as any
    vm.passwordForm.oldPassword = 'oldpass'
    vm.passwordForm.newPassword = 'newpass1'
    vm.passwordForm.confirmPassword = 'newpass2'
    await vm.handlePasswordChange()
    expect(messageWarningMock).toHaveBeenCalledWith('两次输入的密码不一致')
  })

  it('calls changePassword when form is valid', async () => {
    changePasswordMock.mockResolvedValue(undefined)
    const wrapper = mount(AccountSettings)
    const vm = wrapper.vm as any
    vm.passwordForm.oldPassword = 'oldpass'
    vm.passwordForm.newPassword = 'newpass'
    vm.passwordForm.confirmPassword = 'newpass'
    await vm.handlePasswordChange()
    expect(changePasswordMock).toHaveBeenCalledWith('oldpass', 'newpass')
  })

  it('clears password form after successful change', async () => {
    changePasswordMock.mockResolvedValue(undefined)
    const wrapper = mount(AccountSettings)
    const vm = wrapper.vm as any
    vm.passwordForm.oldPassword = 'oldpass'
    vm.passwordForm.newPassword = 'newpass'
    vm.passwordForm.confirmPassword = 'newpass'
    await vm.handlePasswordChange()
    expect((wrapper.vm as any).passwordForm.oldPassword).toBe('')
    expect((wrapper.vm as any).passwordForm.newPassword).toBe('')
    expect((wrapper.vm as any).passwordForm.confirmPassword).toBe('')
  })

  it('shows error on password change failure', async () => {
    changePasswordMock.mockRejectedValue(new Error('fail'))
    const wrapper = mount(AccountSettings)
    const vm = wrapper.vm as any
    vm.passwordForm.oldPassword = 'oldpass'
    vm.passwordForm.newPassword = 'newpass'
    vm.passwordForm.confirmPassword = 'newpass'
    await vm.handlePasswordChange()
    expect(messageErrorMock).toHaveBeenCalledWith('密码修改失败，请检查当前密码是否正确')
  })

  it('does not call updateDisplayName when name unchanged', async () => {
    const wrapper = mount(AccountSettings)
    const vm = wrapper.vm as any
    vm.formData.displayName = 'TestUser'
    await vm.handleDisplayNameChange()
    expect(updateDisplayNameMock).not.toHaveBeenCalled()
  })

  it('calls updateDisplayName when name changed', async () => {
    updateDisplayNameMock.mockResolvedValue(undefined)
    const wrapper = mount(AccountSettings)
    const vm = wrapper.vm as any
    vm.formData.displayName = 'NewName'
    await vm.handleDisplayNameChange()
    expect(updateDisplayNameMock).toHaveBeenCalledWith('NewName')
  })

  it('shows deactivate account dialog', () => {
    const wrapper = mount(AccountSettings)
    const vm = wrapper.vm as any
    vm.handleDeactivateAccount()
    expect(dialogWarningMock).toHaveBeenCalledWith(expect.objectContaining({ title: '确认停用账户' }))
  })

  it('avatar uploading is false by default', () => {
    const wrapper = mount(AccountSettings)
    expect((wrapper.vm as any).avatarUploading).toBe(false)
  })

  it('password loading is false by default', () => {
    const wrapper = mount(AccountSettings)
    expect((wrapper.vm as any).passwordLoading).toBe(false)
  })
})
