import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useChatFileDownload } from '../useChatFileDownload'

const mockFileDownloadStore = {
  getFileStatus: vi.fn(() => ({ absolutePath: '/test/file.txt', nativePath: '/test' })),
  downloadFile: vi.fn(() => Promise.resolve('/downloaded/file.txt')),
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
  useUserStore: () => ({
    userInfo: { uid: 'user123' },
    getUserRoomAbsoluteDir: vi.fn(() => Promise.resolve('/users/user123/rooms'))
  })
}))

vi.mock('@/utils/PathUtil', () => ({
  getFilesMeta: vi.fn(() => Promise.resolve([{ exists: true, file_type: 'txt', mime_type: 'text/plain' }])),
  detectRemoteFileType: vi.fn(() => Promise.resolve({ ext: 'txt', mime: 'text/plain' }))
}))

const mockT = (key: string) => key
const mockDownloadFile = vi.fn(() => Promise.resolve(undefined))
const mockGetLocalVideoPath = vi.fn(() => Promise.resolve('videos/test.mp4'))
const mockCheckVideoDownloaded = vi.fn(() => Promise.resolve(true))
const mockCreateWebviewWindow = vi.fn(() => Promise.resolve(null))
const mockSendWindowPayload = vi.fn(() => Promise.resolve())

const mockMessage = {
  info: vi.fn(() => ({ destroy: vi.fn() })),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn()
}

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
    window.$message = mockMessage as unknown as typeof window.$message
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
      expect(mockMessage.error).toHaveBeenCalled()
    })

    it('shows error when revealItemInDir throws', async () => {
      const { revealInDirSafely } = createHook()
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener')
      vi.mocked(revealItemInDir).mockRejectedValueOnce(new Error('access denied'))
      await revealInDirSafely('/test/path')
      expect(mockMessage.error).toHaveBeenCalled()
    })
  })

  describe('downloadAndRevealVideo', () => {
    it('downloads video when not yet downloaded', async () => {
      mockCheckVideoDownloaded.mockResolvedValueOnce(false)
      const { downloadAndRevealVideo } = createHook()
      await downloadAndRevealVideo('https://example.com/video.mp4')
      expect(mockDownloadFile).toHaveBeenCalled()
    })

    it('skips download when already downloaded', async () => {
      mockCheckVideoDownloaded.mockResolvedValueOnce(true)
      const { downloadAndRevealVideo } = createHook()
      await downloadAndRevealVideo('https://example.com/video.mp4')
      expect(mockDownloadFile).not.toHaveBeenCalled()
    })

    it('catches and logs errors gracefully', async () => {
      mockGetLocalVideoPath.mockRejectedValueOnce(new Error('path error'))
      const { downloadAndRevealVideo } = createHook()
      await expect(downloadAndRevealVideo('bad-url')).resolves.toBeUndefined()
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
      expect(mockMessage.success).toHaveBeenCalled()
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
      expect(mockMessage.error).toHaveBeenCalled()
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
