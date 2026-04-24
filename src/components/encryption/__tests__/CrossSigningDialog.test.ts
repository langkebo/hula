import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CrossSigningDialog from '../CrossSigningDialog.vue'

type CrossSigningDialogVm = {
  isSetup: boolean
  masterKeyDisplay: string
  selfSigningKeyDisplay: string
  userSigningKeyDisplay: string
  handleSetup: () => Promise<void>
  handleReset: () => Promise<void>
  handleCopyKeys: () => Promise<void>
  handleClose: () => void
}

const {
  getCrossSigningInfoMock,
  setupCrossSigningMock,
  resetCrossSigningMock,
  messageSuccessMock,
  messageErrorMock,
  writeTextMock
} = vi.hoisted(() => ({
  getCrossSigningInfoMock: vi.fn(),
  setupCrossSigningMock: vi.fn(),
  resetCrossSigningMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  messageErrorMock: vi.fn(),
  writeTextMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')

  return {
    NModal: defineComponent({
      name: 'NModal',
      props: {
        show: { type: Boolean, default: false },
        title: { type: String, default: '' }
      },
      emits: ['update:show'],
      template: '<div v-if="show" data-test="modal"><span>{{ title }}</span><slot /><slot name="footer" /></div>'
    }),
    NButton: defineComponent({
      name: 'NButton',
      template: '<button type="button"><slot /></button>'
    }),
    NTag: defineComponent({
      name: 'NTag',
      template: '<span data-test="tag"><slot /></span>'
    }),
    NDivider: defineComponent({
      name: 'NDivider',
      template: '<hr />'
    }),
    NSpin: defineComponent({
      name: 'NSpin',
      template: '<div data-test="spin"><slot /></div>'
    }),
    NFlex: defineComponent({
      name: 'NFlex',
      template: '<div data-test="flex"><slot /></div>'
    }),
    useMessage: () => ({
      success: messageSuccessMock,
      error: messageErrorMock
    })
  }
})

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    template: '<i data-test="icon" />'
  }
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionService', () => ({
  matrixEncryptionService: {
    getCrossSigningInfo: getCrossSigningInfoMock,
    setupCrossSigning: setupCrossSigningMock,
    resetCrossSigning: resetCrossSigningMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn()
  })
}))

describe('CrossSigningDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getCrossSigningInfoMock.mockResolvedValue({
      isSetup: false,
      masterPublicKey: null,
      selfSigningPublicKey: null,
      userSigningPublicKey: null
    })
    setupCrossSigningMock.mockResolvedValue(undefined)
    resetCrossSigningMock.mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock
      },
      writable: true,
      configurable: true
    })
  })

  const mountComponent = (show = true) =>
    mount(CrossSigningDialog, {
      props: {
        show
      }
    })

  it('在首次挂载且 show=true 时立即加载交叉签名信息', async () => {
    getCrossSigningInfoMock.mockResolvedValueOnce({
      isSetup: true,
      masterPublicKey: '1234567890abcdef1234567890abcdef',
      selfSigningPublicKey: 'self-signing-key',
      userSigningPublicKey: 'user-signing-key'
    })

    const wrapper = mountComponent(true)

    await flushPromises()

    expect(getCrossSigningInfoMock).toHaveBeenCalled()
    expect((wrapper.vm as unknown as CrossSigningDialogVm).isSetup).toBe(true)
    expect((wrapper.vm as unknown as CrossSigningDialogVm).masterKeyDisplay).toBe('12345678...90abcdef')
    expect((wrapper.vm as unknown as CrossSigningDialogVm).selfSigningKeyDisplay).toBe('self-signing-key')
    expect((wrapper.vm as unknown as CrossSigningDialogVm).userSigningKeyDisplay).toBe('user-signing-key')
    expect(wrapper.text()).toContain('encryption.cross_signing.setup')
  })

  it('支持设置和重置交叉签名并刷新状态', async () => {
    getCrossSigningInfoMock
      .mockResolvedValueOnce({
        isSetup: false,
        masterPublicKey: null,
        selfSigningPublicKey: null,
        userSigningPublicKey: null
      })
      .mockResolvedValueOnce({
        isSetup: true,
        masterPublicKey: 'master-key',
        selfSigningPublicKey: 'self-key',
        userSigningPublicKey: 'user-key'
      })
      .mockResolvedValueOnce({
        isSetup: false,
        masterPublicKey: null,
        selfSigningPublicKey: null,
        userSigningPublicKey: null
      })

    const wrapper = mountComponent(true)

    await flushPromises()
    await (wrapper.vm as unknown as CrossSigningDialogVm).handleSetup()
    await (wrapper.vm as unknown as CrossSigningDialogVm).handleReset()

    expect(setupCrossSigningMock).toHaveBeenCalled()
    expect(resetCrossSigningMock).toHaveBeenCalled()
    expect(messageSuccessMock).toHaveBeenCalledWith('encryption.cross_signing.setup_success')
    expect(messageSuccessMock).toHaveBeenCalledWith('encryption.cross_signing.reset_success')
    expect(getCrossSigningInfoMock).toHaveBeenCalledTimes(3)
  })

  it('支持复制公钥并在失败时给出提示', async () => {
    writeTextMock.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('copy failed'))
    getCrossSigningInfoMock.mockResolvedValueOnce({
      isSetup: true,
      masterPublicKey: 'master-key',
      selfSigningPublicKey: 'self-key',
      userSigningPublicKey: 'user-key'
    })

    const wrapper = mountComponent(true)

    await flushPromises()
    await (wrapper.vm as unknown as CrossSigningDialogVm).handleCopyKeys()
    await (wrapper.vm as unknown as CrossSigningDialogVm).handleCopyKeys()

    expect(writeTextMock).toHaveBeenCalledWith(
      'Master Key: master-key\nSelf-Signing Key: self-key\nUser-Signing Key: user-key'
    )
    expect(messageSuccessMock).toHaveBeenCalledWith('encryption.cross_signing.copied')
    expect(messageErrorMock).toHaveBeenCalledWith('encryption.cross_signing.copy_failed')
  })

  it('在设置、重置和加载失败时保留兜底状态', async () => {
    getCrossSigningInfoMock.mockRejectedValueOnce(new Error('load failed'))

    const wrapper = mountComponent(true)

    await flushPromises()
    expect((wrapper.vm as unknown as CrossSigningDialogVm).isSetup).toBe(false)

    setupCrossSigningMock.mockRejectedValueOnce(new Error('setup failed'))
    resetCrossSigningMock.mockRejectedValueOnce(new Error('reset failed'))

    await (wrapper.vm as unknown as CrossSigningDialogVm).handleSetup()
    await (wrapper.vm as unknown as CrossSigningDialogVm).handleReset()

    expect(messageErrorMock).toHaveBeenCalledWith('encryption.cross_signing.setup_failed')
    expect(messageErrorMock).toHaveBeenCalledWith('encryption.cross_signing.reset_failed')
  })

  it('支持关闭弹窗', async () => {
    const wrapper = mountComponent(true)

    await flushPromises()
    ;(wrapper.vm as unknown as CrossSigningDialogVm).handleClose()

    expect(wrapper.emitted('update:show')).toEqual([[false]])
  })
})
