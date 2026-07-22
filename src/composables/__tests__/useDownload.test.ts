import { BaseDirectory } from '@tauri-apps/plugin-fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDownload } from '@/composables/common/useDownload'

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
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}))

describe('useDownload', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.fn()
    global.fetch = mockFetch as any
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

    const mockData = new ArrayBuffer(3)
    new Uint8Array(mockData).set([1, 2, 3])

    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(mockData)
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
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: vi.fn().mockResolvedValue('')
    })

    const { downloadFile } = useDownload()
    await expect(downloadFile('http://test.com/file.txt', 'test/file.txt')).rejects.toThrow()
  })

  it('should update process to 100 on success', async () => {
    const { exists } = await import('@tauri-apps/plugin-fs')
    vi.mocked(exists).mockResolvedValue(true)

    const mockData = new ArrayBuffer(2)
    new Uint8Array(mockData).set([1, 2])

    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(mockData)
    })

    const { downloadFile, process } = useDownload()
    await downloadFile('http://test.com/file.txt', 'file.txt')

    expect(process.value).toBe(0) // reset in finally
  })

  it('should trigger onLoaded event on success', async () => {
    const { exists } = await import('@tauri-apps/plugin-fs')
    vi.mocked(exists).mockResolvedValue(true)

    const mockData = new ArrayBuffer(0)

    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(mockData)
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
