import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AccountSettings from '../AccountSettings.vue'

const {
  updateDisplayNameMock,
  changePasswordMock,
  deactivateAccountMock,
  updateAvatarMock,
  uploadImageMock,
  getExtendedProfileMock,
  updateOwnExtendedProfileMock,
  messageSuccessMock,
  messageWarningMock,
  messageErrorMock,
  dialogWarningMock,
  hasUnstableMock,
  translationMap
} = vi.hoisted(() => {
  return {
    updateDisplayNameMock: vi.fn().mockResolvedValue(undefined),
    changePasswordMock: vi.fn().mockResolvedValue(undefined),
    deactivateAccountMock: vi.fn().mockResolvedValue(undefined),
    updateAvatarMock: vi.fn().mockResolvedValue(undefined),
    uploadImageMock: vi.fn().mockResolvedValue({ contentUri: 'mxc://test/avatar' }),
    getExtendedProfileMock: vi.fn().mockResolvedValue({
      resume: '已保存简介',
      sex: 2,
      region: '杭州',
      birthday: '2000-01-02'
    }),
    updateOwnExtendedProfileMock: vi.fn().mockResolvedValue(undefined),
    messageSuccessMock: vi.fn(),
    messageWarningMock: vi.fn(),
    messageErrorMock: vi.fn(),
    dialogWarningMock: vi.fn(),
    hasUnstableMock: vi.fn((flag: string) => flag === 'uk.tcpip.msc4133'),
    translationMap: {
      'setting.account.profile': '个人资料',
      'setting.account.about': '简介',
      'setting.account.gender': '性别',
      'setting.account.region': '地区',
      'setting.account.birthday': '生日',
      'setting.account.extended_profile_updated': '资料已更新',
      'setting.account.extended_profile_unsupported': '当前服务器暂不支持扩展资料',
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
  NCard: { template: '<div><slot /></div>' },
  NCheckbox: { name: 'NCheckbox', template: '<label><slot /></label>', props: ['checked'] },
  NForm: { name: 'NForm', template: '<form><slot /></form>', props: ['model', 'labelPlacement', 'labelWidth'] },
  NFormItem: { name: 'NFormItem', template: '<div><slot /></div>', props: ['label', 'path'] },
  NInput: {
    name: 'NInput',
    template: '<input />',
    props: ['value', 'type', 'placeholder', 'disabled', 'maxlength', 'showPasswordOn']
  },
  NSelect: {
    name: 'NSelect',
    template: '<select />',
    props: ['value', 'options', 'placeholder', 'clearable']
  },
  NDivider: { name: 'NDivider', template: '<hr />' },
  useMessage: () => ({
    success: messageSuccessMock,
    warning: messageWarningMock,
    error: messageErrorMock
  }),
  useDialog: () => ({ warning: dialogWarningMock })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: (message: string, type: 'success' | 'warning' | 'error' | 'info') => {
      if (type === 'success') messageSuccessMock(message)
      if (type === 'warning') messageWarningMock(message)
      if (type === 'error') messageErrorMock(message)
    }
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    currentUserDisplayName: 'TestUser',
    currentUserAvatarUrl: '',
    updateAvatar: vi.fn().mockResolvedValue(undefined),
    userInfo: {
      resume: '',
      sex: 1
    },
    matrixProfile: {
      resume: '',
      sex: 1
    }
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

vi.mock('@/services/matrix/user/MatrixProfileService', () => ({
  profileService: {
    getExtendedProfile: (...args: any[]) => getExtendedProfileMock(...args),
    updateOwnExtendedProfile: (...args: any[]) => updateOwnExtendedProfileMock(...args)
  }
}))

vi.mock('@/services/matrix/MatrixCapabilityService', () => ({
  useServerCapability: () => ({
    hasUnstable: (flag: string) => hasUnstableMock(flag)
  })
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
    hasUnstableMock.mockImplementation((flag: string) => flag === 'uk.tcpip.msc4133')
  })

  it('renders correctly', () => {
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    expect(wrapper.find('.account-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('个人资料')
  })

  it('loads extended profile fields on mount', async () => {
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    await flushPromises()

    expect(getExtendedProfileMock).toHaveBeenCalledWith('@test:localhost')
    expect((wrapper.vm as any).formData.about).toBe('已保存简介')
    expect((wrapper.vm as any).formData.sex).toBe(2)
    expect((wrapper.vm as any).formData.region).toBe('杭州')
    expect((wrapper.vm as any).formData.birthday).toBe('2000-01-02')
  })

  it('displays user ID', () => {
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    expect((wrapper.vm as any).userId).toBe('@test:localhost')
  })

  it('displays display name from store', () => {
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    expect((wrapper.vm as any).formData.displayName).toBe('TestUser')
  })

  it('has empty password form by default', () => {
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    expect((wrapper.vm as any).passwordForm.oldPassword).toBe('')
    expect((wrapper.vm as any).passwordForm.newPassword).toBe('')
    expect((wrapper.vm as any).passwordForm.confirmPassword).toBe('')
  })

  it('warns when password fields are empty', async () => {
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    const vm = wrapper.vm as any
    await vm.handlePasswordChange()
    expect(messageWarningMock).toHaveBeenCalledWith('请填写完整密码信息')
  })

  it('warns when passwords do not match', async () => {
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    const vm = wrapper.vm as any
    vm.passwordForm.oldPassword = 'oldpass'
    vm.passwordForm.newPassword = 'newpass1'
    vm.passwordForm.confirmPassword = 'newpass2'
    await vm.handlePasswordChange()
    expect(messageWarningMock).toHaveBeenCalledWith('两次输入的密码不一致')
  })

  it('calls changePassword when form is valid', async () => {
    changePasswordMock.mockResolvedValue(undefined)
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    const vm = wrapper.vm as any
    vm.passwordForm.oldPassword = 'oldpass'
    vm.passwordForm.newPassword = 'Newpass1!'
    vm.passwordForm.confirmPassword = 'Newpass1!'
    await vm.handlePasswordChange()
    expect(changePasswordMock).toHaveBeenCalledWith('oldpass', 'Newpass1!', false)
  })

  it('clears password form after successful change', async () => {
    changePasswordMock.mockResolvedValue(undefined)
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    const vm = wrapper.vm as any
    vm.passwordForm.oldPassword = 'oldpass'
    vm.passwordForm.newPassword = 'Newpass1!'
    vm.passwordForm.confirmPassword = 'Newpass1!'
    await vm.handlePasswordChange()
    expect((wrapper.vm as any).passwordForm.oldPassword).toBe('')
    expect((wrapper.vm as any).passwordForm.newPassword).toBe('')
    expect((wrapper.vm as any).passwordForm.confirmPassword).toBe('')
  })

  it('shows error on password change failure', async () => {
    changePasswordMock.mockRejectedValue(new Error('fail'))
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    const vm = wrapper.vm as any
    vm.passwordForm.oldPassword = 'oldpass'
    vm.passwordForm.newPassword = 'Newpass1!'
    vm.passwordForm.confirmPassword = 'Newpass1!'
    await vm.handlePasswordChange()
    expect(messageErrorMock).toHaveBeenCalledWith('密码修改失败，请检查当前密码是否正确')
  })

  it('does not call updateDisplayName when name unchanged', async () => {
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    const vm = wrapper.vm as any
    vm.formData.displayName = 'TestUser'
    await vm.handleDisplayNameChange()
    expect(updateDisplayNameMock).not.toHaveBeenCalled()
  })

  it('calls updateDisplayName when name changed', async () => {
    updateDisplayNameMock.mockResolvedValue(undefined)
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    const vm = wrapper.vm as any
    vm.formData.displayName = 'NewName'
    await vm.handleDisplayNameChange()
    expect(updateDisplayNameMock).toHaveBeenCalledWith('NewName')
  })

  it('saves about field through extended profile API', async () => {
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    await flushPromises()
    const vm = wrapper.vm as any

    vm.formData.about = '新的桌面简介'
    await vm.handleAboutChange()

    expect(updateOwnExtendedProfileMock).toHaveBeenCalledWith({ resume: '新的桌面简介' })
    expect(messageSuccessMock).toHaveBeenCalledWith('资料已更新')
  })

  it('saves gender field through extended profile API', async () => {
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    await flushPromises()
    const vm = wrapper.vm as any

    await vm.handleSexChange(1)

    expect(updateOwnExtendedProfileMock).toHaveBeenCalledWith({ sex: 1 })
  })

  it('shows hint and blocks extended profile updates when server does not support MSC4133', async () => {
    hasUnstableMock.mockReturnValue(false)
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    await flushPromises()

    expect(getExtendedProfileMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('当前服务器暂不支持扩展资料')

    const inputComponents = wrapper.findAllComponents({ name: 'NInput' })
    expect(inputComponents.at(2)?.props('disabled')).toBe(true)
    expect(inputComponents.at(3)?.props('disabled')).toBe(true)
    expect(inputComponents.at(4)?.props('disabled')).toBe(true)

    const vm = wrapper.vm as any
    vm.formData.about = '新的桌面简介'
    await vm.handleAboutChange()
    await vm.handleSexChange(1)

    expect(updateOwnExtendedProfileMock).not.toHaveBeenCalled()
    expect(messageWarningMock).toHaveBeenCalledWith('当前服务器暂不支持扩展资料')
    expect(messageWarningMock).toHaveBeenCalledTimes(2)
  })

  it('shows deactivate account dialog', () => {
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    const vm = wrapper.vm as any
    vm.handleDeactivateAccount()
    expect(dialogWarningMock).toHaveBeenCalledWith(expect.objectContaining({ title: '确认停用账户' }))
  })

  it('avatar uploading is false by default', () => {
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    expect((wrapper.vm as any).avatarUploading).toBe(false)
  })

  it('password loading is false by default', () => {
    const wrapper = mount(AccountSettings, { global: { stubs: { ThreepidManager: true } } })
    expect((wrapper.vm as any).passwordLoading).toBe(false)
  })
})
