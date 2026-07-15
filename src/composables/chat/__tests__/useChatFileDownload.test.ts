import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatFileDownload } from '../useChatFileDownload'

const { showFeedbackMock, showProgressFeedbackMock, progressDestroyMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  progressDestroyMock: vi.fn(),
  showProgressFeedbackMock: vi.fn(() => ({ destroy: progressDestroyMock }))
}))

const { userStoreMock } = vi.hoisted(() => ({
  userStoreMock: {
    userInfo: { uid: 'user123' } as { uid: string } | undefined,
    getUserRoomAbsoluteDir: vi.fn(() => Promise.resolve('/users/user123/rooms'))
  }
}))

const mockFileDownloadStore = {
  getFileStatus: vi.fn(() => ({ absolutePath: '/test/file.txt', nativePath: '/test' })),
  downloadFile: vi.fn(() => Promise.resolve('/downloaded/file.txt')),
  downloadEncryptedFile: vi.fn(() => Promise.resolve('/downloaded/encrypted-file.txt')),
  refreshFileDownloadStatus: vi.fn(() => Promise.resolve())
}

vi.mock('@tauri-apps/plugin-opener', () => ({
  revealItemInDir: vi.fn(() => Promise.resolve())
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...paths: string[]) => Promise.resolve(paths.join('/'))),
  appDataDir: vi.fn(() => Promise.resolve('/app-data')),
  resourceDir: vi.fn(() => Promise.resolve('/resource'))
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppData: 1, Resource: 2 }
}))

vi.mock('@/stores/domains/widget/fileDownload', () => ({
  useFileDownloadStore: () => mockFileDownloadStore
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({
    currentSessionRoomId: '!room:test.org'
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => userStoreMock
}))

vi.mock('@/utils/PathUtil', () => ({
  getFilesMeta: vi.fn(() => Promise.resolve([{ exists: true, file_type: 'txt', mime_type: 'text/plain' }])),
  detectRemoteFileType: vi.fn(() => Promise.resolve({ ext: 'txt', mime: 'text/plain' }))
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock,
    showProgressFeedback: showProgressFeedbackMock
  })
}))

const mockT = (key: string) => key
const mockDownloadFile = vi.fn(() => Promise.resolve(undefined))
const mockGetLocalVideoPath = vi.fn(() => Promise.resolve('videos/test.mp4'))
const mockCheckVideoDownloaded = vi.fn(() => Promise.resolve(true))
const mockCreateWebviewWindow = vi.fn(() => Promise.resolve(null))
const mockSendWindowPayload = vi.fn(() => Promise.resolve())

const createHook = () =>
  useChatFileDownload({
    t: mockT,
    downloadFile: mockDownloadFile,
    getLocalVideoPath: mockGetLocalVideoPath,
    checkVideoDownloaded: mockCheckVideoDownloaded,
    createWebviewWindow: mockCreateWebviewWindow,
    sendWindowPayload: mockSendWindowPayload
  })

describe('useChatFileDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    userStoreMock.userInfo = { uid: 'user123' }
  })

  describe('revealInDirSafely', () => {
    it('calls revealItemInDir with valid path', async () => {
      const { revealInDirSafely } = createHook()
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
      await revealInDirSafely('/test/path')
      expect(revealItemInDir).toHaveBeenCalledWith('/test/path')
    })

    it('shows error when path is null', async () => {
      const { revealInDirSafely } = createHook()
      await revealInDirSafely(null)
      expect(showFeedbackMock).toHaveBeenCalledWith('home.chat_main.file.missing_local', 'error')
    })

    it('shows error when revealItemInDir throws', async () => {
      const { revealInDirSafely } = createHook()
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
      vi.mocked(revealItemInDir).mockRejectedValueOnce(new Error('access denied'))
      await revealInDirSafely('/test/path')
      expect(showFeedbackMock).toHaveBeenCalledWith('home.chat_main.file.show_failed', 'error')
    })
  })

  describe('downloadAndRevealVideo', () => {
    it('downloads video when not yet downloaded', async () => {
      mockCheckVideoDownloaded.mockResolvedValueOnce(false)
      const { downloadAndRevealVideo } = createHook()
      await downloadAndRevealVideo({ videoUrl: 'https://example.com/video.mp4' })
      expect(mockDownloadFile).toHaveBeenCalled()
    })

    it('skips download when already downloaded', async () => {
      mockCheckVideoDownloaded.mockResolvedValueOnce(true)
      const { downloadAndRevealVideo } = createHook()
      await downloadAndRevealVideo({ videoUrl: 'https://example.com/video.mp4' })
      expect(mockDownloadFile).not.toHaveBeenCalled()
    })

    it('catches and logs errors gracefully', async () => {
      mockGetLocalVideoPath.mockRejectedValueOnce(new Error('path error'))
      const { downloadAndRevealVideo } = createHook()
      await expect(downloadAndRevealVideo({ videoUrl: 'bad-url' })).resolves.toBeUndefined()
    })

    it('downloads encrypted video through decrypt pipeline when descriptor exists', async () => {
      const { downloadAndRevealVideo } = createHook()
      await downloadAndRevealVideo({
        videoUrl: 'mxc://example.org/video',
        fileName: 'secret-video.mp4',
        encryptedFile: {
          url: 'mxc://example.org/video',
          iv: 'iv',
          hashes: { sha256: 'hash' },
          v: 'v2',
          key: {
            alg: 'A256CTR',
            k: 'secret',
            kty: 'oct',
            ext: true,
            key_ops: ['decrypt']
          }
        }
      })

      expect(mockFileDownloadStore.downloadEncryptedFile).toHaveBeenCalledWith(
        'mxc://example.org/video',
        'secret-video.mp4',
        expect.objectContaining({ v: 'v2' })
      )
      expect(mockDownloadFile).not.toHaveBeenCalled()
    })
  })

  describe('downloadAndRevealFile', () => {
    it('downloads file when not exists locally', async () => {
      const { getFilesMeta } = await import('@/utils/PathUtil')
      vi.mocked(getFilesMeta).mockResolvedValueOnce([{ exists: false }] as never)
      mockFileDownloadStore.downloadFile.mockResolvedValueOnce('/new/path.txt')

      const { downloadAndRevealFile } = createHook()
      await downloadAndRevealFile({
        fileUrl: 'https://example.com/file.txt',
        fileName: 'file.txt',
        i18nKeys: { downloadPrompt: 'prompt', success: 'success', failed: 'failed' }
      })
      expect(mockFileDownloadStore.downloadFile).toHaveBeenCalled()
      expect(showProgressFeedbackMock).toHaveBeenCalledWith('prompt', 'info')
      expect(progressDestroyMock).toHaveBeenCalled()
      expect(showFeedbackMock).toHaveBeenCalledWith('success', 'success')
    })

    it('shows error when download returns null', async () => {
      const { getFilesMeta } = await import('@/utils/PathUtil')
      vi.mocked(getFilesMeta).mockResolvedValueOnce([{ exists: false }] as never)
      mockFileDownloadStore.downloadFile.mockResolvedValueOnce(null as unknown as string)

      const { downloadAndRevealFile } = createHook()
      await downloadAndRevealFile({
        fileUrl: 'https://example.com/file.txt',
        fileName: 'file.txt',
        i18nKeys: { downloadPrompt: 'prompt', success: 'success', failed: 'failed' }
      })
      expect(showFeedbackMock).toHaveBeenCalledWith('failed', 'error')
    })

    it('downloads encrypted file through decrypt pipeline when descriptor exists', async () => {
      const { getFilesMeta } = await import('@/utils/PathUtil')
      vi.mocked(getFilesMeta).mockResolvedValueOnce([{ exists: false }] as never)

      const { downloadAndRevealFile } = createHook()
      await downloadAndRevealFile({
        fileUrl: 'https://example.com/file.txt',
        fileName: 'file.txt',
        encryptedFile: {
          url: 'mxc://example.org/encrypted',
          iv: 'iv',
          hashes: { sha256: 'hash' },
          v: 'v2',
          key: {
            alg: 'A256CTR',
            k: 'secret',
            kty: 'oct',
            ext: true,
            key_ops: ['decrypt']
          }
        },
        i18nKeys: { downloadPrompt: 'prompt', success: 'success', failed: 'failed' }
      })

      expect(mockFileDownloadStore.downloadEncryptedFile).toHaveBeenCalled()
      expect(mockFileDownloadStore.downloadFile).not.toHaveBeenCalled()
    })

    it('refreshes file status with empty userId when current user info is missing', async () => {
      const { getFilesMeta } = await import('@/utils/PathUtil')
      userStoreMock.userInfo = undefined
      vi.mocked(getFilesMeta).mockResolvedValueOnce([{ exists: false }] as never)
      mockFileDownloadStore.downloadFile.mockResolvedValueOnce('/new/path.txt')

      const { downloadAndRevealFile } = createHook()
      await downloadAndRevealFile({
        fileUrl: 'https://example.com/file.txt',
        fileName: 'file.txt',
        i18nKeys: { downloadPrompt: 'prompt', success: 'success', failed: 'failed' }
      })

      expect(mockFileDownloadStore.refreshFileDownloadStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: ''
        })
      )
    })

    it('reveals existing file without downloading', async () => {
      const { getFilesMeta } = await import('@/utils/PathUtil')
      vi.mocked(getFilesMeta).mockResolvedValueOnce([{ exists: true }] as never)

      const { downloadAndRevealFile } = createHook()
      await downloadAndRevealFile({
        fileUrl: 'https://example.com/file.txt',
        fileName: 'file.txt',
        i18nKeys: { downloadPrompt: 'prompt', success: 'success', failed: 'failed' }
      })
      expect(mockFileDownloadStore.downloadFile).not.toHaveBeenCalled()
    })
  })

  describe('previewFile', () => {
    it('sends local payload when file exists', async () => {
      const { getFilesMeta } = await import('@/utils/PathUtil')
      vi.mocked(getFilesMeta).mockResolvedValueOnce([
        { exists: true, file_type: 'txt', mime_type: 'text/plain' }
      ] as never)

      const item = {
        message: { id: 'msg1', body: { url: 'https://example.com/file.txt', fileName: 'file.txt', size: 100 } },
        fromUser: { uid: 'user1' }
      } as never

      const { previewFile } = createHook()
      await previewFile(item)
      expect(mockSendWindowPayload).toHaveBeenCalled()
      expect(mockCreateWebviewWindow).toHaveBeenCalled()
    })

    it('falls back to remote when file does not exist', async () => {
      const { getFilesMeta, detectRemoteFileType } = await import('@/utils/PathUtil')
      vi.mocked(getFilesMeta).mockResolvedValueOnce([{ exists: false }] as never)
      vi.mocked(detectRemoteFileType).mockResolvedValueOnce({ ext: 'txt', mime: 'text/plain' } as never)

      const item = {
        message: { id: 'msg1', body: { url: 'https://example.com/file.txt', fileName: 'file.txt', size: 100 } },
        fromUser: { uid: 'user1' }
      } as never

      const { previewFile } = createHook()
      await previewFile(item)
      expect(detectRemoteFileType).toHaveBeenCalled()
      expect(mockSendWindowPayload).toHaveBeenCalled()
    })

    it('downloads encrypted file before preview when local file is missing', async () => {
      const { getFilesMeta } = await import('@/utils/PathUtil')
      vi.mocked(getFilesMeta)
        .mockResolvedValueOnce([{ exists: false }] as never)
        .mockResolvedValueOnce([{ exists: true, file_type: 'txt', mime_type: 'text/plain' }] as never)

      const item = {
        message: {
          id: 'msg1',
          body: {
            url: 'https://example.com/file.txt',
            fileName: 'file.txt',
            size: 100,
            encryptedFile: {
              url: 'mxc://example.org/encrypted',
              iv: 'iv',
              hashes: { sha256: 'hash' },
              v: 'v2',
              key: {
                alg: 'A256CTR',
                k: 'secret',
                kty: 'oct',
                ext: true,
                key_ops: ['decrypt']
              }
            }
          }
        },
        fromUser: { uid: 'user1' }
      } as never

      const { previewFile } = createHook()
      await previewFile(item)

      expect(mockFileDownloadStore.downloadEncryptedFile).toHaveBeenCalled()
      expect(mockSendWindowPayload).toHaveBeenCalled()
    })

    it('falls back to remote on sendWindowPayload error', async () => {
      const { getFilesMeta, detectRemoteFileType } = await import('@/utils/PathUtil')
      vi.mocked(getFilesMeta).mockResolvedValueOnce([
        { exists: true, file_type: 'txt', mime_type: 'text/plain' }
      ] as never)
      mockSendWindowPayload.mockRejectedValueOnce(new Error('send failed'))
      vi.mocked(detectRemoteFileType).mockResolvedValueOnce({ ext: 'txt', mime: 'text/plain' } as never)

      const item = {
        message: { id: 'msg1', body: { url: 'https://example.com/file.txt', fileName: 'file.txt', size: 100 } },
        fromUser: { uid: 'user1' }
      } as never

      const { previewFile } = createHook()
      await previewFile(item)
      expect(detectRemoteFileType).toHaveBeenCalled()
    })
  })
})
