import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SecureBackupDialog from '../SecureBackupDialog.vue'

const {
  showFeedbackMock,
  getKeyBackupInfoMock,
  setupKeyBackupMock,
  restoreFromBackupMock,
  deleteKeyBackupMock,
  waitForClientReadyMock,
  createRecoveryKeyFromPassphraseMock,
  verifyBackupMock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  getKeyBackupInfoMock: vi.fn(),
  setupKeyBackupMock: vi.fn(),
  restoreFromBackupMock: vi.fn(),
  deleteKeyBackupMock: vi.fn(),
  waitForClientReadyMock: vi.fn(),
  createRecoveryKeyFromPassphraseMock: vi.fn(),
  verifyBackupMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/composables/encryption', () => ({
  useEncryption: () => ({
    getKeyBackupInfo: getKeyBackupInfoMock,
    setupKeyBackup: setupKeyBackupMock,
    restoreFromBackup: restoreFromBackupMock,
    deleteKeyBackup: deleteKeyBackupMock
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    waitForClientReady: waitForClientReadyMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  matrixCryptoService: {
    createRecoveryKeyFromPassphrase: createRecoveryKeyFromPassphraseMock
  },
  default: {
    createRecoveryKeyFromPassphrase: createRecoveryKeyFromPassphraseMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixKeyBackupService', () => ({
  matrixKeyBackupService: {
    verifyBackup: verifyBackupMock
  }
}))

const mountComponent = (show = true) =>
  mount(SecureBackupDialog, {
    props: { show },
    global: {
      stubs: {
        'n-modal': {
          template: '<div><slot /></div>'
        },
        'n-spin': {
          template: '<div><slot /></div>'
        },
        'n-button': true,
        'n-input': true,
        'n-alert': true,
        'n-checkbox': true,
        'n-descriptions': {
          template: '<div><slot /></div>'
        },
        'n-descriptions-item': {
          template: '<div><slot /></div>'
        },
        'n-popconfirm': {
          template: '<div><slot name="trigger" /><slot /></div>'
        },
        'n-tag': true,
        'n-divider': true
      }
    }
  })

describe('SecureBackupDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    getKeyBackupInfoMock.mockResolvedValue({
      version: 'backup-version-1',
      algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
      auth_data: {},
      count: 8
    })
    setupKeyBackupMock.mockResolvedValue('RECOVERY-KEY-123')
    restoreFromBackupMock.mockResolvedValue({ imported: 3, total: 3 })
    deleteKeyBackupMock.mockResolvedValue(undefined)
    waitForClientReadyMock.mockResolvedValue(undefined)
    createRecoveryKeyFromPassphraseMock.mockResolvedValue({
      encodedPrivateKey: 'RECOVERY-KEY-123',
      privateKey: new Uint8Array(32),
      keyInfo: {
        algorithm: 'm.secret_storage.v1.aes-hmac-sha2',
        iv: 'iv',
        mac: 'mac'
      }
    })
    verifyBackupMock.mockResolvedValue({
      valid: true,
      algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
      auth_data: {},
      signatures: { ed25519: 'sig' }
    })
  })

  it('在首次打开时立即加载备份状态', async () => {
    const wrapper = mountComponent(true)
    const vm = wrapper.vm as unknown as {
      backupExists: boolean
      backupData: { id: string; algorithm: string; keyCount: number | null }
    }

    await flushPromises()

    expect(getKeyBackupInfoMock).toHaveBeenCalled()
    expect(vm.backupExists).toBe(true)
    expect(vm.backupData).toEqual({
      id: 'backup-version-1',
      algorithm: 'm.megolm_backup.v1.curve25519-aes-sha2',
      keyCount: 8
    })
  })

  it('创建安全备份时使用真实恢复密钥和当前密码', async () => {
    const wrapper = mountComponent(false)
    const vm = wrapper.vm as unknown as {
      activeTab: 'status' | 'create' | 'restore'
      createStep: number
      recoveryKey: string
      currentPassword: string
      keySaved: boolean
      handleCreateBackup: () => Promise<void>
    }

    await wrapper.setProps({ show: true })
    vm.activeTab = 'create'
    vm.createStep = 1
    await flushPromises()

    expect(createRecoveryKeyFromPassphraseMock).toHaveBeenCalled()
    expect(vm.recoveryKey).toBe('RECOVERY-KEY-123')

    vm.keySaved = true
    vm.currentPassword = 'current-pass'
    await vm.handleCreateBackup()

    expect(waitForClientReadyMock).toHaveBeenCalledWith({ timeoutMs: 10000 })
    expect(setupKeyBackupMock).toHaveBeenCalledWith({
      password: 'current-pass',
      generatedKey: expect.objectContaining({
        encodedPrivateKey: 'RECOVERY-KEY-123'
      })
    })
    expect(showFeedbackMock).toHaveBeenCalledWith('encryption.secure_backup.create_success', 'success')
  })

  it('恢复、校验和删除都走统一服务链路', async () => {
    const wrapper = mountComponent(true)
    const vm = wrapper.vm as unknown as {
      backupData: { id: string; algorithm: string; keyCount: number | null }
      restoreRecoveryKey: string
      restoreResult: { success: boolean; imported: number } | null
      verifyResult: { valid: boolean } | null
      backupExists: boolean
      handleRestore: () => Promise<void>
      handleVerify: () => Promise<void>
      handleDelete: () => Promise<void>
    }

    await flushPromises()

    vm.restoreRecoveryKey = 'RECOVERY-KEY-123'
    await vm.handleRestore()
    expect(restoreFromBackupMock).toHaveBeenCalledWith('RECOVERY-KEY-123')
    expect(vm.restoreResult).toEqual({ success: true, imported: 3 })

    await vm.handleVerify()
    expect(verifyBackupMock).toHaveBeenCalledWith('backup-version-1')
    expect(vm.verifyResult?.valid).toBe(true)
    // Delete
    // After deletion, the next status load should find no backup
    getKeyBackupInfoMock.mockResolvedValue(null)

    await vm.handleDelete()
    await flushPromises()

    expect(deleteKeyBackupMock).toHaveBeenCalled()
    expect(vm.backupExists).toBe(false)
    expect(showFeedbackMock).toHaveBeenCalledWith('encryption.secure_backup.delete_success', 'success')
  })
})
