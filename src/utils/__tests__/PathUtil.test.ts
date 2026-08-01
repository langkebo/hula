import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Use vi.hoisted to lift mocks above the import chain so the module under test
// sees the mocked dependencies from the very first import.
const {
  isMobileMock,
  existsMock,
  mkdirMock,
  writeFileMock,
  readFileMock,
  appDataDirMock,
  appCacheDirMock,
  resourceDirMock,
  joinMock,
  invokeSilentlyMock,
  invokeWithErrorHandlerMock,
  headMock,
  downloadBytesMock,
  fileTypeFromBufferMock,
  showFeedbackMock,
  announceMock
} = vi.hoisted(() => ({
  isMobileMock: vi.fn(() => false),
  existsMock: vi.fn(async () => false),
  mkdirMock: vi.fn(async () => undefined),
  writeFileMock: vi.fn(async () => undefined),
  readFileMock: vi.fn(async () => new Uint8Array()),
  appDataDirMock: vi.fn(async () => '/app-data'),
  appCacheDirMock: vi.fn(async () => '/app-cache'),
  resourceDirMock: vi.fn(async () => '/resource'),
  joinMock: vi.fn((...paths: string[]) => Promise.resolve(paths.join('/'))),
  invokeSilentlyMock: vi.fn(async () => null),
  invokeWithErrorHandlerMock: vi.fn(async () => [
    { name: 'file.txt', path: '/p', file_type: 'txt', mime_type: 'text/plain', exists: true }
  ]),
  headMock: vi.fn(async () => new Response(null, { headers: { 'content-length': '1024' } })),
  downloadBytesMock: vi.fn(async () => new ArrayBuffer(8)),
  fileTypeFromBufferMock: vi.fn(async () => ({ ext: 'png', mime: 'image/png' })),
  showFeedbackMock: vi.fn(),
  announceMock: vi.fn()
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMobile: isMobileMock
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: {
    AppData: 'AppData',
    AppCache: 'AppCache',
    Resource: 'Resource'
  },
  exists: existsMock,
  mkdir: mkdirMock,
  writeFile: writeFileMock,
  readFile: readFileMock
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: joinMock,
  appCacheDir: appCacheDirMock,
  appDataDir: appDataDirMock,
  resourceDir: resourceDirMock
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn()
  })
}))

vi.mock('@/utils/TauriInvokeHandler', () => ({
  invokeSilently: invokeSilentlyMock,
  invokeWithErrorHandler: invokeWithErrorHandlerMock
}))

vi.mock('@/utils/HttpClient', () => ({
  HttpClient: {
    head: headMock,
    downloadBytes: downloadBytesMock
  }
}))

vi.mock('file-type', () => ({
  fileTypeFromBuffer: fileTypeFromBufferMock
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock,
    showError: vi.fn(),
    showProgressFeedback: vi.fn(() => ({ destroy: () => {} })),
    clearFeedback: vi.fn()
  })
}))

vi.mock('@/composables/common/useAriaLive', () => ({
  useAriaLive: () => ({
    announce: announceMock
  })
}))

import {
  detectRemoteFileType,
  ensureModelFile,
  getFile,
  getFilesMeta,
  getImageCache,
  getRemoteFileSize,
  getUserAbsoluteVideosDir,
  getUserDataRootAbsoluteDir,
  getUserEmojiDir,
  getUserVideosDir,
  persistAiImageFile,
  resolveAiImagePath,
  safeExistsPath
} from '../PathUtil'

describe('PathUtil', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isMobileMock.mockReturnValue(false)
    existsMock.mockResolvedValue(false)
    mkdirMock.mockResolvedValue(undefined)
    writeFileMock.mockResolvedValue(undefined)
    readFileMock.mockResolvedValue(new Uint8Array([1, 2, 3]))
    joinMock.mockImplementation((...paths: string[]) => Promise.resolve(paths.join('/')))
    appDataDirMock.mockResolvedValue('/app-data')
    appCacheDirMock.mockResolvedValue('/app-cache')
    resourceDirMock.mockResolvedValue('/resource')
    invokeWithErrorHandlerMock.mockResolvedValue([
      { name: 'file.txt', path: '/p', file_type: 'txt', mime_type: 'text/plain', exists: true }
    ])
    invokeSilentlyMock.mockResolvedValue(null)
    headMock.mockResolvedValue(new Response(null, { headers: { 'content-length': '1024' } }))
    downloadBytesMock.mockResolvedValue(new ArrayBuffer(8))
    fileTypeFromBufferMock.mockResolvedValue({ ext: 'png', mime: 'image/png' })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getImageCache', () => {
    it('builds a relative cache path with userUid and subFolder', () => {
      expect(getImageCache('avatars', 'user-1')).toBe('cache/user-1/avatars/')
    })

    it('coerces non-string arguments to strings', () => {
      expect(getImageCache('thumbnails', 123 as never)).toBe('cache/123/thumbnails/')
    })
  })

  describe('getFilesMeta', () => {
    it('invokes the get_files_meta Tauri command with the provided paths', async () => {
      const result = await getFilesMeta(['/tmp/a.txt', '/tmp/b.txt'])
      expect(invokeWithErrorHandlerMock).toHaveBeenCalledWith('get_files_meta', {
        filesPath: ['/tmp/a.txt', '/tmp/b.txt']
      })
      expect(result).toEqual([
        { name: 'file.txt', path: '/p', file_type: 'txt', mime_type: 'text/plain', exists: true }
      ])
    })
  })

  describe('getRemoteFileSize', () => {
    it('returns the content-length header as a number', async () => {
      headMock.mockResolvedValue(new Response(null, { headers: { 'content-length': '2048' } }))
      const size = await getRemoteFileSize('https://example.com/image.png')
      expect(headMock).toHaveBeenCalledWith('https://example.com/image.png')
      expect(size).toBe(2048)
    })

    it('returns null when content-length header is missing', async () => {
      headMock.mockResolvedValue(new Response(null, { headers: {} }))
      const size = await getRemoteFileSize('https://example.com/image.png')
      expect(size).toBeNull()
    })

    it('returns null when HEAD request throws', async () => {
      headMock.mockRejectedValue(new Error('network error'))
      const size = await getRemoteFileSize('https://example.com/image.png')
      expect(size).toBeNull()
    })
  })

  describe('safeExistsPath', () => {
    it('returns false for an empty path', async () => {
      const result = await safeExistsPath('')
      expect(result).toBe(false)
      expect(existsMock).not.toHaveBeenCalled()
    })

    it('checks scoped path under resource dir on desktop', async () => {
      existsMock.mockResolvedValue(true)
      // Path starts with /resource so it should be resolved as a scoped path
      const result = await safeExistsPath('/resource/userData/file.txt')
      expect(result).toBe(true)
      expect(existsMock).toHaveBeenCalled()
    })

    it('falls back to direct exists() for paths outside scoped dirs', async () => {
      existsMock.mockResolvedValue(true)
      const result = await safeExistsPath('/tmp/file.txt')
      expect(result).toBe(true)
      expect(existsMock).toHaveBeenCalledWith('/tmp/file.txt')
    })

    it('returns false when direct exists() throws "forbidden path" error', async () => {
      existsMock.mockRejectedValue(new Error('forbidden path'))
      const result = await safeExistsPath('/forbidden/path.txt')
      expect(result).toBe(false)
    })

    it('rethrows non-forbidden errors from direct exists()', async () => {
      const error = new Error('permission denied')
      existsMock.mockRejectedValue(error)
      await expect(safeExistsPath('/denied/path.txt')).rejects.toThrow(error)
    })
  })

  describe('getUserDataRootAbsoluteDir', () => {
    it('creates userData root if missing on desktop', async () => {
      existsMock.mockResolvedValue(false)
      const result = await getUserDataRootAbsoluteDir()
      expect(existsMock).toHaveBeenCalledWith('userData', { baseDir: 'Resource' })
      expect(mkdirMock).toHaveBeenCalledWith('userData', { baseDir: 'Resource', recursive: true })
      expect(result).toBe('/resource/userData')
    })

    it('skips mkdir when userData root already exists', async () => {
      existsMock.mockResolvedValue(true)
      const result = await getUserDataRootAbsoluteDir()
      expect(mkdirMock).not.toHaveBeenCalled()
      expect(result).toBe('/resource/userData')
    })

    it('uses AppData on mobile', async () => {
      isMobileMock.mockReturnValue(true)
      existsMock.mockResolvedValue(true)
      const result = await getUserDataRootAbsoluteDir()
      expect(result).toBe('/app-data/userData')
      expect(existsMock).toHaveBeenCalledWith('userData', { baseDir: 'AppData' })
    })
  })

  describe('getUserVideosDir / getUserAbsoluteVideosDir', () => {
    it('creates user/room subdirectory when missing on desktop', async () => {
      existsMock.mockResolvedValue(false)
      const result = await getUserVideosDir('user-1', 'room-1')
      expect(mkdirMock).toHaveBeenCalledWith('userData/user-1/room-1', {
        baseDir: 'Resource',
        recursive: true
      })
      expect(result).toBe('userData/user-1/room-1')
    })

    it('returns existing directory without creating on desktop', async () => {
      existsMock.mockResolvedValue(true)
      const result = await getUserVideosDir('user-1', 'room-1')
      expect(mkdirMock).not.toHaveBeenCalled()
      expect(result).toBe('userData/user-1/room-1')
    })

    it('uses AppData on mobile', async () => {
      isMobileMock.mockReturnValue(true)
      existsMock.mockResolvedValue(true)
      const result = await getUserVideosDir('user-1', 'room-1')
      expect(existsMock).toHaveBeenCalledWith('userData/user-1/room-1', { baseDir: 'AppData' })
      expect(result).toBe('userData/user-1/room-1')
    })

    it('returns absolute path on desktop', async () => {
      existsMock.mockResolvedValue(true)
      const result = await getUserAbsoluteVideosDir('user-1', 'room-1')
      expect(result).toBe('/resource/userData/user-1/room-1')
    })

    it('returns absolute path on mobile', async () => {
      isMobileMock.mockReturnValue(true)
      existsMock.mockResolvedValue(true)
      const result = await getUserAbsoluteVideosDir('user-1', 'room-1')
      expect(result).toBe('/app-data/userData/user-1/room-1')
    })
  })

  describe('getUserEmojiDir', () => {
    it('creates emojis dir when missing on desktop', async () => {
      existsMock.mockResolvedValue(false)
      const result = await getUserEmojiDir('user-1')
      expect(mkdirMock).toHaveBeenCalledWith('userData/user-1/emojis', {
        baseDir: 'Resource',
        recursive: true
      })
      expect(result).toBe('userData/user-1/emojis')
    })

    it('returns existing emojis dir on desktop', async () => {
      existsMock.mockResolvedValue(true)
      const result = await getUserEmojiDir('user-1')
      expect(mkdirMock).not.toHaveBeenCalled()
      expect(result).toBe('userData/user-1/emojis')
    })

    it('uses AppData on mobile', async () => {
      isMobileMock.mockReturnValue(true)
      existsMock.mockResolvedValue(true)
      const result = await getUserEmojiDir('user-1')
      expect(existsMock).toHaveBeenCalledWith('userData/user-1/emojis', { baseDir: 'AppData' })
      expect(result).toBe('userData/user-1/emojis')
    })
  })

  describe('resolveAiImagePath / persistAiImageFile', () => {
    it('returns exists flag and paths for AI image', async () => {
      existsMock.mockResolvedValue(true)
      const result = await resolveAiImagePath({
        userUid: 'user-1',
        conversationId: 'conv-1',
        fileName: 'image.png'
      })
      expect(result.exists).toBe(true)
      expect(result.relativePath).toContain('userData/ai/user-1/conv-1/image.png')
      expect(result.absolutePath).toContain('/resource/userData/ai/user-1/conv-1/image.png')
    })

    it('creates AI conversation dir when missing', async () => {
      existsMock.mockResolvedValue(false)
      const result = await resolveAiImagePath({
        userUid: 'user-1',
        conversationId: 'conv-1',
        fileName: 'image.png'
      })
      expect(mkdirMock).toHaveBeenCalled()
      expect(result.exists).toBe(false)
    })

    it('writes AI image file data and returns paths', async () => {
      existsMock.mockResolvedValue(false)
      const data = new Uint8Array([1, 2, 3, 4])
      const result = await persistAiImageFile({
        userUid: 'user-1',
        conversationId: 'conv-1',
        fileName: 'image.png',
        data
      })
      expect(writeFileMock).toHaveBeenCalledWith(expect.stringContaining('userData/ai/user-1/conv-1/image.png'), data, {
        baseDir: 'Resource'
      })
      expect(result.relativePath).toContain('userData/ai/user-1/conv-1/image.png')
      expect(result.absolutePath).toContain('/resource/userData/ai/user-1/conv-1/image.png')
    })

    it('uses AppData on mobile for AI images', async () => {
      isMobileMock.mockReturnValue(true)
      existsMock.mockResolvedValue(false)
      await persistAiImageFile({
        userUid: 'user-1',
        conversationId: 'conv-1',
        fileName: 'image.png',
        data: new Uint8Array([1])
      })
      expect(writeFileMock).toHaveBeenCalledWith(expect.any(String), expect.any(Uint8Array), { baseDir: 'AppData' })
    })
  })

  describe('ensureModelFile', () => {
    it('downloads and writes model file when missing', async () => {
      existsMock.mockResolvedValue(false)
      const buffer = new ArrayBuffer(8)
      downloadBytesMock.mockResolvedValue(buffer)
      const result = await ensureModelFile('hula.glb', 'https://example.com/hula.glb')
      expect(downloadBytesMock).toHaveBeenCalledWith('https://example.com/hula.glb')
      expect(writeFileMock).toHaveBeenCalledWith('userData/models/hula.glb', expect.any(Uint8Array), {
        baseDir: 'Resource'
      })
      expect(result).toBe('/resource/userData/models/hula.glb')
    })

    it('returns existing model path without downloading', async () => {
      existsMock.mockResolvedValue(true)
      const result = await ensureModelFile('hula.glb', 'https://example.com/hula.glb')
      expect(downloadBytesMock).not.toHaveBeenCalled()
      expect(writeFileMock).not.toHaveBeenCalled()
      expect(result).toBe('/resource/userData/models/hula.glb')
    })

    it('uses AppData on mobile', async () => {
      isMobileMock.mockReturnValue(true)
      existsMock.mockResolvedValue(true)
      const result = await ensureModelFile('hula.glb', 'https://example.com/hula.glb')
      expect(result).toBe('/app-data/userData/models/hula.glb')
    })
  })

  describe('detectRemoteFileType', () => {
    it('returns undefined for non-http URLs', async () => {
      const result = await detectRemoteFileType({ url: 'file:///path/to/file.txt' })
      expect(result).toBeUndefined()
      expect(headMock).not.toHaveBeenCalled()
    })

    it('detects file type via HEAD + Range GET + fileTypeFromBuffer', async () => {
      headMock.mockResolvedValue(new Response(null, { headers: { 'content-length': '8192' } }))
      downloadBytesMock.mockResolvedValue(new ArrayBuffer(8))
      const result = await detectRemoteFileType({ url: 'https://example.com/image.png' })
      expect(headMock).toHaveBeenCalledWith('https://example.com/image.png')
      expect(downloadBytesMock).toHaveBeenCalledWith('https://example.com/image.png', {
        headers: { Range: 'bytes=0-4099' }
      })
      expect(fileTypeFromBufferMock).toHaveBeenCalled()
      expect(result).toEqual({ ext: 'png', mime: 'image/png' })
    })

    it('returns undefined for empty files (size 0) when get_files_meta returns null', async () => {
      headMock.mockResolvedValue(new Response(null, { headers: { 'content-length': '0' } }))
      invokeSilentlyMock.mockResolvedValue(null)
      const result = await detectRemoteFileType({ url: 'https://example.com/empty.png' })
      expect(result).toBeUndefined()
    })

    it('detects file type from backend meta for empty files', async () => {
      headMock.mockResolvedValue(new Response(null, { headers: { 'content-length': '0' } }))
      invokeSilentlyMock.mockResolvedValue([{ file_type: 'txt', mime_type: 'text/plain' }] as never)
      const result = await detectRemoteFileType({ url: 'https://example.com/empty.txt' })
      expect(result).toEqual({ ext: 'txt', mime: 'text/plain' })
    })

    it('returns undefined when HEAD request fails', async () => {
      headMock.mockRejectedValue(new Error('network error'))
      const result = await detectRemoteFileType({ url: 'https://example.com/missing.png' })
      expect(result).toBeUndefined()
    })

    it('uses small-file GET path when fileSize is below byteLength', async () => {
      headMock.mockResolvedValue(new Response(null, { headers: { 'content-length': '100' } }))
      downloadBytesMock.mockResolvedValue(new ArrayBuffer(8))
      const result = await detectRemoteFileType({
        url: 'https://example.com/small.png',
        byteLength: 4100
      })
      // When file size is below byteLength, the Range header should NOT be sent
      expect(downloadBytesMock).toHaveBeenCalledWith('https://example.com/small.png', {
        headers: undefined
      })
      expect(result).toEqual({ ext: 'png', mime: 'image/png' })
    })

    it('caches subsequent calls for the same URL', async () => {
      headMock.mockResolvedValue(new Response(null, { headers: { 'content-length': '8192' } }))
      downloadBytesMock.mockResolvedValue(new ArrayBuffer(8))
      const url = 'https://example.com/cached.png'
      const first = await detectRemoteFileType({ url })
      const second = await detectRemoteFileType({ url })
      expect(first).toEqual({ ext: 'png', mime: 'image/png' })
      expect(second).toEqual(first)
      // Only the first call should have triggered HEAD/GET
      expect(headMock).toHaveBeenCalledTimes(1)
      expect(downloadBytesMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('getFile', () => {
    it('reads file data and returns File object with meta', async () => {
      const result = await getFile('/tmp/file.txt')
      expect(readFileMock).toHaveBeenCalledWith('/tmp/file.txt')
      expect(result.file).toBeInstanceOf(File)
      expect(result.meta).toEqual({
        name: 'file.txt',
        path: '/p',
        file_type: 'txt',
        mime_type: 'text/plain',
        exists: true
      })
    })
  })
})
