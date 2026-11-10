import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PrivateChatSection from '../sections/PrivateChatSection.vue'

const { mockState, setSecretChatPasswordMock, verifySecretChatPasswordMock, feedbackErrorMock, feedbackSuccessMock } =
  vi.hoisted(() => ({
    mockState: { configured: true },
    setSecretChatPasswordMock: vi.fn(async () => undefined),
    verifySecretChatPasswordMock: vi.fn(async () => true),
    feedbackErrorMock: vi.fn(),
    feedbackSuccessMock: vi.fn()
  }))

vi.mock('naive-ui', () => ({
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['size', 'type', 'loading'] },
  NDrawer: { name: 'NDrawer', template: '<div><slot /></div>', props: ['show', 'placement', 'width'] },
  NDrawerContent: {
    name: 'NDrawerContent',
    template: '<div><slot /><slot name="footer" /></div>',
    props: ['title', 'closable']
  },
  NForm: { name: 'NForm', template: '<form><slot /></form>', props: ['model', 'rules'] },
  NFormItem: { name: 'NFormItem', template: '<div><slot /></div>', props: ['label', 'path'] },
  NInput: { name: 'NInput', template: '<input />', props: ['value', 'type', 'placeholder', 'showPasswordOn'] },
  NSelect: { name: 'NSelect', template: '<select />', props: ['value', 'options'] },
  NSwitch: { name: 'NSwitch', template: '<input type="checkbox" />', props: ['value', 'disabled'] },
  useDialog: () => ({ warning: vi.fn() })
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: (message: string, type: string) => {
      if (type === 'error') feedbackErrorMock(message)
      if (type === 'success') feedbackSuccessMock(message)
    }
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    secretChatEnabled: false,
    secretChatHideSessions: false,
    secretChatAutoLock: false,
    secretChatLockTimeout: 5,
    isSecretChatConfigured: () => mockState.configured,
    setSecretChatPassword: setSecretChatPasswordMock,
    verifySecretChatPassword: verifySecretChatPasswordMock,
    setSecretChatEnabled: vi.fn(),
    setSecretChatHideSessions: vi.fn(),
    setSecretChatAutoLock: vi.fn(),
    setSecretChatLockTimeout: vi.fn(),
    clearSecretChatPassword: vi.fn()
  })
}))

type SectionVm = {
  secretChatForm: { password: string; confirmPassword: string; oldPassword: string }
  showSecretChatDialog: boolean
  handleSetupSecretChat: () => void
  handleSaveSecretChat: () => Promise<void>
}

const mountSection = (values: { oldPassword?: string; password?: string; confirmPassword?: string }) => {
  const wrapper = mount(PrivateChatSection)
  const vm = wrapper.vm as unknown as SectionVm
  vm.handleSetupSecretChat()
  vm.secretChatForm.oldPassword = values.oldPassword ?? ''
  vm.secretChatForm.password = values.password ?? ''
  vm.secretChatForm.confirmPassword = values.confirmPassword ?? ''
  return vm
}

describe('PrivateChatSection', () => {
  beforeEach(() => {
    mockState.configured = true
    vi.clearAllMocks()
    verifySecretChatPasswordMock.mockResolvedValue(true)
    setSecretChatPasswordMock.mockResolvedValue(undefined)
  })

  it('已配置密码时旧密码校验失败：不保存新密码、不关闭弹窗', async () => {
    verifySecretChatPasswordMock.mockResolvedValueOnce(false)
    const vm = mountSection({ oldPassword: 'wrong-old', password: 'newpass', confirmPassword: 'newpass' })

    await vm.handleSaveSecretChat()

    expect(verifySecretChatPasswordMock).toHaveBeenCalledWith('wrong-old')
    expect(setSecretChatPasswordMock).not.toHaveBeenCalled()
    expect(feedbackErrorMock).toHaveBeenCalledWith('home.secret_chat.password_incorrect')
    expect(vm.showSecretChatDialog).toBe(true)
  })

  it('两次输入不一致时不保存新密码', async () => {
    const vm = mountSection({ oldPassword: 'correct-old', password: 'newpass', confirmPassword: 'otherpass' })

    await vm.handleSaveSecretChat()

    expect(verifySecretChatPasswordMock).not.toHaveBeenCalled()
    expect(setSecretChatPasswordMock).not.toHaveBeenCalled()
    expect(feedbackErrorMock).toHaveBeenCalledWith('setting.private_chat.password_mismatch')
  })

  it('旧密码校验通过时保存新密码并关闭弹窗', async () => {
    const vm = mountSection({ oldPassword: 'correct-old', password: 'newpass', confirmPassword: 'newpass' })

    await vm.handleSaveSecretChat()

    expect(verifySecretChatPasswordMock).toHaveBeenCalledWith('correct-old')
    expect(setSecretChatPasswordMock).toHaveBeenCalledWith('newpass')
    expect(vm.showSecretChatDialog).toBe(false)
  })

  it('未配置密码时直接保存新密码，不校验旧密码', async () => {
    mockState.configured = false
    const vm = mountSection({ password: 'newpass', confirmPassword: 'newpass' })

    await vm.handleSaveSecretChat()

    expect(verifySecretChatPasswordMock).not.toHaveBeenCalled()
    expect(setSecretChatPasswordMock).toHaveBeenCalledWith('newpass')
  })
})
