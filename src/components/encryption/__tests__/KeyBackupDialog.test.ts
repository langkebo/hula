import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KeyBackupDialog from '../KeyBackupDialog.vue'

const {
  showFeedbackMock,
  clipboardWriteTextMock,
  saveMock,
  writeTextFileMock,
  getKeyBackupInfoMock,
  setupKeyBackupMock,
  restoreFromBackupMock,
  waitForClientReadyMock,
  createRecoveryKeyFromPassphraseMock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  clipboardWriteTextMock: vi.fn(),
  saveMock: vi.fn(),
  writeTextFileMock: vi.fn(),
  getKeyBackupInfoMock: vi.fn(),
  setupKeyBackupMock: vi.fn(),
  restoreFromBackupMock: vi.fn(),
  waitForClientReadyMock: vi.fn(),
  createRecoveryKeyFromPassphraseMock: vi.fn()
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: saveMock
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: writeTextFileMock
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
    restoreFromBackup: restoreFromBackupMock
  })
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    waitForClientReady: waitForClientReadyMock
  }
}))

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({
  default: {
    createRecoveryKeyFromPassphrase: createRecoveryKeyFromPassphraseMock
  }
}))

const mountComponent = () =>
  mount(KeyBackupDialog, {
    props: {
      show: true
    },
    global: {
      stubs: {
        'n-modal': {
          template: '<div><slot /><slot name="footer" /></div>'
        },
        'n-spin': {
          template: '<div><slot /></div>'
        },
        'n-steps': true,
        'n-step': true,
        'n-flex': {
          template: '<div><slot /></div>'
        },
        'n-icon': true,
        'n-button': true,
        'n-alert': true,
        'n-checkbox': true,
        'n-input': true,
        'n-result': true
      }
    }
  })

describe('KeyBackupDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getKeyBackupInfoMock.mockResolvedValue(null)
    setupKeyBackupMock.mockResolvedValue('RECOVERY-KEY-123')
    restoreFromBackupMock.mockResolvedValue({ imported: 1, total: 1 })
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
    saveMock.mockResolvedValue('/tmp/recovery-key.txt')
    writeTextFileMock.mockResolvedValue(undefined)
    clipboardWriteTextMock.mockResolvedValue(undefined)
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: clipboardWriteTextMock
      }
    })
  })

  it('uses action feedback for copy key success and failure', async () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as unknown as { recoveryKey: string }).recoveryKey = 'demo key'

    await (wrapper.vm as unknown as { handleCopyKey: () => Promise<void> }).handleCopyKey()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('encryption.backup.copy_success', 'success')

    clipboardWriteTextMock.mockRejectedValueOnce(new Error('copy failed'))
    await (wrapper.vm as unknown as { handleCopyKey: () => Promise<void> }).handleCopyKey()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('encryption.backup.copy_failed', 'error')
  })

  it('uses action feedback for download key success and failure', async () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as unknown as { recoveryKey: string }).recoveryKey = 'demo key'

    await (wrapper.vm as unknown as { handleDownloadKey: () => Promise<void> }).handleDownloadKey()
    await flushPromises()

    expect(writeTextFileMock).toHaveBeenCalledWith('/tmp/recovery-key.txt', 'demo key')
    expect(showFeedbackMock).toHaveBeenCalledWith('encryption.backup.download_success', 'success')

    writeTextFileMock.mockRejectedValueOnce(new Error('write failed'))
    await (wrapper.vm as unknown as { handleDownloadKey: () => Promise<void> }).handleDownloadKey()
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('encryption.backup.download_failed', 'error')
  })

  it('uses generated recovery key and current password when creating a backup', async () => {
    const wrapper = mountComponent()
    const vm = wrapper.vm as unknown as {
      handleCreateBackup: () => Promise<void>
      handleProceed: () => Promise<void>
      recoveryKey: string
      currentPassword: string
      keySaved: boolean
      currentStep: number
    }

    await vm.handleCreateBackup()

    expect(waitForClientReadyMock).toHaveBeenCalled()
    expect(createRecoveryKeyFromPassphraseMock).toHaveBeenCalled()
    expect(vm.recoveryKey).toBe('RECOVERY-KEY-123')
    expect(vm.currentStep).toBe(2)

    vm.keySaved = true
    vm.currentPassword = 'current-pass'
    await vm.handleProceed()

    expect(setupKeyBackupMock).toHaveBeenCalledWith({
      password: 'current-pass',
      generatedKey: expect.objectContaining({
        encodedPrivateKey: 'RECOVERY-KEY-123'
      })
    })
  })
})
