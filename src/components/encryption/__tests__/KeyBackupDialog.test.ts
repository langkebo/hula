import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KeyBackupDialog from '../KeyBackupDialog.vue'

const { showFeedbackMock, clipboardWriteTextMock, saveMock, writeTextFileMock, getKeyBackupInfoMock } = vi.hoisted(
  () => ({
    showFeedbackMock: vi.fn(),
    clipboardWriteTextMock: vi.fn(),
    saveMock: vi.fn(),
    writeTextFileMock: vi.fn(),
    getKeyBackupInfoMock: vi.fn()
  })
)

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
    setupKeyBackup: vi.fn(),
    restoreFromBackup: vi.fn()
  })
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
})
