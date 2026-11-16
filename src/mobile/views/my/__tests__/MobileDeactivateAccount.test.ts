import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileDeactivateAccount from '../MobileDeactivateAccount.vue'

/**
 * 账号注销多重确认（方案 P0 + P1 T-15）。
 *
 * 缺口背景：移动端 `SecuritySettings.vue` 的注销只有**单次**确认对话框，
 * 方案要求「三层确认流程」。注销不可撤销，确认强度不足是真实的误操作风险。
 *
 * 三步设计（每步都能独立取消）：
 * 1. 后果说明 + 勾选「我已了解」
 * 2. 输入自己的 MXID 原文 + 当前账号密码（密码经 matrixAccountService 校验）
 * 3. 最终确认对话框，并选择是否同时抹除数据（erase）
 */

const {
  showToastMock,
  showConfirmDialogMock,
  showFailToastMock,
  deactivateAccountMock,
  verifyPasswordMock,
  logoutMock,
  routerReplaceMock
} = vi.hoisted(() => ({
  showToastMock: vi.fn(),
  showConfirmDialogMock: vi.fn(),
  showFailToastMock: vi.fn(),
  deactivateAccountMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
  logoutMock: vi.fn(),
  routerReplaceMock: vi.fn()
}))

const CURRENT_USER_ID = '@alice:example.org'
const VALID_PASSWORD = 'correct-password'

vi.mock('vant', async () => {
  const { defineComponent } = await import('vue')
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({ name, inheritAttrs: false, template: `<${tag} v-bind="$attrs"><slot /></${tag}>` })
  return {
    showToast: (...args: any[]) => showToastMock(...args),
    showFailToast: (...args: any[]) => showFailToastMock(...args),
    showConfirmDialog: (...args: any[]) => showConfirmDialogMock(...args),
    VanCellGroup: passthrough('VanCellGroup'),
    VanCell: passthrough('VanCell'),
    VanField: passthrough('VanField'),
    VanCheckbox: passthrough('VanCheckbox'),
    VanButton: passthrough('VanButton', 'button'),
    VanSteps: passthrough('VanSteps'),
    VanStep: passthrough('VanStep')
  }
})

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {
    deactivateAccount: (...args: any[]) => deactivateAccountMock(...args),
    verifyPassword: (...args: any[]) => verifyPasswordMock(...args)
  }
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => ({ userId: CURRENT_USER_ID })
}))

vi.mock('@/shared/composables/useLoginFlow', () => ({
  useLoginFlow: () => ({ logout: logoutMock })
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: { name: 'HeaderBar', template: '<div />', props: ['border', 'isOfficial', 'hiddenRight', 'roomName'] }
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: routerReplaceMock, back: vi.fn() })
}))

function mountPage() {
  return mount(MobileDeactivateAccount)
}

/** 走到「验证身份」步骤。 */
async function goToVerifyStep(vm: any) {
  vm.acknowledged = true
  await vm.handleConsequencesNext()
}

/** 在验证步骤填入 MXID 与密码并继续，默认密码校验通过。 */
async function goToFinalStep(vm: any, password = VALID_PASSWORD) {
  await goToVerifyStep(vm)
  vm.confirmationInput = CURRENT_USER_ID
  vm.passwordInput = password
  await vm.handleVerifyNext()
}

describe('MobileDeactivateAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    showConfirmDialogMock.mockResolvedValue(undefined)
    deactivateAccountMock.mockResolvedValue(undefined)
    verifyPasswordMock.mockResolvedValue(true)
    logoutMock.mockResolvedValue(undefined)
  })

  it('renders correctly', () => {
    expect(mountPage().html()).not.toBe('')
  })

  it('starts on the consequence step', () => {
    const vm = mountPage().vm as any
    expect(vm.step).toBe('consequences')
    expect(vm.acknowledged).toBe(false)
  })

  it('does not advance past the consequence step without acknowledgement', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await vm.handleConsequencesNext()
    expect(vm.step).toBe('consequences')
  })

  it('advances to the MXID step once acknowledged', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToVerifyStep(vm)
    expect(vm.step).toBe('verify')
  })

  it('exposes the current MXID for the verification prompt', () => {
    const vm = mountPage().vm as any
    expect(vm.currentUserId).toBe(CURRENT_USER_ID)
  })

  it('rejects a mismatched MXID without deactivating', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToVerifyStep(vm)
    vm.confirmationInput = '@someone-else:example.org'
    vm.passwordInput = VALID_PASSWORD
    await vm.handleVerifyNext()
    expect(vm.step).toBe('verify')
    expect(verifyPasswordMock).not.toHaveBeenCalled()
    expect(deactivateAccountMock).not.toHaveBeenCalled()
    expect(showConfirmDialogMock).not.toHaveBeenCalled()
    expect(showFailToastMock).toHaveBeenCalled()
  })

  it('does not advance when the password is empty', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToVerifyStep(vm)
    vm.confirmationInput = CURRENT_USER_ID
    vm.passwordInput = ''
    await vm.handleVerifyNext()
    expect(vm.step).toBe('verify')
    expect(verifyPasswordMock).not.toHaveBeenCalled()
    expect(deactivateAccountMock).not.toHaveBeenCalled()
    expect(showFailToastMock).toHaveBeenCalled()
  })

  it('does not deactivate when the password is rejected', async () => {
    verifyPasswordMock.mockResolvedValue(false)
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToFinalStep(vm, 'wrong-password')
    expect(verifyPasswordMock).not.toHaveBeenCalled()
    await vm.handleFinalConfirm()
    expect(verifyPasswordMock).toHaveBeenCalledWith('wrong-password')
    expect(deactivateAccountMock).not.toHaveBeenCalled()
    expect(vm.step).toBe('final')
    expect(showFailToastMock).toHaveBeenCalled()
  })

  it('surfaces the failure and skips deactivation when password verification throws', async () => {
    verifyPasswordMock.mockRejectedValue(new Error('network down'))
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToFinalStep(vm)
    await vm.handleFinalConfirm()
    expect(vm.step).toBe('final')
    expect(vm.submitting).toBe(false)
    expect(deactivateAccountMock).not.toHaveBeenCalled()
    expect(showFailToastMock).toHaveBeenCalled()
  })

  it('treats a whitespace-padded MXID as matching', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToVerifyStep(vm)
    vm.confirmationInput = `  ${CURRENT_USER_ID}  `
    vm.passwordInput = VALID_PASSWORD
    await vm.handleVerifyNext()
    expect(vm.step).toBe('final')
  })

  it('advances to the final step once MXID and password are provided', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToFinalStep(vm)
    expect(vm.step).toBe('final')
    // 密码校验在最终确认时才执行，避免用户中途取消却已触发服务端校验
    expect(verifyPasswordMock).not.toHaveBeenCalled()
  })

  it('deactivates only after the final confirmation', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToFinalStep(vm)
    await vm.handleFinalConfirm()
    expect(showConfirmDialogMock).toHaveBeenCalled()
    expect(verifyPasswordMock).toHaveBeenCalledWith(VALID_PASSWORD)
    expect(deactivateAccountMock).toHaveBeenCalled()
  })

  it('passes the password auth data and erase choice to the service', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToFinalStep(vm)
    vm.eraseData = true
    await vm.handleFinalConfirm()
    expect(deactivateAccountMock).toHaveBeenCalledWith(
      {
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user: CURRENT_USER_ID },
        password: VALID_PASSWORD
      },
      true
    )
  })

  it('defaults eraseData to false', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToFinalStep(vm)
    await vm.handleFinalConfirm()
    expect(deactivateAccountMock).toHaveBeenCalledWith(expect.objectContaining({ password: VALID_PASSWORD }), false)
  })

  it('does nothing when the final dialog is cancelled', async () => {
    showConfirmDialogMock.mockRejectedValue('cancel')
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToFinalStep(vm)
    await vm.handleFinalConfirm()
    expect(verifyPasswordMock).not.toHaveBeenCalled()
    expect(deactivateAccountMock).not.toHaveBeenCalled()
    expect(vm.step).toBe('final')
  })

  it('logs out and leaves after a successful deactivation', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToFinalStep(vm)
    await vm.handleFinalConfirm()
    expect(logoutMock).toHaveBeenCalled()
    expect(routerReplaceMock).toHaveBeenCalledWith('/mobile/login')
  })

  it('surfaces a failure toast and stays put when deactivation fails', async () => {
    deactivateAccountMock.mockRejectedValue(new Error('mfa required'))
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToFinalStep(vm)
    await vm.handleFinalConfirm()
    expect(showFailToastMock).toHaveBeenCalled()
    expect(logoutMock).not.toHaveBeenCalled()
    expect(vm.step).toBe('final')
    expect(vm.submitting).toBe(false)
  })

  it('guards against double submission', async () => {
    let resolveDeactivate: (() => void) | undefined
    deactivateAccountMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDeactivate = resolve
        })
    )
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    await goToFinalStep(vm)

    const first = vm.handleFinalConfirm()
    await flushPromises()
    await vm.handleFinalConfirm()
    expect(deactivateAccountMock).toHaveBeenCalledTimes(1)

    resolveDeactivate?.()
    await first
  })

  it('blocks the final confirmation in an empty-MXID session', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    vm.currentUserId = ''
    await goToVerifyStep(vm)
    vm.confirmationInput = ''
    vm.passwordInput = VALID_PASSWORD
    await vm.handleVerifyNext()
    expect(vm.step).toBe('verify')
    expect(verifyPasswordMock).not.toHaveBeenCalled()
    expect(deactivateAccountMock).not.toHaveBeenCalled()
  })
})
