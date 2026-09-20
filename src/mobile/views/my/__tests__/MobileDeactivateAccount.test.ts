import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobileDeactivateAccount from '../MobileDeactivateAccount.vue'

/**
 * 账号注销三重确认（方案 P0）。
 *
 * 缺口背景：移动端 `SecuritySettings.vue` 的注销只有**单次**确认对话框，
 * 方案要求「三层确认流程」。注销不可撤销，确认强度不足是真实的误操作风险。
 *
 * 三步设计（每步都能独立取消）：
 * 1. 后果说明 + 勾选「我已了解」
 * 2. 输入自己的 MXID 原文（复制粘贴 MXID 属于有意行为，且不会被误触）
 * 3. 最终确认对话框，并选择是否同时抹除数据（erase）
 */

const {
  showToastMock,
  showConfirmDialogMock,
  showFailToastMock,
  deactivateAccountMock,
  logoutMock,
  routerReplaceMock
} = vi.hoisted(() => ({
  showToastMock: vi.fn(),
  showConfirmDialogMock: vi.fn(),
  showFailToastMock: vi.fn(),
  deactivateAccountMock: vi.fn(),
  logoutMock: vi.fn(),
  routerReplaceMock: vi.fn()
}))

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
    deactivateAccount: (...args: any[]) => deactivateAccountMock(...args)
  }
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => ({ userId: '@alice:example.org' })
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

describe('MobileDeactivateAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    showConfirmDialogMock.mockResolvedValue(undefined)
    deactivateAccountMock.mockResolvedValue(undefined)
    logoutMock.mockResolvedValue(undefined)
  })

  it('renders correctly', () => {
    expect(mountPage().html()).toBeTruthy()
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
    vm.acknowledged = true
    await vm.handleConsequencesNext()
    expect(vm.step).toBe('verify')
  })

  it('exposes the current MXID for the verification prompt', () => {
    const vm = mountPage().vm as any
    expect(vm.currentUserId).toBe('@alice:example.org')
  })

  it('rejects a mismatched MXID without deactivating', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    vm.acknowledged = true
    await vm.handleConsequencesNext()
    vm.confirmationInput = '@someone-else:example.org'
    await vm.handleVerifyNext()
    expect(vm.step).toBe('verify')
    expect(deactivateAccountMock).not.toHaveBeenCalled()
    expect(showConfirmDialogMock).not.toHaveBeenCalled()
    expect(showFailToastMock).toHaveBeenCalled()
  })

  it('treats a whitespace-padded MXID as matching', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    vm.acknowledged = true
    await vm.handleConsequencesNext()
    vm.confirmationInput = '  @alice:example.org  '
    await vm.handleVerifyNext()
    expect(vm.step).toBe('final')
  })

  it('advances to the final step on a matching MXID', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    vm.acknowledged = true
    await vm.handleConsequencesNext()
    vm.confirmationInput = '@alice:example.org'
    await vm.handleVerifyNext()
    expect(vm.step).toBe('final')
  })

  it('deactivates only after the final confirmation', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    vm.acknowledged = true
    await vm.handleConsequencesNext()
    vm.confirmationInput = '@alice:example.org'
    await vm.handleVerifyNext()
    await vm.handleFinalConfirm()
    expect(showConfirmDialogMock).toHaveBeenCalled()
    expect(deactivateAccountMock).toHaveBeenCalled()
  })

  it('passes the erase choice through to the service', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    vm.acknowledged = true
    await vm.handleConsequencesNext()
    vm.confirmationInput = '@alice:example.org'
    await vm.handleVerifyNext()
    vm.eraseData = true
    await vm.handleFinalConfirm()
    expect(deactivateAccountMock).toHaveBeenCalledWith(undefined, true)
  })

  it('defaults eraseData to false', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    vm.acknowledged = true
    await vm.handleConsequencesNext()
    vm.confirmationInput = '@alice:example.org'
    await vm.handleVerifyNext()
    await vm.handleFinalConfirm()
    expect(deactivateAccountMock).toHaveBeenCalledWith(undefined, false)
  })

  it('does nothing when the final dialog is cancelled', async () => {
    showConfirmDialogMock.mockRejectedValue('cancel')
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    vm.acknowledged = true
    await vm.handleConsequencesNext()
    vm.confirmationInput = '@alice:example.org'
    await vm.handleVerifyNext()
    await vm.handleFinalConfirm()
    expect(deactivateAccountMock).not.toHaveBeenCalled()
    expect(vm.step).toBe('final')
  })

  it('logs out and leaves after a successful deactivation', async () => {
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    vm.acknowledged = true
    await vm.handleConsequencesNext()
    vm.confirmationInput = '@alice:example.org'
    await vm.handleVerifyNext()
    await vm.handleFinalConfirm()
    expect(logoutMock).toHaveBeenCalled()
    expect(routerReplaceMock).toHaveBeenCalledWith('/mobile/login')
  })

  it('surfaces a failure toast and stays put when deactivation fails', async () => {
    deactivateAccountMock.mockRejectedValue(new Error('mfa required'))
    const wrapper = mountPage()
    const vm = wrapper.vm as any
    vm.acknowledged = true
    await vm.handleConsequencesNext()
    vm.confirmationInput = '@alice:example.org'
    await vm.handleVerifyNext()
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
    vm.acknowledged = true
    await vm.handleConsequencesNext()
    vm.confirmationInput = '@alice:example.org'
    await vm.handleVerifyNext()

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
    vm.acknowledged = true
    await vm.handleConsequencesNext()
    vm.confirmationInput = ''
    await vm.handleVerifyNext()
    expect(vm.step).toBe('verify')
    expect(deactivateAccountMock).not.toHaveBeenCalled()
  })
})
