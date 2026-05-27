import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DeviceVerifyDialog from '../DeviceVerifyDialog.vue'

type DeviceVerifyDialogVm = {
  step: 'intro' | 'showKey' | 'showQr' | 'scanQr' | 'success' | 'rejected'
  fingerprint: string
  fingerprintChunks: string[]
  qrCodeData: string
  qrCodeToScan: string
  startVerification: () => Promise<void>
  handleConfirm: () => Promise<void>
  handleReject: () => Promise<void>
  handleClose: () => void
  openQrShow: () => Promise<void>
  openQrScan: () => void
  submitQrScan: () => Promise<void>
  handleCancel: () => Promise<void>
}

const {
  getCurrentSessionContextMock,
  getDeviceFingerprintMock,
  startSasVerificationMock,
  acceptVerificationMock,
  confirmSasMock,
  cancelVerificationMock,
  getPendingVerificationsMock,
  getQrCodeShowMock,
  scanQrCodeMock,
  showFeedbackMock
} = vi.hoisted(() => ({
  getCurrentSessionContextMock: vi.fn(),
  getDeviceFingerprintMock: vi.fn(),
  startSasVerificationMock: vi.fn(),
  acceptVerificationMock: vi.fn(),
  confirmSasMock: vi.fn(),
  cancelVerificationMock: vi.fn(),
  getPendingVerificationsMock: vi.fn(),
  getQrCodeShowMock: vi.fn(),
  scanQrCodeMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const buttonStub = defineComponent({
    name: 'NButton',
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.())
    }
  })

  return {
    NModal: defineComponent({
      name: 'NModal',
      props: {
        show: {
          type: Boolean,
          default: false
        },
        title: {
          type: String,
          default: ''
        }
      },
      emits: ['update:show'],
      setup(props, { slots }) {
        return () => (props.show ? h('div', { 'data-test': 'modal' }, [props.title, slots.default?.()]) : null)
      }
    }),
    NButton: buttonStub,
    NSpin: defineComponent({
      name: 'NSpin',
      props: {
        show: {
          type: Boolean,
          default: false
        }
      },
      setup(_, { slots }) {
        return () => h('div', { 'data-test': 'spin' }, slots.default?.())
      }
    }),
    NQrCode: defineComponent({
      name: 'NQrCode',
      props: {
        value: {
          type: String,
          default: ''
        }
      },
      setup(props) {
        return () => h('div', { 'data-test': 'qr-code' }, props.value)
      }
    }),
    NSteps: defineComponent({
      name: 'NSteps',
      setup(_, { slots }) {
        return () => h('div', { 'data-test': 'steps' }, slots.default?.())
      }
    }),
    NStep: defineComponent({
      name: 'NStep',
      setup() {
        return () => h('div')
      }
    })
  }
})

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    template: '<i data-test="icon" />'
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/composables/encryption', () => ({
  useEncryption: () => ({
    getCurrentSessionContext: getCurrentSessionContextMock,
    getDeviceFingerprint: getDeviceFingerprintMock,
    startSasVerification: startSasVerificationMock,
    acceptVerification: acceptVerificationMock,
    confirmSas: confirmSasMock,
    cancelVerification: cancelVerificationMock,
    getPendingVerifications: getPendingVerificationsMock,
    getQrCodeShow: getQrCodeShowMock,
    scanQrCode: scanQrCodeMock
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'setting.device_verify_dialog.fingerprint_unavailable': '无法获取指纹',
        'setting.device_verify_dialog.load_fingerprint_failed': '获取设备密钥失败',
        'setting.device_verify_dialog.verify_failed': '验证失败',
        'setting.device_verify_dialog.scan_qr_required': '请输入二维码内容',
        'setting.device_verify_dialog.qr_scan_success': '二维码验证成功',
        'setting.device_verify_dialog.qr_scan_failed': '二维码验证失败',
        'setting.device_verify_dialog.qr_load_failed': '二维码加载失败',
        'setting.encryption.verify_success': '设备验证成功'
      }
      return map[key] ?? key
    }
  })
}))

describe('DeviceVerifyDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getCurrentSessionContextMock.mockReturnValue({
      userId: '@alice:example.com',
      deviceId: 'CURRENT_DEVICE',
      isCryptoEnabled: true
    })
    getDeviceFingerprintMock.mockResolvedValue('ABCD1234EFGH5678')
    startSasVerificationMock.mockResolvedValue('txn-123')
    acceptVerificationMock.mockResolvedValue(undefined)
    confirmSasMock.mockResolvedValue(undefined)
    cancelVerificationMock.mockResolvedValue(undefined)
    getPendingVerificationsMock.mockResolvedValue([])
    getQrCodeShowMock.mockResolvedValue({
      qr_code: 'MATRIX-QR-CODE',
      transaction_id: 'txn-qr'
    })
    scanQrCodeMock.mockResolvedValue(true)
  })

  const mountComponent = (props?: Record<string, unknown>) =>
    mount(DeviceVerifyDialog, {
      props: {
        show: true,
        ...props
      }
    })

  it('发起 SAS 验证时加载目标设备指纹', async () => {
    const wrapper = mountComponent({
      deviceId: 'OTHER_DEVICE',
      deviceName: 'Alice iPhone'
    })

    await flushPromises()
    expect(wrapper.text()).toContain('Alice iPhone')

    await (wrapper.vm as unknown as DeviceVerifyDialogVm).startVerification()

    expect(startSasVerificationMock).toHaveBeenCalledWith('@alice:example.com', 'OTHER_DEVICE')
    expect(getDeviceFingerprintMock).toHaveBeenCalledWith('@alice:example.com', 'OTHER_DEVICE')
    expect((wrapper.vm as unknown as DeviceVerifyDialogVm).step).toBe('showKey')
    expect((wrapper.vm as unknown as DeviceVerifyDialogVm).fingerprint).toBe('ABCD1234EFGH5678')
    expect((wrapper.vm as unknown as DeviceVerifyDialogVm).fingerprintChunks).toEqual(['ABCD', '1234', 'EFGH', '5678'])
  })

  it('接受入站验证请求后进入指纹确认', async () => {
    const wrapper = mountComponent({
      inboundRequest: {
        transactionId: 'txn-inbound',
        userId: '@alice:example.com',
        deviceId: 'OTHER_DEVICE',
        methods: ['m.sas.v1'],
        timestamp: Date.now()
      }
    })

    await flushPromises()
    await (wrapper.vm as unknown as DeviceVerifyDialogVm).startVerification()

    expect(acceptVerificationMock).toHaveBeenCalledWith('txn-inbound')
    expect(getDeviceFingerprintMock).toHaveBeenCalledWith('@alice:example.com', 'OTHER_DEVICE')
    expect((wrapper.vm as unknown as DeviceVerifyDialogVm).step).toBe('showKey')
  })

  it('确认匹配后调用 confirmSas 并发出成功事件', async () => {
    const wrapper = mountComponent({
      deviceId: 'OTHER_DEVICE'
    })

    await flushPromises()
    await (wrapper.vm as unknown as DeviceVerifyDialogVm).startVerification()
    await (wrapper.vm as unknown as DeviceVerifyDialogVm).handleConfirm()

    expect(confirmSasMock).toHaveBeenCalledWith('txn-123')
    expect(showFeedbackMock).toHaveBeenCalledWith('设备验证成功', 'success')
    expect((wrapper.vm as unknown as DeviceVerifyDialogVm).step).toBe('success')
    expect(wrapper.emitted('success')).toBeTruthy()
  })

  it('拒绝或取消验证时会调用取消接口', async () => {
    const wrapper = mountComponent({
      deviceId: 'OTHER_DEVICE'
    })

    await flushPromises()
    await (wrapper.vm as unknown as DeviceVerifyDialogVm).startVerification()
    await (wrapper.vm as unknown as DeviceVerifyDialogVm).handleReject()
    expect(cancelVerificationMock).toHaveBeenCalledWith('txn-123', 'User rejected verification')
    expect((wrapper.vm as unknown as DeviceVerifyDialogVm).step).toBe('rejected')

    await (wrapper.vm as unknown as DeviceVerifyDialogVm).handleCancel()
    expect(cancelVerificationMock).toHaveBeenCalledWith('txn-123', 'User cancelled verification')
    expect(wrapper.emitted('update:show')).toContainEqual([false])
  })

  it('支持二维码展示与扫码提交', async () => {
    const wrapper = mountComponent({
      initialMode: 'qr_show'
    })

    await flushPromises()
    expect(getQrCodeShowMock).toHaveBeenCalled()
    expect((wrapper.vm as unknown as DeviceVerifyDialogVm).step).toBe('showQr')
    expect((wrapper.vm as unknown as DeviceVerifyDialogVm).qrCodeData).toBe('MATRIX-QR-CODE')
    expect(wrapper.find('[data-test="qr-code"]').text()).toBe('MATRIX-QR-CODE')

    ;(wrapper.vm as unknown as DeviceVerifyDialogVm).openQrScan()
    ;(wrapper.vm as unknown as DeviceVerifyDialogVm).qrCodeToScan = 'SCANNED-QR'
    await (wrapper.vm as unknown as DeviceVerifyDialogVm).submitQrScan()

    expect(scanQrCodeMock).toHaveBeenCalledWith('SCANNED-QR')
    expect(showFeedbackMock).toHaveBeenCalledWith('二维码验证成功', 'success')
    expect((wrapper.vm as unknown as DeviceVerifyDialogVm).step).toBe('success')
  })

  it('缺少会话上下文或二维码输入为空时给出错误反馈', async () => {
    getCurrentSessionContextMock.mockReturnValue({
      userId: null,
      deviceId: null,
      isCryptoEnabled: true
    })

    const wrapper = mountComponent()
    await flushPromises()
    await (wrapper.vm as unknown as DeviceVerifyDialogVm).startVerification()

    expect(showFeedbackMock).toHaveBeenCalledWith('获取设备密钥失败', 'error')
    expect((wrapper.vm as unknown as DeviceVerifyDialogVm).step).toBe('rejected')

    ;(wrapper.vm as unknown as DeviceVerifyDialogVm).openQrScan()
    ;(wrapper.vm as unknown as DeviceVerifyDialogVm).qrCodeToScan = '   '
    await (wrapper.vm as unknown as DeviceVerifyDialogVm).submitQrScan()

    expect(showFeedbackMock).toHaveBeenCalledWith('请输入二维码内容', 'warning')
  })
})
