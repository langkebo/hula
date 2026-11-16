import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFileDownloadStore } from '../fileDownload'

const {
  downloadBytesMock,
  downloadEncryptedBytesMock,
  downloadSignedBytesMock,
  existsMock,
  writeFileMock,
  showFeedbackMock
} = vi.hoisted(() => ({
  downloadBytesMock: vi.fn(),
  downloadEncryptedBytesMock: vi.fn(),
  downloadSignedBytesMock: vi.fn(),
  existsMock: vi.fn(),
  writeFileMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: async (...parts: string[]) => parts.filter(Boolean).join('/')
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: existsMock,
  writeFile: writeFileMock
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    getUserRoomDir: async () => 'chat-files',
    getUserRoomAbsoluteDir: async () => '/abs/chat-files'
  })
}))

vi.mock('@/utils/HttpClient', () => ({
  HttpClient: { downloadBytes: downloadBytesMock }
}))

vi.mock('@/utils/PathUtil', () => ({
  getDownloadBaseDir: () => 'Base',
  getDownloadBaseDirPath: async () => '/abs',
  getFilesMeta: async () => [{ exists: false }]
}))

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: {
    downloadEncryptedFileBytes: downloadEncryptedBytesMock,
    downloadSignedFileBytes: downloadSignedBytesMock
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}))

const createDeferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('fileDownload store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    existsMock.mockResolvedValue(false)
    writeFileMock.mockResolvedValue(undefined)
  })

  it('同一文件并发下载只发起一次请求和一次写入', async () => {
    const gate = createDeferred<ArrayBuffer>()
    downloadBytesMock.mockReturnValue(gate.promise)
    const store = useFileDownloadStore()

    const first = store.downloadFile('mxc://server/a.bin', 'a.bin')
    const second = store.downloadFile('mxc://server/a.bin', 'a.bin')

    gate.resolve(new ArrayBuffer(4))
    const [firstPath, secondPath] = await Promise.all([first, second])

    expect(downloadBytesMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(firstPath).toBe(secondPath)
    expect(firstPath).toBe('/abs/chat-files/a.bin')
  })

  it('下载结束后释放任务，后续请求可重新执行', async () => {
    downloadBytesMock.mockResolvedValue(new ArrayBuffer(4))
    const store = useFileDownloadStore()

    await store.downloadFile('mxc://server/b.bin', 'b.bin')
    await store.downloadFile('mxc://server/b.bin', 'b.bin')

    expect(downloadBytesMock).toHaveBeenCalledTimes(2)
  })

  it('同一加密文件并发下载只解密一次', async () => {
    const gate = createDeferred<Uint8Array>()
    downloadEncryptedBytesMock.mockReturnValue(gate.promise)
    const store = useFileDownloadStore()
    const encryptedFile = { url: 'mxc://server/enc', v: 'v2' }

    const first = store.downloadEncryptedFile('mxc://server/enc', 'enc.bin', encryptedFile)
    const second = store.downloadEncryptedFile('mxc://server/enc', 'enc.bin', encryptedFile)

    gate.resolve(new Uint8Array([1, 2, 3]))
    const [firstPath, secondPath] = await Promise.all([first, second])

    expect(downloadEncryptedBytesMock).toHaveBeenCalledTimes(1)
    expect(writeFileMock).toHaveBeenCalledTimes(1)
    expect(firstPath).toBe(secondPath)
  })

  it('同一 URL 保存为不同文件名时互不干扰', async () => {
    downloadBytesMock.mockResolvedValue(new ArrayBuffer(4))
    const store = useFileDownloadStore()

    const [firstPath, secondPath] = await Promise.all([
      store.downloadFile('mxc://server/shared.bin', 'a.bin'),
      store.downloadFile('mxc://server/shared.bin', 'b.bin')
    ])

    expect(downloadBytesMock).toHaveBeenCalledTimes(2)
    expect(firstPath).toBe('/abs/chat-files/a.bin')
    expect(secondPath).toBe('/abs/chat-files/b.bin')
  })

  it('下载失败后释放任务，重试会重新发起请求', async () => {
    downloadBytesMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(new ArrayBuffer(4))
    const store = useFileDownloadStore()

    const failed = await store.downloadFile('mxc://server/c.bin', 'c.bin')
    const retried = await store.downloadFile('mxc://server/c.bin', 'c.bin')

    expect(failed).toBeNull()
    expect(retried).toBe('/abs/chat-files/c.bin')
    expect(downloadBytesMock).toHaveBeenCalledTimes(2)
  })

  it('签名媒体链接走后端 download_signed 通道，并完成进度状态', async () => {
    downloadSignedBytesMock.mockResolvedValue(new Uint8Array([1, 2, 3]))
    const store = useFileDownloadStore()
    const signedUrl =
      'https://hs.example.com/_matrix/media/v3/download_signed/hs.example.com/m1/s.bin?signature=sig&expires=1893456000'

    const path = await store.downloadFile(signedUrl, 's.bin')

    expect(downloadSignedBytesMock).toHaveBeenCalledWith({
      serverName: 'hs.example.com',
      mediaId: 'm1',
      filename: 's.bin',
      signature: 'sig',
      expires: 1893456000
    })
    expect(downloadBytesMock).not.toHaveBeenCalled()
    expect(path).toBe('/abs/chat-files/s.bin')
    expect(store.getFileStatus(signedUrl)).toMatchObject({ status: 'completed', progress: 100 })
  })

  it('签名媒体下载失败时标记 failed 并允许重试', async () => {
    downloadSignedBytesMock
      .mockRejectedValueOnce(new Error('signed expired'))
      .mockResolvedValueOnce(new Uint8Array([1]))
    const store = useFileDownloadStore()
    const signedUrl =
      'https://hs.example.com/_matrix/media/v3/download_signed/hs.example.com/m1/d.bin?signature=sig&expires=1893456000'

    const failed = await store.downloadFile(signedUrl, 'd.bin')
    expect(failed).toBeNull()
    expect(store.getFileStatus(signedUrl)).toMatchObject({ status: 'failed', error: 'signed expired' })
    expect(showFeedbackMock).toHaveBeenCalled()

    const retried = await store.downloadFile(signedUrl, 'd.bin')
    expect(retried).toBe('/abs/chat-files/d.bin')
    expect(downloadSignedBytesMock).toHaveBeenCalledTimes(2)
  })
})
