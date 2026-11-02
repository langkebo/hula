import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EncryptionSettings from '../EncryptionSettings.vue'

const translationMap: Record<string, string> = {
  'setting.encryption.key_section': '加密密钥',
  'setting.encryption.key_status_title': '加密密钥状态',
  'setting.encryption.backup_section': '安全备份',
  'setting.encryption.backup_enable_label': '启用安全备份',
  'setting.encryption.backup_enable_desc': '将加密密钥备份到服务器',
  'setting.encryption.backup_version_label': '备份版本',
  'setting.encryption.backup_version_desc': '当前备份版本: {version}',
  'setting.encryption.create_backup': '创建新备份',
  'setting.encryption.restore_key_label': '恢复密钥',
  'setting.encryption.restore_key_desc': '使用恢复密钥还原加密消息',
  'setting.encryption.restore': '恢复',
  'setting.encryption.cross_signing_section': '交叉签名',
  'setting.encryption.cross_signing_status_label': '交叉签名状态',
  'setting.encryption.setup_complete': '已设置',
  'setting.encryption.setup_incomplete': '未设置',
  'setting.encryption.manage': '管理',
  'setting.encryption.setup_action': '设置',
  // R-2（2026-10-12）
  'setting.encryption.cross_signing_storage_label': '私钥存储（4S）',
  'setting.encryption.cross_signing_storage_ok': '已存入密钥存储',
  'setting.encryption.cross_signing_storage_missing': '尚未存入密钥存储',
  'setting.encryption.cross_signing_store_action': '立即存入',
  'setting.encryption.cross_signing_local_only_hint': '交叉签名私钥目前只保存在本设备，建议立即存入密钥存储。',
  'setting.encryption.cross_signing_store_success': '交叉签名私钥已存入密钥存储',
  'setting.encryption.cross_signing_store_failed': '存入密钥存储失败，请稍后重试',
  'setting.encryption.cross_signing_store_needs_setup': '尚未配置密钥存储，请先完成安全密钥设置',
  'setting.encryption.rotation_section': '密钥轮换',
  'setting.encryption.rotation_status_label': '密钥轮换状态',
  'setting.encryption.rotation_needed': '需要轮换',
  'setting.encryption.rotation_up_to_date': '已是最新',
  'setting.encryption.device_section': '设备验证',
  'setting.encryption.verify_status_label': '验证状态',
  'setting.encryption.this_device_verified': '此设备已验证',
  'setting.encryption.this_device_unverified': '此设备未验证',
  'setting.encryption.verify_device_action': '验证设备',
  'setting.encryption.qr_verify_label': '二维码验证',
  'setting.encryption.qr_verify_desc': '通过显示或扫描二维码完成跨设备验证',
  'setting.encryption.pending_verifications_label': '待处理验证请求',
  'setting.encryption.pending_verification_cancelled': '已取消待处理验证',
  'setting.encryption.pending_verification_cancel_failed': '取消待处理验证失败',
  'setting.encryption.verified': '已验证',
  'setting.encryption.device_key_label': '设备密钥',
  'setting.encryption.device_key_desc': '查看此设备的加密密钥指纹',
  'setting.encryption.view': '查看',
  'setting.encryption.info_section': '加密信息',
  'setting.encryption.algorithm_label': '加密算法',
  'setting.encryption.verified_devices_label': '已验证设备',
  'setting.encryption.unverified_devices_label': '未验证设备',
  'setting.encryption.device_count': '{count} 个',
  'setting.encryption.device_key_fingerprint_title': '设备密钥指纹',
  'setting.encryption.copy': '复制',
  'setting.encryption.fingerprint_hint': '此指纹用于验证设备身份，请确保与登录时显示的指纹一致',
  'setting.encryption.key_status_disabled': '加密未启用',
  'setting.encryption.key_status_backed_up': '已设置并备份',
  'setting.encryption.key_status_ready': '已设置',
  'setting.encryption.disabled': '未启用',
  'setting.encryption.enable_required': '请先启用加密功能',
  'setting.encryption.backup_disabled_feedback': '已禁用安全备份',
  'setting.encryption.backup_created': '备份创建成功',
  'setting.encryption.restore_success': '密钥恢复成功',
  'setting.encryption.verify_success': '设备验证成功',
  'setting.encryption.copied': '已复制到剪贴板',
  'setting.encryption.device_verify_dialog.show_qr': '显示二维码',
  'setting.encryption.device_verify_dialog.scan_qr': '扫描二维码',
  'setting.encryption.device_verify_dialog.accept_request': '接受请求',
  'setting.encryption.server_unsupported': '当前服务器未启用端到端加密，本页为只读。',
  'setting.encryption.dehydrated_device_section': '脱水设备',
  'setting.encryption.dehydrated_device_label': '脱水设备',
  'setting.encryption.dehydrated_device_desc': '管理用于离线密钥存储的脱水设备',
  'encryption.dehydrated_device.unsupported': '当前加密后端不支持脱水设备，入口已禁用'
}

const {
  getCurrentSessionContextMock,
  getCurrentDeviceFingerprintMock,
  getKeyBackupInfoMock,
  getCrossSigningInfoMock,
  getKeyRotationStatusMock,
  isDeviceVerifiedMock,
  getPendingVerificationsMock,
  cancelVerificationMock,
  encryptionStoreState,
  messageSuccessMock,
  messageWarningMock,
  loggerErrorMock,
  writeTextMock,
  capabilityState,
  isDehydratedSupportedMock
} = vi.hoisted(() => ({
  getCurrentSessionContextMock: vi.fn(),
  getCurrentDeviceFingerprintMock: vi.fn(),
  getKeyBackupInfoMock: vi.fn(),
  getCrossSigningInfoMock: vi.fn(),
  getKeyRotationStatusMock: vi.fn(),
  isDeviceVerifiedMock: vi.fn(),
  getPendingVerificationsMock: vi.fn(),
  cancelVerificationMock: vi.fn(),
  encryptionStoreState: {
    encryptionEnabled: true,
    securityKeyConfigured: true,
    crossSigningSetup: true,
    // R-2：私钥存储（4S）状态；默认「未在 4S 且本机没有私钥」= 不提示
    crossSigningKeysInSecretStorage: false,
    crossSigningKeysLocalOnly: false,
    backupEnabled: true,
    backupVersion: '2',
    needsRotation: true,
    deviceVerified: true,
    e2eeFullySetup: true,
    async loadEncryptionStatus() {},
    async loadDeviceVerification() {},
    async loadRotationStatus() {
      this.needsRotation = (await getKeyRotationStatusMock())?.needsRotation ?? false
    },
    markBackupEnabled(version?: string) {
      this.backupEnabled = true
      this.backupVersion = version ?? this.backupVersion
    },
    markDeviceVerified() {
      this.deviceVerified = true
    },
    markSecurityKeyConfigured() {
      this.securityKeyConfigured = true
    },
    // R-2：安全密钥流程成功后组件会重读交叉签名状态（让警告收敛）
    loadCrossSigningStatus: vi.fn(async () => undefined),
    // R-2：默认「已存入」；需要走其他分支时用 mockResolvedValueOnce
    storeCrossSigningKeysInSecretStorage: vi.fn(async () => 'stored')
  },
  messageSuccessMock: vi.fn(),
  messageWarningMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  writeTextMock: vi.fn(),
  capabilityState: {
    loaded: false,
    e2ee: true
  },
  isDehydratedSupportedMock: vi.fn(() => true)
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: loggerErrorMock
  }))
}))

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    template: '<i data-test="icon" />'
  }
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionContextService', () => ({
  matrixEncryptionContextService: {
    getCurrentSessionContext: getCurrentSessionContextMock,
    getCurrentDeviceFingerprint: getCurrentDeviceFingerprintMock
  }
}))

// 能力门控：加密页在服务端未启用 E2EE 时降级为只读
vi.mock('@/services/matrix/MatrixCapabilityService', () => ({
  useServerCapability: () => ({
    isLoaded: { value: capabilityState.loaded },
    canUseE2EE: { value: capabilityState.e2ee }
  })
}))

// 脱水设备入口按 isSupported() 决定是否渲染
vi.mock('@/services/matrix/crypto/MatrixDehydratedDeviceService', () => ({
  matrixDehydratedDeviceService: {
    isSupported: isDehydratedSupportedMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixEncryptionService', () => ({
  matrixEncryptionService: {
    getKeyBackupInfo: getKeyBackupInfoMock,
    getCrossSigningInfo: getCrossSigningInfoMock,
    getKeyRotationStatus: getKeyRotationStatusMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixVerificationService', () => ({
  matrixVerificationService: {
    isDeviceVerified: isDeviceVerifiedMock,
    getPendingVerifications: getPendingVerificationsMock,
    cancelVerification: cancelVerificationMock
  }
}))

vi.mock('@/stores/domains/settings/encryption', () => ({
  useEncryptionStore: () => {
    const { reactive } = require('vue') as typeof import('vue')
    return reactive(encryptionStoreState)
  }
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

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: (message: string, type: 'success' | 'warning' | 'error') => {
      if (type === 'success') {
        messageSuccessMock(message)
        return
      }
      messageWarningMock(message)
    }
  })
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
            'data-value': String(props.value),
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
    emits: ['updated'],
    template:
      '<div data-test="rotation-dialog"><button type="button" data-test="rotation-updated" @click="$emit(\'updated\')">rotation-updated</button></div>'
  }
}))

vi.mock('@/components/encryption/SecureBackupDialog.vue', () => ({
  default: {
    name: 'SecureBackupDialog',
    props: ['show'],
    emits: ['update:show', 'success'],
    template: '<div data-test="secure-backup-dialog" />'
  }
}))

vi.mock('@/components/encryption/SecurityKeySetupDialog.vue', () => ({
  default: {
    name: 'SecurityKeySetupDialog',
    props: ['show'],
    emits: ['update:show', 'success'],
    template: '<div data-test="security-key-dialog" />'
  }
}))

vi.mock('@/components/encryption/E2EEOnboardingDialog.vue', () => ({
  default: {
    name: 'E2EEOnboardingDialog',
    props: ['show'],
    emits: ['update:show', 'complete', 'skip'],
    template: '<div data-test="e2ee-onboarding-dialog" />'
  }
}))

vi.mock('@/components/encryption/DeviceTrustManager.vue', () => ({
  default: {
    name: 'DeviceTrustManager',
    props: ['show'],
    emits: ['update:show'],
    template: '<div data-test="device-trust-manager" />'
  }
}))

vi.mock('@/components/encryption/DehydratedDeviceManager.vue', () => ({
  default: {
    name: 'DehydratedDeviceManager',
    props: ['show'],
    emits: ['update:show'],
    template: '<div data-test="dehydrated-device-manager" />'
  }
}))

vi.mock('@/components/encryption/E2EEBootstrapWizard.vue', () => ({
  default: {
    name: 'E2EEBootstrapWizard',
    props: ['show'],
    emits: ['update:show', 'complete', 'skip'],
    template: '<div data-test="e2ee-bootstrap-wizard" />'
  }
}))

describe('EncryptionSettings', () => {
  beforeEach(() => {
    // R-1 起本组件读取 `useSettingStore().blockUnverifiedDevicesEnabled`，
    // 故渲染前必须有 active pinia。
    setActivePinia(createPinia())
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
    encryptionStoreState.encryptionEnabled = true
    encryptionStoreState.securityKeyConfigured = true
    encryptionStoreState.crossSigningSetup = true
    encryptionStoreState.crossSigningKeysInSecretStorage = false
    encryptionStoreState.crossSigningKeysLocalOnly = false
    encryptionStoreState.backupEnabled = true
    encryptionStoreState.backupVersion = '2'
    encryptionStoreState.needsRotation = true
    encryptionStoreState.deviceVerified = true
    encryptionStoreState.e2eeFullySetup = true
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
    getPendingVerificationsMock.mockResolvedValue([
      {
        transactionId: 'txn-inbound',
        userId: '@alice:example.com',
        deviceId: 'OTHER_DEVICE',
        methods: ['m.sas.v1'],
        timestamp: Date.now()
      }
    ])
    cancelVerificationMock.mockResolvedValue(undefined)
    capabilityState.loaded = false
    capabilityState.e2ee = true
    isDehydratedSupportedMock.mockReturnValue(true)
  })

  const mountComponent = () => mount(EncryptionSettings)

  it('加载加密信息并展示设备状态', async () => {
    const wrapper = mountComponent()

    await flushPromises()

    expect(getCurrentDeviceFingerprintMock).toHaveBeenCalled()
    expect(getPendingVerificationsMock).toHaveBeenCalled()
    expect(wrapper.text()).toContain('已设置并备份')
    expect(wrapper.text()).toContain('已设置')
    expect(wrapper.text()).toContain('需要轮换')
    expect(wrapper.text()).toContain('此设备已验证')
    expect(wrapper.text()).toContain('待处理验证请求')
    expect(wrapper.text()).toContain('OTHER_DEVICE')
    expect((wrapper.vm as any).deviceFingerprint).toBe('ABCD 1234 EFGH 5678')
  })

  it('支持处理备份、恢复、验证、二维码入口和复制指纹操作', async () => {
    const wrapper = mountComponent()

    await flushPromises()

    ;(wrapper.vm as any).handleCreateBackup()
    ;(wrapper.vm as any).handleRestoreBackup()
    ;(wrapper.vm as any).handleVerifyDevice()
    ;(wrapper.vm as any).openVerifyDialog('qr_show')
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
    expect((wrapper.vm as any).verifyDialogMode).toBe('qr_show')
    expect(messageSuccessMock).toHaveBeenCalledWith('备份创建成功')
    expect(messageSuccessMock).toHaveBeenCalledWith('密钥恢复成功')
    expect(messageSuccessMock).toHaveBeenCalledWith('设备验证成功')
    expect(writeTextMock).toHaveBeenCalledWith('ABCD1234EFGH5678')
  })

  it('支持接受和取消待处理验证请求', async () => {
    const wrapper = mountComponent()

    await flushPromises()
    expect(wrapper.text()).toContain('接受请求')

    await (wrapper.vm as any).handleCancelPendingVerification((wrapper.vm as any).pendingVerifications[0])

    expect(cancelVerificationMock).toHaveBeenCalledWith('txn-inbound', 'User cancelled verification')
    expect(messageSuccessMock).toHaveBeenCalledWith('已取消待处理验证')

    ;(wrapper.vm as any).handleAcceptPendingVerification({
      transactionId: 'txn-other',
      userId: '@alice:example.com',
      deviceId: 'DEVICE_TWO',
      methods: ['m.sas.v1'],
      timestamp: Date.now()
    })

    expect((wrapper.vm as any).showVerifyDialog).toBe(true)
    expect((wrapper.vm as any).selectedVerificationTransaction.deviceId).toBe('DEVICE_TWO')
  })

  it('备份开关反映真实备份状态而不是 localStorage', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(localStorage.getItem('tjg-backup-enabled')).toBeNull()

    await wrapper.get('[data-test="backup-switch"]').trigger('click')
    await flushPromises()

    expect(localStorage.getItem('tjg-backup-enabled')).toBeNull()
  })

  it('关闭备份开关保持显示的备份状态不变且不写存储', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.get('[data-test="backup-switch"]').attributes('data-value')).toBe('true')

    await wrapper.get('[data-test="backup-switch"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-test="backup-switch"]').attributes('data-value')).toBe('true')
    expect((wrapper.vm as any).backupEnabled).toBe(true)
    expect(messageWarningMock).toHaveBeenCalledWith('已禁用安全备份')
    expect(localStorage.getItem('tjg-backup-enabled')).toBeNull()
  })

  it('打开备份开关进入备份设置向导', async () => {
    encryptionStoreState.backupEnabled = false

    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.get('[data-test="backup-switch"]').attributes('data-value')).toBe('false')

    await wrapper.get('[data-test="backup-switch"]').trigger('click')
    await flushPromises()

    expect((wrapper.vm as any).showBackupDialog).toBe(true)
    expect(messageWarningMock).not.toHaveBeenCalledWith('已禁用安全备份')
  })

  it('在加密未启用和指纹缺失时走降级逻辑', async () => {
    getCurrentSessionContextMock.mockReturnValue({
      userId: null,
      deviceId: null,
      isCryptoEnabled: false
    })
    encryptionStoreState.encryptionEnabled = false
    encryptionStoreState.backupEnabled = false
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
    getPendingVerificationsMock.mockRejectedValueOnce(new Error('load failed'))

    mountComponent()
    await flushPromises()

    expect(loggerErrorMock).toHaveBeenCalled()
  })

  it('在轮换弹窗更新后刷新轮换状态', async () => {
    getKeyRotationStatusMock.mockResolvedValueOnce({ enabled: true, intervalMs: 1, needsRotation: false })

    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('需要轮换')

    await wrapper.get('[data-test="rotation-updated"]').trigger('click')
    await flushPromises()

    expect(getKeyRotationStatusMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('已是最新')
  })

  /**
   * R-2（2026-10-12）：把「私钥只在本机、未进 4S」变成可操作提示。
   *
   * 断言的是**用户可见的差异**：警告文案 + 「立即存入」按钮是否存在，
   * 以及点击后走向哪条分支（存入 / 4S 未配置 / 失败）。
   */
  describe('R-2 交叉签名私钥存储（4S）提示', () => {
    const findStoreButton = (wrapper: ReturnType<typeof mountComponent>) =>
      wrapper.findAll('button').find((b) => b.text().includes('立即存入'))

    it('私钥只在本机 ⇒ 显示警告与「立即存入」按钮', async () => {
      encryptionStoreState.crossSigningKeysInSecretStorage = false
      encryptionStoreState.crossSigningKeysLocalOnly = true

      const wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.text()).toContain('尚未存入密钥存储')
      expect(wrapper.text()).toContain('立即存入')
      expect(wrapper.text()).toContain('交叉签名私钥目前只保存在本设备')
    })

    it('私钥已入 4S ⇒ 不显示警告也不显示按钮（不误报）', async () => {
      encryptionStoreState.crossSigningKeysInSecretStorage = true
      encryptionStoreState.crossSigningKeysLocalOnly = false

      const wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.text()).toContain('已存入密钥存储')
      expect(wrapper.text()).not.toContain('立即存入')
      expect(wrapper.text()).not.toContain('交叉签名私钥目前只保存在本设备')
    })

    it('本机没有私钥（从未建立交叉签名）⇒ 仍不显示按钮', async () => {
      encryptionStoreState.crossSigningKeysInSecretStorage = false
      encryptionStoreState.crossSigningKeysLocalOnly = false

      const wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.text()).toContain('尚未存入密钥存储')
      expect(findStoreButton(wrapper)).toBeUndefined()
    })

    it('点击「立即存入」并成功 ⇒ 成功反馈', async () => {
      encryptionStoreState.crossSigningKeysLocalOnly = true

      const wrapper = mountComponent()
      await flushPromises()

      await findStoreButton(wrapper)!.trigger('click')
      await flushPromises()

      expect(messageSuccessMock).toHaveBeenCalledWith('交叉签名私钥已存入密钥存储')
    })

    it('4S 尚未配置 ⇒ 打开安全密钥流程并给警告（不得在此直接新建 4S）', async () => {
      encryptionStoreState.crossSigningKeysLocalOnly = true
      encryptionStoreState.storeCrossSigningKeysInSecretStorage.mockResolvedValueOnce('needs-setup')

      const wrapper = mountComponent()
      await flushPromises()

      await findStoreButton(wrapper)!.trigger('click')
      await flushPromises()

      expect(messageWarningMock).toHaveBeenCalledWith('尚未配置密钥存储，请先完成安全密钥设置')
      expect((wrapper.vm as any).showSecurityKeyDialog).toBe(true)
    })

    it('存入失败 ⇒ 给出失败反馈且不打开任何弹窗', async () => {
      encryptionStoreState.crossSigningKeysLocalOnly = true
      encryptionStoreState.storeCrossSigningKeysInSecretStorage.mockResolvedValueOnce('failed')

      const wrapper = mountComponent()
      await flushPromises()

      await findStoreButton(wrapper)!.trigger('click')
      await flushPromises()

      expect(messageWarningMock).toHaveBeenCalledWith('存入密钥存储失败，请稍后重试')
      expect((wrapper.vm as any).showSecurityKeyDialog).toBe(false)
    })

    it('安全密钥流程成功后续会重读交叉签名状态（让警告收敛）', async () => {
      const wrapper = mountComponent()
      await flushPromises()

      const callsBefore = encryptionStoreState.loadCrossSigningStatus.mock.calls.length
      ;(wrapper.vm as any).handleSecurityKeyCreated()
      await flushPromises()

      expect(encryptionStoreState.loadCrossSigningStatus.mock.calls.length).toBe(callsBefore + 1)
    })
  })

  /**
   * UI-P2-08：服务端未声明 E2EE 能力时，加密页保留（settingsSchema 的 readonly 降级），
   * 但整页进入只读，阻断可能失败的操作。
   * 判定必须以能力探测完成为前提，避免登录初期把整页误锁。
   */
  describe('E2EE 能力降级（只读）', () => {
    it('能力探测完成且服务端不支持 E2EE ⇒ 显示只读提示并 inert 阻断交互', async () => {
      capabilityState.loaded = true
      capabilityState.e2ee = false

      const wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.find('[data-testid="e2ee-unsupported"]').exists()).toBe(true)
      expect(wrapper.find('.encryption-settings').element.hasAttribute('inert')).toBe(true)
    })

    it('服务端支持 E2EE ⇒ 不显示只读提示，也不阻断交互', async () => {
      capabilityState.loaded = true
      capabilityState.e2ee = true

      const wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.find('[data-testid="e2ee-unsupported"]').exists()).toBe(false)
      expect(wrapper.find('.encryption-settings').element.hasAttribute('inert')).toBe(false)
    })

    it('能力探测未完成 ⇒ 不进入只读', async () => {
      capabilityState.loaded = false
      capabilityState.e2ee = false

      const wrapper = mountComponent()
      await flushPromises()

      expect(wrapper.find('[data-testid="e2ee-unsupported"]').exists()).toBe(false)
      expect(wrapper.find('.encryption-settings').element.hasAttribute('inert')).toBe(false)
    })
  })

  describe('脱水设备入口（加密后端能力）', () => {
    const findSection = (wrapper: ReturnType<typeof mountComponent>) =>
      wrapper.findAll('.settings-section').find((item) => item.text().includes('脱水设备'))

    it('加密后端不支持脱水设备 ⇒ 只显示说明，不渲染管理入口', async () => {
      isDehydratedSupportedMock.mockReturnValue(false)

      const wrapper = mountComponent()
      await flushPromises()

      const section = findSection(wrapper)
      expect(section).toBeDefined()
      expect(section!.text()).toContain('当前加密后端不支持脱水设备')
      expect(section!.find('button').exists()).toBe(false)
      expect(wrapper.find('[data-test="dehydrated-device-manager"]').exists()).toBe(false)
    })

    it('加密后端支持脱水设备 ⇒ 渲染管理入口', async () => {
      const wrapper = mountComponent()
      await flushPromises()

      const section = findSection(wrapper)
      expect(section).toBeDefined()
      expect(section!.text()).not.toContain('当前加密后端不支持脱水设备')
      expect(section!.find('button').exists()).toBe(true)
      expect(wrapper.find('[data-test="dehydrated-device-manager"]').exists()).toBe(true)
    })
  })
})
