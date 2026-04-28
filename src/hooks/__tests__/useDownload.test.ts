import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useDownload } from '../useDownload'
import { BaseDirectory } from '@tauri-apps/plugin-fs'

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: {
    AppData: 'AppData',
    AppCache: 'AppCache'
  },
  exists: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn()
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: vi.fn(() => false)
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn()
  }))
}))

describe('useDownload', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.fn()
    global.fetch = mockFetch as any
    global.window = { $message: { error: vi.fn() } } as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with default values', () => {
    const { process, isDownloading } = useDownload()
    expect(process.value).toBe(0)
    expect(isDownloading.value).toBe(false)
  })

  it('should download file successfully', async () => {
    const { exists, mkdir, writeFile } = await import('@tauri-apps/plugin-fs')
    vi.mocked(exists).mockResolvedValue(false)

    const mockData = new Uint8Array([1, 2, 3])
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: mockData })
        .mockResolvedValueOnce({ done: true, value: undefined })
    }

    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: vi.fn(() => '3') },
      body: { getReader: () => mockReader }
    })

    const { downloadFile, isDownloading } = useDownload()
    await downloadFile('http://test.com/file.txt', 'test/file.txt')

    expect(mkdir).toHaveBeenCalledWith('test', { baseDir: BaseDirectory.AppCache, recursive: true })
    expect(writeFile).toHaveBeenCalledWith('test/file.txt', expect.any(Uint8Array), {
      baseDir: BaseDirectory.AppCache
    })
    expect(isDownloading.value).toBe(false)
  })

  it('should handle download failure', async () => {
    mockFetch.mockResolvedValue({ ok: false })

    const { downloadFile } = useDownload()
    await downloadFile('http://test.com/file.txt', 'test/file.txt')

    expect(window.$message.error).toHaveBeenCalledWith('下载失败')
  })

  it('should handle missing response body', async () => {
    mockFetch.mockResolvedValue({ ok: true, body: null })

    const { downloadFile } = useDownload()
    await downloadFile('http://test.com/file.txt', 'test/file.txt')

    expect(window.$message.error).toHaveBeenCalledWith('无法读取响应内容')
  })

  it('should update progress during download', async () => {
    const { exists } = await import('@tauri-apps/plugin-fs')
    vi.mocked(exists).mockResolvedValue(true)

    const mockData = new Uint8Array([1, 2])
    const mockReader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({ done: false, value: mockData })
        .mockResolvedValueOnce({ done: true, value: undefined })
    }

    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: vi.fn(() => '2') },
      body: { getReader: () => mockReader }
    })

    const { downloadFile, process } = useDownload()
    await downloadFile('http://test.com/file.txt', 'file.txt')

    expect(process.value).toBe(0)
  })

  it('should trigger onLoaded event on success', async () => {
    const { exists } = await import('@tauri-apps/plugin-fs')
    vi.mocked(exists).mockResolvedValue(true)

    const mockReader = {
      read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined })
    }

    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: vi.fn(() => '0') },
      body: { getReader: () => mockReader }
    })

    const { downloadFile, onLoaded } = useDownload()
    const callback = vi.fn()
    onLoaded(callback)

    await downloadFile('http://test.com/file.txt', 'file.txt')
    expect(callback).toHaveBeenCalledWith('success')
  })

  it('should trigger onLoaded event on failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    const { downloadFile, onLoaded } = useDownload()
    const callback = vi.fn()
    onLoaded(callback)

    await expect(downloadFile('http://test.com/file.txt', 'file.txt')).rejects.toThrow()
    expect(callback).toHaveBeenCalledWith('fail')
  })
})
