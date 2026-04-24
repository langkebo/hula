import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EncryptionSettings from '../EncryptionSettings.vue'

const {
  getCurrentSessionContextMock,
  getCurrentDeviceFingerprintMock,
  getKeyBackupInfoMock,
  getCrossSigningInfoMock,
  getKeyRotationStatusMock,
  isDeviceVerifiedMock,
  messageSuccessMock,
  messageWarningMock,
  loggerErrorMock,
  writeTextMock
} = vi.hoisted(() => ({
  getCurrentSessionContextMock: vi.fn(),
  getCurrentDeviceFingerprintMock: vi.fn(),
  getKeyBackupInfoMock: vi.fn(),
  getCrossSigningInfoMock: vi.fn(),
  getKeyRotationStatusMock: vi.fn(),
  isDeviceVerifiedMock: vi.fn(),
  messageSuccessMock: vi.fn(),
  messageWarningMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  writeTextMock: vi.fn()
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({
    error: loggerErrorMock
  }))
}))

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    template: '<i data-test="icon" />'
  }
}))

vi.mock('@/services/matrix', () => ({
  matrixEncryptionContextService: {
    getCurrentSessionContext: getCurrentSessionContextMock,
    getCurrentDeviceFingerprint: getCurrentDeviceFingerprintMock
  },
  matrixEncryptionService: {
    getKeyBackupInfo: getKeyBackupInfoMock,
    getCrossSigningInfo: getCrossSigningInfoMock,
    getKeyRotationStatus: getKeyRotationStatusMock
  },
  matrixVerificationService: {
    isDeviceVerified: isDeviceVerifiedMock
  }
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthroughStub = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  const NButton = defineComponent({
    name: 'NButton',
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () =>
        h(
          'button',
          {
            type: 'button',
            onClick: () => emit('click')
          },
          slots.default?.()
        )
    }
  })

  const NSwitch = defineComponent({
    name: 'NSwitch',
    props: {
      value: {
        type: Boolean,
        default: false
      },
      disabled: {
        type: Boolean,
        default: false
      }
    },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h(
          'button',
          {
            type: 'button',
            disabled: props.disabled,
            'data-test': 'backup-switch',
            onClick: () => emit('update:value', !props.value)
          },
          'switch'
        )
    }
  })

  const NModal = defineComponent({
    name: 'NModal',
    props: {
      show: {
        type: Boolean,
        default: false
      }
    },
    setup(props, { slots }) {
      return () => (props.show ? h('div', { 'data-test': 'modal' }, slots.default?.()) : null)
    }
  })

  return {
    NSwitch,
    NButton,
    NDivider: passthroughStub('NDivider'),
    NTag: passthroughStub('NTag'),
    NModal,
    useMessage: () => ({
      success: messageSuccessMock,
      warning: messageWarningMock
    })
  }
})

vi.mock('@/components/encryption/KeyBackupSetupDialog.vue', () => ({
  default: {
    name: 'KeyBackupSetupDialog',
    props: ['show'],
    emits: ['update:show', 'success'],
    template:
      '<div data-test="backup-dialog"><button type="button" data-test="backup-success" @click="$emit(\'success\')">backup-success</button></div>'
  }
}))

vi.mock('@/components/encryption/KeyBackupRestoreDialog.vue', () => ({
  default: {
    name: 'KeyBackupRestoreDialog',
    props: ['show'],
    emits: ['update:show', 'success'],
    template:
      '<div data-test="restore-dialog"><button type="button" data-test="restore-success" @click="$emit(\'success\')">restore-success</button></div>'
  }
}))

vi.mock('@/components/encryption/DeviceVerifyDialog.vue', () => ({
  default: {
    name: 'DeviceVerifyDialog',
    props: ['show'],
    emits: ['update:show', 'success'],
    template:
      '<div data-test="verify-dialog"><button type="button" data-test="verify-success" @click="$emit(\'success\')">verify-success</button></div>'
  }
}))

vi.mock('@/components/encryption/CrossSigningDialog.vue', () => ({
  default: {
    name: 'CrossSigningDialog',
    props: ['show'],
    template: '<div data-test="cross-signing-dialog" />'
  }
}))

vi.mock('@/components/encryption/KeyRotationDialog.vue', () => ({
  default: {
    name: 'KeyRotationDialog',
    props: ['show'],
    template: '<div data-test="rotation-dialog" />'
  }
}))

describe('EncryptionSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock
      }
    })

    getCurrentSessionContextMock.mockReturnValue({
      userId: '@alice:example.com',
      deviceId: 'DEVICE123',
      isCryptoEnabled: true
    })
    getCurrentDeviceFingerprintMock.mockResolvedValue('ABCD1234EFGH5678')
    getKeyBackupInfoMock.mockResolvedValue({
      version: '2',
      algorithm: 'm.megolm.backup.v1',
      authData: {},
      count: 1,
      etag: 'etag'
    })
    getCrossSigningInfoMock.mockResolvedValue({ isSetup: true })
    getKeyRotationStatusMock.mockResolvedValue({ enabled: true, intervalMs: 1, needsRotation: true })
    isDeviceVerifiedMock.mockResolvedValue(true)
  })

  const mountComponent = () => mount(EncryptionSettings)

  it('加载加密信息并展示设备状态', async () => {
    const wrapper = mountComponent()

    await flushPromises()

    expect(getCurrentSessionContextMock).toHaveBeenCalled()
    expect(isDeviceVerifiedMock).toHaveBeenCalledWith('@alice:example.com', 'DEVICE123')
    expect(wrapper.text()).toContain('已设置并备份')
    expect(wrapper.text()).toContain('已设置')
    expect(wrapper.text()).toContain('需要轮换')
    expect(wrapper.text()).toContain('此设备已验证')
    expect((wrapper.vm as any).deviceFingerprint).toBe('ABCD 1234 EFGH 5678')
  })

  it('支持处理备份、恢复、验证和复制指纹操作', async () => {
    const wrapper = mountComponent()

    await flushPromises()

    ;(wrapper.vm as any).handleCreateBackup()
    ;(wrapper.vm as any).handleRestoreBackup()
    ;(wrapper.vm as any).handleVerifyDevice()
    await wrapper.get('[data-test="backup-success"]').trigger('click')
    await wrapper.get('[data-test="restore-success"]').trigger('click')
    await wrapper.get('[data-test="verify-success"]').trigger('click')
    ;(wrapper.vm as any).handleShowDeviceKey()
    await flushPromises()
    const copyButton = wrapper.findAll('button').find((item) => item.text() === '复制')
    if (!copyButton) {
      throw new Error('复制按钮不存在')
    }
    await copyButton.trigger('click')

    expect((wrapper.vm as any).backupEnabled).toBe(true)
    expect((wrapper.vm as any).deviceVerified).toBe(true)
    expect((wrapper.vm as any).deviceKeyVisible).toBe(true)
    expect(messageSuccessMock).toHaveBeenCalledWith('备份创建成功')
    expect(messageSuccessMock).toHaveBeenCalledWith('密钥恢复成功')
    expect(messageSuccessMock).toHaveBeenCalledWith('设备验证成功')
    expect(writeTextMock).toHaveBeenCalledWith('ABCD1234EFGH5678')
  })

  it('在加密未启用和指纹缺失时走降级逻辑', async () => {
    getCurrentSessionContextMock.mockReturnValue({
      userId: null,
      deviceId: null,
      isCryptoEnabled: false
    })
    getCurrentDeviceFingerprintMock.mockResolvedValue(null)

    const wrapper = mountComponent()

    await flushPromises()
    ;(wrapper.vm as any).handleBackupToggle(true)
    ;(wrapper.vm as any).handleShowDeviceKey()
    await flushPromises()

    expect(wrapper.text()).toContain('加密未启用')
    expect(messageWarningMock).toHaveBeenCalledWith('请先启用加密功能')
    expect((wrapper.vm as any).backupEnabled).toBe(false)
    expect((wrapper.vm as any).deviceFingerprint).toContain('XXXX')
  })

  it('在加载失败时记录错误', async () => {
    getCrossSigningInfoMock.mockRejectedValueOnce(new Error('load failed'))

    mountComponent()
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
  })
})
