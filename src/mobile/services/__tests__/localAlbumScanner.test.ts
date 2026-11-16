import { describe, expect, it, vi } from 'vitest'

/**
 * 移动端相册扫描器（§19.23）。
 *
 * 这段逻辑原先住在 `stores/domains/widget/file.ts`，靠运行时 `isMobile()` 判断挡桌面，
 * 但唯一调用方本来就是移动端页面 —— 属「用运行时分支冒充平台边界」。
 * 下沉到 `src/mobile/` 后，本文件锁住三件行为：
 *  1. 只收图片/视频（其余扩展名与子目录一律跳过）；
 * ② `mimeType` / `suffix` / 相对 url 的推导规则；
 *  3. 目录不可读时**吞错返回 0**，不把相册扫描失败升级成页面异常。
 */
const { readDirMock, joinMock } = vi.hoisted(() => ({
  readDirMock: vi.fn(),
  joinMock: vi.fn(async (...parts: string[]) => parts.join('/'))
}))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => '/app/data'),
  join: joinMock
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: readDirMock
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

import { resolveAlbumMediaType, resolveAlbumMimeType, scanLocalAlbum } from '../localAlbumScanner'

const entry = (name: string, isFile = true) => ({ name, isFile, isDirectory: !isFile, isSymlink: false })

const makeDeps = () => ({ getUserRoomDir: vi.fn(async () => 'room-1/media'), addFile: vi.fn() })

describe('scanLocalAlbum', () => {
  it('只把图片/视频写入 store，并推导 suffix / mimeType / 相对 url', async () => {
    readDirMock.mockResolvedValue([
      entry('a.jpg'),
      entry('b.MOV'),
      entry('c.txt'),
      entry('noext'),
      entry('nested', false)
    ])
    const deps = makeDeps()

    const count = await scanLocalAlbum('!room:hs', deps)

    expect(count).toBe(2)
    expect(deps.addFile).toHaveBeenCalledTimes(2)
    expect(deps.addFile).toHaveBeenNthCalledWith(1, {
      id: 'a',
      roomId: '!room:hs',
      fileName: 'a.jpg',
      type: 'image',
      url: 'room-1/media/a.jpg',
      suffix: 'jpg',
      mimeType: 'image/jpeg'
    })
    // 大小写混写的扩展名：类型判定与 mimeType 都要按小写归一；
    // `.mov` 的标准注册值是 video/quicktime，拼接出的 video/mov 并不存在
    expect(deps.addFile).toHaveBeenNthCalledWith(2, {
      id: 'b',
      roomId: '!room:hs',
      fileName: 'b.MOV',
      type: 'video',
      url: 'room-1/media/b.MOV',
      suffix: 'mov',
      mimeType: 'video/quicktime'
    })
  })

  it('目录不可读时吞错返回 0（不抛给相册页）', async () => {
    readDirMock.mockRejectedValue(new Error('EACCES'))
    const deps = makeDeps()

    await expect(scanLocalAlbum('!room:hs', deps)).resolves.toBe(0)
    expect(deps.addFile).not.toHaveBeenCalled()
  })

  it('roomId 为空时不碰文件系统', async () => {
    readDirMock.mockClear()
    const deps = makeDeps()

    await expect(scanLocalAlbum('', deps)).resolves.toBe(0)
    expect(readDirMock).not.toHaveBeenCalled()
    expect(deps.getUserRoomDir).not.toHaveBeenCalled()
  })

  it('resolveAlbumMediaType 只认白名单扩展名', () => {
    expect(resolveAlbumMediaType('.png')).toBe('image')
    expect(resolveAlbumMediaType('.webm')).toBe('video')
    expect(resolveAlbumMediaType('.pdf')).toBeNull()
    expect(resolveAlbumMediaType('')).toBeNull()
  })

  it('resolveAlbumMimeType 返回标准 MIME，未知扩展名回退二进制流', () => {
    expect(resolveAlbumMimeType('.jpg')).toBe('image/jpeg')
    expect(resolveAlbumMimeType('MOV')).toBe('video/quicktime')
    expect(resolveAlbumMimeType('.mkv')).toBe('video/x-matroska')
    // 未知扩展名不能伪造 video/xxx
    expect(resolveAlbumMimeType('.xyz')).toBe('application/octet-stream')
    expect(resolveAlbumMimeType('')).toBe('application/octet-stream')
  })
})
