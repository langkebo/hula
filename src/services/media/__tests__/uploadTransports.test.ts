import { beforeEach, describe, expect, it, vi } from 'vitest'
import { uploadPathViaMatrix } from '../uploadTransports'

const { uploadFileMock, getMediaUrlMock, readFileMock } = vi.hoisted(() => ({
  uploadFileMock: vi.fn(),
  getMediaUrlMock: vi.fn(),
  readFileMock: vi.fn()
}))

vi.mock('@tauri-apps/plugin-fs', () => ({ readFile: readFileMock, writeFile: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ Channel: class {} }))
vi.mock('@/utils/PathUtil', () => ({ getCacheBaseDir: () => 'cache', getCacheBaseDirName: () => 'cache' }))
vi.mock('@/utils/TempFileManager', () => ({ removeTempFile: vi.fn() }))
vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: { uploadFile: uploadFileMock, getMediaUrl: getMediaUrlMock }
}))

const uploadedFile = (): File => uploadFileMock.mock.calls[0][0] as File

describe('uploadPathViaMatrix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uploadFileMock.mockResolvedValue({ contentUri: 'mxc://server/abc' })
    getMediaUrlMock.mockReturnValue('https://matrix.test/_matrix/media/abc')
  })

  it('声明类型优先，扩展名与文件头都不参与', async () => {
    readFileMock.mockResolvedValue(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))

    await uploadPathViaMatrix('/tmp/a.dat', 'text/csv')

    expect(uploadedFile().type).toBe('text/csv')
  })

  it('无声明类型时按扩展名推导', async () => {
    readFileMock.mockResolvedValue(Uint8Array.from([0x00, 0x01]))

    await uploadPathViaMatrix('/tmp/clip.MP4')

    expect(uploadedFile().type).toBe('video/mp4')
    expect(uploadedFile().name).toBe('clip.MP4')
  })

  it('无声明类型且扩展名不可判定时按文件头嗅探', async () => {
    readFileMock.mockResolvedValue(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))

    await uploadPathViaMatrix('/tmp/screenshot')

    expect(uploadedFile().type).toBe('image/png')
    expect(uploadedFile().name).toBe('screenshot')
  })

  it('文件头也未命中时回退 application/octet-stream', async () => {
    readFileMock.mockResolvedValue(Uint8Array.from([0x00, 0x01, 0x02]))

    await uploadPathViaMatrix('/tmp/blob')

    expect(uploadedFile().type).toBe('application/octet-stream')
  })
})
