import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentPublicInstance } from 'vue'
import E2EEOnboardingDialog from '../E2EEOnboardingDialog.vue'

const {
  waitForClientReadyMock,
  createRecoveryKeyFromPassphraseMock,
  createSecureBackupMock,
  setupCrossSigningMock,
  setupKeyBackupMock,
  showFeedbackMock
} = vi.hoisted(() => ({
  waitForClientReadyMock: vi.fn(),
  createRecoveryKeyFromPassphraseMock: vi.fn(),
  createSecureBackupMock: vi.fn(),
  setupCrossSigningMock: vi.fn(),
  setupKeyBackupMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

type E2EEOnboardingDialogVm = ComponentPublicInstance & {
  currentStep: string
  recoveryKey: string
  currentPassword: string
  keySaved: boolean
  handleStart: () => Promise<void>
  handleNext: () => Promise<void>
}

vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')

  return {
    NModal: defineComponent({
      name: 'NModal',
      props: {
        show: {
          type: Boolean,
          default: false
        }
      },
      emits: ['update:show'],
      template: '<div v-if="show"><slot /><slot name="footer" /></div>'
    }),
    NSpin: defineComponent({
      name: 'NSpin',
      template: '<div><slot /></div>'
    }),
    NButton: defineComponent({
      name: 'NButton',
      template: '<button type="button"><slot /></button>'
    }),
    NCheckbox: defineComponent({
      name: 'NCheckbox',
      template: '<label><slot /></label>'
    }),
    NInput: defineComponent({
      name: 'NInput',
      template: '<input />'
    })
  }
})

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    template: '<i />'
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    waitForClientReady: waitForClientReadyMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: {
    createRecoveryKeyFromPassphrase: createRecoveryKeyFromPassphraseMock,
    createSecureBackup: createSecureBackupMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionService', () => ({
  matrixEncryptionService: {
    setupCrossSigning: setupCrossSigningMock,
    setupKeyBackup: setupKeyBackupMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

describe('E2EEOnboardingDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    waitForClientReadyMock.mockResolvedValue(undefined)
    createRecoveryKeyFromPassphraseMock.mockResolvedValue({
      encodedPrivateKey: 'SECURITY-KEY-123'
    })
  })

  function mountComponent() {
    return mount(E2EEOnboardingDialog, {
      props: {
        show: true
      }
    })
  }

  function getVm(wrapper: ReturnType<typeof mountComponent>) {
    return wrapper.vm as unknown as E2EEOnboardingDialogVm
  }

  it('开始设置时生成真实恢复密钥而不是展示备份版本号', async () => {
    const wrapper = mountComponent()
    const vm = getVm(wrapper)

    await vm.handleStart()

    expect(waitForClientReadyMock).toHaveBeenCalledWith({ timeoutMs: 10000 })
    expect(createRecoveryKeyFromPassphraseMock).toHaveBeenCalledWith()
    expect(createSecureBackupMock).not.toHaveBeenCalled()
    expect(vm.currentStep).toBe('securityKey')
    expect(vm.recoveryKey).toBe('SECURITY-KEY-123')
  })

  it('生成失败时回退欢迎页并提示错误', async () => {
    createRecoveryKeyFromPassphraseMock.mockRejectedValueOnce(new Error('boom'))

    const wrapper = mountComponent()
    const vm = getVm(wrapper)

    await vm.handleStart()

    expect(vm.currentStep).toBe('welcome')
    expect(vm.recoveryKey).toBe('')
    expect(showFeedbackMock).toHaveBeenCalledWith('encryption.onboarding.generate_key_failed', 'error')
  })

  it('使用当前密码完成交叉签名与密钥备份初始化', async () => {
    const wrapper = mountComponent()
    const vm = getVm(wrapper)

    await vm.handleStart()
    vm.keySaved = true
    vm.currentPassword = 'current-pass'

    await vm.handleNext()
    expect(setupCrossSigningMock).toHaveBeenCalledWith({ password: 'current-pass' })

    await vm.handleNext()
    expect(setupKeyBackupMock).toHaveBeenCalledWith({
      password: 'current-pass',
      generatedKey: expect.objectContaining({
        encodedPrivateKey: 'SECURITY-KEY-123'
      })
    })
  })
})
