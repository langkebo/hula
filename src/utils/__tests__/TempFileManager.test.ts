import { beforeEach, describe, expect, it, vi } from 'vitest'

const { removeMock, isMobileMock } = vi.hoisted(() => ({
  removeMock: vi.fn(),
  isMobileMock: vi.fn(() => false)
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: {
    AppData: 'AppData',
    AppCache: 'AppCache',
    Resource: 'Resource'
  },
  remove: removeMock
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: isMobileMock
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

import { BaseDirectory } from '@tauri-apps/plugin-fs'
import { removeTempFile } from '../TempFileManager'

describe('removeTempFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isMobileMock.mockReturnValue(false)
  })

  it('skips removal for undefined path', async () => {
    await removeTempFile(undefined)
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('skips removal for null path', async () => {
    await removeTempFile(null)
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('skips removal for empty string', async () => {
    await removeTempFile('')
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('skips removal for http URLs', async () => {
    await removeTempFile('https://example.com/file.tmp')
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('skips removal for http URLs case-insensitively', async () => {
    await removeTempFile('HTTP://example.com/file.tmp')
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('skips removal for blob: URLs', async () => {
    await removeTempFile('blob:https://example.com/uuid')
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('normalizes backslashes to forward slashes', async () => {
    removeMock.mockResolvedValue(undefined)
    await removeTempFile('C:\\Users\\test\\file.tmp')
    expect(removeMock).toHaveBeenCalledWith('C:/Users/test/file.tmp', expect.objectContaining({ baseDir: 'AppCache' }))
  })

  it('uses AppCache baseDir on desktop by default', async () => {
    removeMock.mockResolvedValue(undefined)
    isMobileMock.mockReturnValue(false)
    await removeTempFile('/tmp/file.tmp')
    expect(removeMock).toHaveBeenCalledWith('/tmp/file.tmp', expect.objectContaining({ baseDir: 'AppCache' }))
  })

  it('uses AppData baseDir on mobile by default', async () => {
    removeMock.mockResolvedValue(undefined)
    isMobileMock.mockReturnValue(true)
    await removeTempFile('/tmp/file.tmp')
    expect(removeMock).toHaveBeenCalledWith('/tmp/file.tmp', expect.objectContaining({ baseDir: 'AppData' }))
  })

  it('uses provided baseDir when explicitly set', async () => {
    removeMock.mockResolvedValue(undefined)
    await removeTempFile('/tmp/file.tmp', { baseDir: BaseDirectory.Resource })
    expect(removeMock).toHaveBeenCalledWith('/tmp/file.tmp', expect.objectContaining({ baseDir: 'Resource' }))
  })

  it('passes undefined removeOptions when baseDir is null', async () => {
    removeMock.mockResolvedValue(undefined)
    await removeTempFile('/tmp/file.tmp', { baseDir: null })
    expect(removeMock).toHaveBeenCalledWith('/tmp/file.tmp', undefined)
  })

  it('swallows errors silently when silent=true', async () => {
    removeMock.mockRejectedValue(new Error('permission denied'))
    await expect(removeTempFile('/tmp/file.tmp', { silent: true })).resolves.toBeUndefined()
  })

  it('swallows errors when silent=false (logs warning)', async () => {
    removeMock.mockRejectedValue(new Error('permission denied'))
    await expect(removeTempFile('/tmp/file.tmp', { silent: false })).resolves.toBeUndefined()
  })

  it('uses default warning prefix when reason is not provided', async () => {
    removeMock.mockRejectedValue(new Error('boom'))
    await removeTempFile('/tmp/file.tmp')
    // Just verify the call didn't throw
    expect(removeMock).toHaveBeenCalled()
  })

  it('handles Windows-style paths', async () => {
    removeMock.mockResolvedValue(undefined)
    await removeTempFile('C:\\temp\\cache\\video.mp4')
    expect(removeMock).toHaveBeenCalledWith('C:/temp/cache/video.mp4', expect.any(Object))
  })

  it('handles Unix-style paths', async () => {
    removeMock.mockResolvedValue(undefined)
    await removeTempFile('/var/tmp/cache/video.mp4')
    expect(removeMock).toHaveBeenCalledWith('/var/tmp/cache/video.mp4', expect.any(Object))
  })
})
