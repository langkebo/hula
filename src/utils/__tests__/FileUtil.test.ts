import { beforeEach, describe, expect, it, vi } from 'vitest'

const { openMock, copyFileMock, statMock, joinMock, getFilesMetaMock, getUserRoomAbsoluteDirMock } = vi.hoisted(() => ({
  openMock: vi.fn(),
  copyFileMock: vi.fn(),
  statMock: vi.fn(),
  joinMock: vi.fn(),
  getFilesMetaMock: vi.fn(),
  getUserRoomAbsoluteDirMock: vi.fn()
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  copyFile: copyFileMock,
  stat: statMock
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: joinMock
}))

vi.mock('@/utils/PathUtil', () => ({
  getFilesMeta: getFilesMetaMock
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    getUserRoomAbsoluteDir: getUserRoomAbsoluteDirMock
  })
}))

vi.mock('@/utils/Formatting', () => ({
  extractFileName: vi.fn((path: string) => path.split('/').pop() || path)
}))

import FileUtil from '../FileUtil'

describe('FileUtil', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    joinMock.mockImplementation((...args: string[]) => args.join('/'))
    getUserRoomAbsoluteDirMock.mockResolvedValue('/user/dir')
  })

  describe('map2PathUploadFile', () => {
    it('converts paths and meta to PathUploadFile array', async () => {
      const files = ['/tmp/a.pdf', '/tmp/b.txt']
      const filesMeta = [
        { path: '/tmp/a.pdf', name: 'a.pdf', mime_type: 'application/pdf' },
        { path: '/tmp/b.txt', name: 'b.txt', mime_type: 'text/plain' }
      ] as never
      statMock.mockResolvedValue({ size: 100 })

      const result = await FileUtil.map2PathUploadFile(files, filesMeta)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        kind: 'path',
        path: '/tmp/a.pdf',
        name: 'a.pdf',
        size: 100,
        type: 'application/pdf'
      })
      expect(result[1]).toEqual({
        kind: 'path',
        path: '/tmp/b.txt',
        name: 'b.txt',
        size: 100,
        type: 'text/plain'
      })
    })

    it('falls back to extractFileName when meta is missing', async () => {
      const files = ['/tmp/missing.png']
      statMock.mockResolvedValue({ size: 50 })

      const result = await FileUtil.map2PathUploadFile(files, [] as never)

      expect(result[0].name).toBe('missing.png')
    })

    it('falls back to application/octet-stream when mime_type is missing', async () => {
      const files = ['/tmp/x']
      const filesMeta = [{ path: '/tmp/x', name: 'x' }] as never
      statMock.mockResolvedValue({ size: 0 })

      const result = await FileUtil.map2PathUploadFile(files, filesMeta)

      expect(result[0].type).toBe('application/octet-stream')
    })

    it('returns size 0 when stat throws', async () => {
      const files = ['/tmp/err.bin']
      statMock.mockRejectedValue(new Error('stat failed'))

      const result = await FileUtil.map2PathUploadFile(files, [] as never)

      expect(result[0].size).toBe(0)
    })

    it('handles empty files array', async () => {
      const result = await FileUtil.map2PathUploadFile([], [] as never)
      expect(result).toEqual([])
    })
  })

  describe('copyUploadFile', () => {
    it('copies each file to userResourceDir', async () => {
      const files = ['/tmp/a.pdf', '/tmp/b.txt']
      const filesMeta = [
        { path: '/tmp/a.pdf', name: 'a.pdf' },
        { path: '/tmp/b.txt', name: 'b.txt' }
      ] as never
      copyFileMock.mockResolvedValue(undefined)

      await FileUtil.copyUploadFile(files, filesMeta)

      expect(copyFileMock).toHaveBeenCalledWith('/tmp/a.pdf', '/user/dir/a.pdf')
      expect(copyFileMock).toHaveBeenCalledWith('/tmp/b.txt', '/user/dir/b.txt')
      expect(copyFileMock).toHaveBeenCalledTimes(2)
    })

    it('skips files without matching meta', async () => {
      const files = ['/tmp/a.pdf', '/tmp/missing.txt']
      const filesMeta = [{ path: '/tmp/a.pdf', name: 'a.pdf' }] as never

      await FileUtil.copyUploadFile(files, filesMeta)

      expect(copyFileMock).toHaveBeenCalledTimes(1)
      expect(copyFileMock).toHaveBeenCalledWith('/tmp/a.pdf', '/user/dir/a.pdf')
    })

    it('continues copying other files when one fails', async () => {
      const files = ['/tmp/a.pdf', '/tmp/b.txt']
      const filesMeta = [
        { path: '/tmp/a.pdf', name: 'a.pdf' },
        { path: '/tmp/b.txt', name: 'b.txt' }
      ] as never
      copyFileMock.mockRejectedValueOnce(new Error('copy fail'))

      await FileUtil.copyUploadFile(files, filesMeta)

      expect(copyFileMock).toHaveBeenCalledTimes(2)
    })

    it('handles empty files array', async () => {
      await FileUtil.copyUploadFile([], [] as never)
      expect(copyFileMock).not.toHaveBeenCalled()
    })

    it('uses provided userResourceDir instead of dynamic import', async () => {
      const files = ['/tmp/a.pdf']
      const filesMeta = [{ path: '/tmp/a.pdf', name: 'a.pdf' }] as never
      copyFileMock.mockResolvedValue(undefined)

      await FileUtil.copyUploadFile(files, filesMeta, '/custom/dir')

      expect(copyFileMock).toHaveBeenCalledWith('/tmp/a.pdf', '/custom/dir/a.pdf')
      expect(getUserRoomAbsoluteDirMock).not.toHaveBeenCalled()
    })
  })

  describe('openAndCopyFile', () => {
    it('returns null when user cancels selection', async () => {
      openMock.mockResolvedValue(null)

      const result = await FileUtil.openAndCopyFile()

      expect(result).toBeNull()
    })

    it('handles single file selection (not array)', async () => {
      openMock.mockResolvedValue('/tmp/single.pdf')
      getFilesMetaMock.mockResolvedValue([
        { path: '/tmp/single.pdf', name: 'single.pdf', mime_type: 'application/pdf' }
      ])
      statMock.mockResolvedValue({ size: 200 })

      const result = await FileUtil.openAndCopyFile()

      expect(result).not.toBeNull()
      expect(result?.files).toHaveLength(1)
      expect(result?.files[0].path).toBe('/tmp/single.pdf')
      expect(result?.filesMeta).toHaveLength(1)
    })

    it('handles multiple file selection', async () => {
      openMock.mockResolvedValue(['/tmp/a.pdf', '/tmp/b.pdf'])
      getFilesMetaMock.mockResolvedValue([
        { path: '/tmp/a.pdf', name: 'a.pdf', mime_type: 'application/pdf' },
        { path: '/tmp/b.pdf', name: 'b.pdf', mime_type: 'application/pdf' }
      ])
      statMock.mockResolvedValue({ size: 100 })

      const result = await FileUtil.openAndCopyFile()

      expect(result?.files).toHaveLength(2)
      expect(result?.filesMeta).toHaveLength(2)
    })

    it('passes userResourceDir to copyUploadFile', async () => {
      openMock.mockResolvedValue(['/tmp/a.pdf'])
      getFilesMetaMock.mockResolvedValue([{ path: '/tmp/a.pdf', name: 'a.pdf', mime_type: 'application/pdf' }])
      statMock.mockResolvedValue({ size: 100 })
      copyFileMock.mockResolvedValue(undefined)

      await FileUtil.openAndCopyFile('/custom/dir')

      // copyUploadFile 是 void 调用（异步），等待微任务完成
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(copyFileMock).toHaveBeenCalledWith('/tmp/a.pdf', '/custom/dir/a.pdf')
      expect(getUserRoomAbsoluteDirMock).not.toHaveBeenCalled()
    })
  })
})
