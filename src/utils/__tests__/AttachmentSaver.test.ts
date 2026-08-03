import { beforeEach, describe, expect, it, vi } from 'vitest'

const { saveMock, writeFileMock, showFeedbackMock, downloadFileMock, downloadEncryptedFileBytesMock } = vi.hoisted(
  () => ({
    saveMock: vi.fn(),
    writeFileMock: vi.fn(),
    showFeedbackMock: vi.fn(),
    downloadFileMock: vi.fn(),
    downloadEncryptedFileBytesMock: vi.fn()
  })
)

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: saveMock
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeFile: writeFileMock
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    downloadEncryptedFileBytes: downloadEncryptedFileBytesMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/utils/Formatting', () => ({
  extractFileName: vi.fn((url: string) => url.split('/').pop() || url)
}))

import { saveFileAttachmentAs, saveVideoAttachmentAs } from '../AttachmentSaver'

describe('AttachmentSaver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveFileAttachmentAs', () => {
    it('shows error feedback when url is missing', async () => {
      await saveFileAttachmentAs({
        url: '',
        downloadFile: downloadFileMock
      })

      expect(showFeedbackMock).toHaveBeenCalledWith('utils.download_link_not_found', 'error')
      expect(saveMock).not.toHaveBeenCalled()
    })

    it('does nothing when user cancels save dialog', async () => {
      saveMock.mockResolvedValue(null)

      await saveFileAttachmentAs({
        url: 'https://example.com/file.pdf',
        downloadFile: downloadFileMock
      })

      expect(saveMock).toHaveBeenCalled()
      expect(downloadFileMock).not.toHaveBeenCalled()
    })

    it('downloads file via downloadFile when no encryption', async () => {
      saveMock.mockResolvedValue('/path/to/save.pdf')
      downloadFileMock.mockResolvedValue(undefined)

      await saveFileAttachmentAs({
        url: 'https://example.com/file.pdf',
        downloadFile: downloadFileMock
      })

      expect(downloadFileMock).toHaveBeenCalledWith('https://example.com/file.pdf', '/path/to/save.pdf')
      expect(showFeedbackMock).toHaveBeenCalledWith('utils.file_download_success', 'success')
    })

    it('uses default filename extracted from url when defaultFileName not provided', async () => {
      saveMock.mockResolvedValue('/save/path/file.pdf')
      downloadFileMock.mockResolvedValue(undefined)

      await saveFileAttachmentAs({
        url: 'https://example.com/file.pdf',
        downloadFile: downloadFileMock
      })

      expect(saveMock).toHaveBeenCalledWith({
        defaultPath: 'file.pdf',
        filters: undefined
      })
    })

    it('uses provided defaultFileName when set', async () => {
      saveMock.mockResolvedValue('/save/path/custom.pdf')
      downloadFileMock.mockResolvedValue(undefined)

      await saveFileAttachmentAs({
        url: 'https://example.com/file.pdf',
        downloadFile: downloadFileMock,
        defaultFileName: 'custom.pdf'
      })

      expect(saveMock).toHaveBeenCalledWith({
        defaultPath: 'custom.pdf',
        filters: undefined
      })
    })

    it('decrypts and writes encrypted file when encryptedFile is provided', async () => {
      saveMock.mockResolvedValue('/save/path/encrypted.bin')
      downloadEncryptedFileBytesMock.mockResolvedValue(new Uint8Array([1, 2, 3]))
      writeFileMock.mockResolvedValue(undefined)

      await saveFileAttachmentAs({
        url: 'https://example.com/encrypted.bin',
        downloadFile: downloadFileMock,
        encryptedFile: {} as never
      })

      expect(downloadEncryptedFileBytesMock).toHaveBeenCalled()
      expect(writeFileMock).toHaveBeenCalledWith('/save/path/encrypted.bin', expect.any(Uint8Array))
      expect(downloadFileMock).not.toHaveBeenCalled()
    })

    it('normalizes backslashes in save path', async () => {
      saveMock.mockResolvedValue('C:\\Users\\test\\file.pdf')
      downloadFileMock.mockResolvedValue(undefined)

      await saveFileAttachmentAs({
        url: 'https://example.com/file.pdf',
        downloadFile: downloadFileMock
      })

      expect(downloadFileMock).toHaveBeenCalledWith('https://example.com/file.pdf', 'C:/Users/test/file.pdf')
    })

    it('does not show success feedback when successMessage is empty', async () => {
      saveMock.mockResolvedValue('/path/file.pdf')
      downloadFileMock.mockResolvedValue(undefined)

      await saveFileAttachmentAs({
        url: 'https://example.com/file.pdf',
        downloadFile: downloadFileMock,
        successMessage: ''
      })

      expect(showFeedbackMock).not.toHaveBeenCalledWith('', 'success')
    })

    it('logs and shows default error feedback on download failure', async () => {
      saveMock.mockResolvedValue('/path/file.pdf')
      downloadFileMock.mockRejectedValue(new Error('network'))

      await saveFileAttachmentAs({
        url: 'https://example.com/file.pdf',
        downloadFile: downloadFileMock
      })

      // saveFileAttachmentAs provides a default errorMessage (utils.file_save_failed)
      expect(showFeedbackMock).toHaveBeenCalledWith('utils.file_save_failed', 'error')
    })

    it('shows error feedback when errorMessage is provided and download fails', async () => {
      saveMock.mockResolvedValue('/path/file.pdf')
      downloadFileMock.mockRejectedValue(new Error('network'))

      await saveFileAttachmentAs({
        url: 'https://example.com/file.pdf',
        downloadFile: downloadFileMock,
        errorMessage: 'Download failed'
      })

      expect(showFeedbackMock).toHaveBeenCalledWith('Download failed', 'error')
    })
  })

  describe('saveVideoAttachmentAs', () => {
    it('uses default video extensions filter when no filters provided', async () => {
      saveMock.mockResolvedValue(null)

      await saveVideoAttachmentAs({
        url: 'https://example.com/video.mp4',
        downloadFile: downloadFileMock
      })

      expect(saveMock).toHaveBeenCalledWith({
        defaultPath: 'video.mp4',
        filters: [{ name: 'Video', extensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'] }]
      })
    })

    it('uses provided filters when set', async () => {
      saveMock.mockResolvedValue(null)

      await saveVideoAttachmentAs({
        url: 'https://example.com/video.mp4',
        downloadFile: downloadFileMock,
        filters: [{ name: 'MP4', extensions: ['mp4'] }]
      })

      expect(saveMock).toHaveBeenCalledWith({
        defaultPath: 'video.mp4',
        filters: [{ name: 'MP4', extensions: ['mp4'] }]
      })
    })

    it('shows error feedback when url is missing', async () => {
      await saveVideoAttachmentAs({
        url: '',
        downloadFile: downloadFileMock
      })

      expect(showFeedbackMock).toHaveBeenCalledWith('utils.download_link_not_found', 'error')
    })

    it('downloads video file when save path is selected', async () => {
      saveMock.mockResolvedValue('/save/video.mp4')
      downloadFileMock.mockResolvedValue(undefined)

      await saveVideoAttachmentAs({
        url: 'https://example.com/video.mp4',
        downloadFile: downloadFileMock
      })

      expect(downloadFileMock).toHaveBeenCalledWith('https://example.com/video.mp4', '/save/video.mp4')
      expect(showFeedbackMock).toHaveBeenCalledWith('utils.video_save_success', 'success')
    })

    it('uses provided successMessage when set', async () => {
      saveMock.mockResolvedValue('/save/video.mp4')
      downloadFileMock.mockResolvedValue(undefined)

      await saveVideoAttachmentAs({
        url: 'https://example.com/video.mp4',
        downloadFile: downloadFileMock,
        successMessage: 'Video saved!'
      })

      expect(showFeedbackMock).toHaveBeenCalledWith('Video saved!', 'success')
    })

    it('uses provided errorMessage when download fails', async () => {
      saveMock.mockResolvedValue('/save/video.mp4')
      downloadFileMock.mockRejectedValue(new Error('fail'))

      await saveVideoAttachmentAs({
        url: 'https://example.com/video.mp4',
        downloadFile: downloadFileMock,
        errorMessage: 'Video save failed'
      })

      expect(showFeedbackMock).toHaveBeenCalledWith('Video save failed', 'error')
    })
  })
})
