import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DeviceVerifyDialog from '../DeviceVerifyDialog.vue'

const {
  getCurrentSessionContextMock,
  getDeviceFingerprintMock,
  trustDeviceMock,
  messageSuccessMock,
  messageErrorMock
} = vi.hoisted(() => ({
  getCurrentSessionContextMock: vi.fn(),
  getDeviceFingerprintMock: vi.fn(),
  trustDeviceMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  messageErrorMock: vi.fn()
}))

vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')

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
      template: '<div v-if="show" data-test="modal"><span>{{ title }}</span><slot /></div>'
    }),
    NButton: defineComponent({
      name: 'NButton',
      template: '<button type="button"><slot /></button>'
    }),
    NSpin: defineComponent({
      name: 'NSpin',
      props: {
        show: {
          type: Boolean,
          default: false
        }
      },
      template: '<div data-test="spin"><slot /></div>'
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

vi.mock('@/services/matrix', () => ({
  matrixEncryptionContextService: {
    getCurrentSessionContext: getCurrentSessionContextMock,
    getDeviceFingerprint: getDeviceFingerprintMock
  },
  matrixEncryptionService: {
    trustDevice: trustDeviceMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn()
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
    trustDeviceMock.mockResolvedValue(undefined)
  })

  const mountComponent = (props?: Record<string, unknown>) =>
    mount(DeviceVerifyDialog, {
      props: {
        show: true,
        ...props
      }
    })

  it('挂载后读取会话上下文并展示目标设备指纹', async () => {
    const wrapper = mountComponent({
      deviceId: 'OTHER_DEVICE',
      deviceName: 'Alice iPhone'
    })

    await flushPromises()

    expect((wrapper.vm as any).userId).toBe('@alice:example.com')
    expect(wrapper.text()).toContain('Alice iPhone')
    await (wrapper.vm as any).startVerification()

    expect(getDeviceFingerprintMock).toHaveBeenCalledWith('@alice:example.com', 'OTHER_DEVICE')
    expect((wrapper.vm as any).step).toBe('showKey')
    expect((wrapper.vm as any).fingerprint).toBe('ABCD1234EFGH5678')
    expect((wrapper.vm as any).fingerprintChunks).toEqual(['ABCD', '1234', 'EFGH', '5678'])
  })

  it('在未传 deviceId 时回退使用当前设备并处理空指纹', async () => {
    getDeviceFingerprintMock.mockResolvedValue(null)

    const wrapper = mountComponent()

    await flushPromises()
    await (wrapper.vm as any).startVerification()

    expect(getDeviceFingerprintMock).toHaveBeenCalledWith('@alice:example.com', 'CURRENT_DEVICE')
    expect((wrapper.vm as any).fingerprint).toBe('无法获取指纹')
    expect((wrapper.vm as any).step).toBe('showKey')
  })

  it('确认匹配后信任设备并进入成功态', async () => {
    const wrapper = mountComponent({
      deviceId: 'OTHER_DEVICE'
    })

    await flushPromises()
    await (wrapper.vm as any).handleConfirm()

    expect(trustDeviceMock).toHaveBeenCalledWith('@alice:example.com', 'OTHER_DEVICE')
    expect((wrapper.vm as any).step).toBe('success')
    expect(messageSuccessMock).toHaveBeenCalledWith('设备验证成功')
  })

  it('拒绝匹配和关闭时重置状态并关闭弹窗', async () => {
    const wrapper = mountComponent({
      deviceId: 'OTHER_DEVICE'
    })

    await flushPromises()
    await (wrapper.vm as any).startVerification()
    ;(wrapper.vm as any).handleReject()

    expect((wrapper.vm as any).step).toBe('rejected')

    ;(wrapper.vm as any).handleClose()

    expect((wrapper.vm as any).step).toBe('intro')
    expect((wrapper.vm as any).fingerprint).toBe('')
    expect(wrapper.emitted('update:show')).toEqual([[false]])
  })

  it('在设备上下文缺失或验证失败时提示错误', async () => {
    getCurrentSessionContextMock.mockReturnValue({
      userId: null,
      deviceId: null,
      isCryptoEnabled: true
    })

    const wrapper = mountComponent()

    await flushPromises()
    await (wrapper.vm as any).startVerification()

    expect(messageErrorMock).toHaveBeenCalledWith('获取设备密钥失败')
    expect((wrapper.vm as any).step).toBe('intro')

    getCurrentSessionContextMock.mockReturnValue({
      userId: '@alice:example.com',
      deviceId: 'OTHER_DEVICE',
      isCryptoEnabled: true
    })
    trustDeviceMock.mockRejectedValueOnce(new Error('trust failed'))

    await (wrapper.vm as any).handleConfirm()

    expect(messageErrorMock).toHaveBeenCalledWith('验证失败')
  })
})
