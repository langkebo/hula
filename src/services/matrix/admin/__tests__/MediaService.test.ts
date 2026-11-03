import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { AdminMediaService } from '../MediaService'

const TEST_BASE_URL = 'https://matrix.example.com'
const PREFIX_V3 = '/_matrix/client/v3'

setupMswServer(
  http.post(`${TEST_BASE_URL}/_matrix/client/v1/admin/purge_remote_media`, () => {
    return HttpResponse.json({ deleted: 3 })
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const authedRequestImpl = vi.fn()

function makeAdmin(overrides: Record<string, unknown> = {}) {
  return {
    getMedia: vi.fn().mockResolvedValue({ media: [], total: 0, next_batch: null }),
    getMediaInfo: vi.fn().mockResolvedValue({ media_id: 'm1', media_type: 'image/png' }),
    getMediaInfoByServer: vi.fn().mockResolvedValue({ media_id: 'm1' }),
    deleteMedia: vi.fn().mockResolvedValue(undefined),
    deleteMediaByServer: vi.fn().mockResolvedValue(undefined),
    purgeMediaCache: vi.fn().mockResolvedValue({ deleted: 0 }),
    deleteMediaByPolicy: vi.fn().mockResolvedValue({ deleted: 3 }),
    quarantineMedia: vi.fn().mockResolvedValue(undefined),
    unquarantineMedia: vi.fn().mockResolvedValue(undefined),
    protectMedia: vi.fn().mockResolvedValue({ stream_id: 1, protected: true }),
    protectMediaById: vi.fn().mockResolvedValue({ stream_id: 1, protected: true }),
    unprotectMedia: vi.fn().mockResolvedValue({ stream_id: 1, unprotected: true }),
    getGlobalMediaQuarantineChanges: vi.fn().mockResolvedValue({ next_batch: 0, changes: [] }),
    getMediaQuarantineChanges: vi.fn().mockResolvedValue({ changes: [], total: 0 }),
    getRoomMedia: vi.fn().mockResolvedValue({ media: [], total: 0, next_batch: null }),
    deleteRoomMedia: vi.fn().mockResolvedValue(undefined),
    quarantineRoomMedia: vi.fn().mockResolvedValue({ room_id: '!r:a', quarantined: true }),
    unquarantineRoomMedia: vi.fn().mockResolvedValue({ room_id: '!r:a', quarantined: false }),
    getUserMedia: vi.fn().mockResolvedValue({ media: [], total: 0 }),
    deleteUserMedia: vi.fn().mockResolvedValue({ deleted: 0 }),
    quarantineUserMedia: vi.fn().mockResolvedValue({ user_id: '@u:a', quarantined: true }),
    ...overrides
  }
}

describe('AdminMediaService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let service: AdminMediaService

  beforeEach(() => {
    vi.clearAllMocks()
    authedRequestImpl.mockImplementation(
      async (method: string, path: string, queryParams?: unknown, body?: unknown, opts?: { prefix?: string }) => {
        const defaultPrefix = path.startsWith('/_') ? '' : PREFIX_V3
        const prefix = opts?.prefix ?? defaultPrefix
        const url = new URL(`${TEST_BASE_URL}${prefix}${path}`)
        if (queryParams && typeof queryParams === 'object') {
          for (const [key, value] of Object.entries(queryParams as Record<string, string>)) {
            url.searchParams.set(key, value)
          }
        }
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-access-token'
        }
        const response = await fetch(url.toString(), {
          method,
          headers,
          ...(body ? { body: JSON.stringify(body) } : {})
        })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return response.json()
      }
    )
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    admin = makeAdmin()
    service = new AdminMediaService(async () => admin)
  })

  it('getMediaList 将 snake_case 映射为 facade 形状', async () => {
    admin.getMedia.mockResolvedValueOnce({
      media: [
        {
          media_id: 'm1',
          media_type: 'image/png',
          content_uri: 'mxc://hs/m1',
          created_ts: 100,
          upload_name: 'a.png',
          media_length: 2048
        }
      ],
      next_token: 'tok'
    })

    await expect(service.getMediaList(20, 'from-1')).resolves.toEqual({
      media: [
        {
          mediaId: 'm1',
          mediaType: 'image/png',
          contentUri: 'mxc://hs/m1',
          createdAt: 100,
          uploadName: 'a.png',
          mediaLength: 2048
        }
      ],
      nextToken: 'tok'
    })
    expect(admin.getMedia).toHaveBeenCalledWith(20, 'from-1')
  })

  it('getMediaList 出错时降级为空列表', async () => {
    admin.getMedia.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getMediaList()).resolves.toEqual({ media: [] })
  })

  it('deleteMedia 失败时向上抛出', async () => {
    admin.deleteMedia.mockRejectedValueOnce(new Error('M_NOT_FOUND'))
    await expect(service.deleteMedia('m404')).rejects.toThrow('M_NOT_FOUND')
  })

  it('purgeMediaCache 缺省返回 deleted 0', async () => {
    admin.purgeMediaCache.mockResolvedValueOnce({})
    await expect(service.purgeMediaCache(123)).resolves.toEqual({ deleted: 0 })
    expect(admin.purgeMediaCache).toHaveBeenCalledWith(123)
  })

  it('getMediaInfo 成功时透传媒体字段', async () => {
    admin.getMediaInfo.mockResolvedValueOnce({ media_id: 'm9', media_type: 'image/jpeg', media_length: 123 })
    await expect(service.getMediaInfo('m9')).resolves.toEqual({
      media_id: 'm9',
      media_type: 'image/jpeg',
      media_length: 123
    })
    expect(admin.getMediaInfo).toHaveBeenCalledWith('m9')
  })

  it('getMediaInfo 出错时返回 null', async () => {
    admin.getMediaInfo.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getMediaInfo('m1')).resolves.toBeNull()
  })

  it('quarantineMedia 透传 serverName 与 mediaId', async () => {
    await service.quarantineMedia('a.example', 'm1')
    expect(admin.quarantineMedia).toHaveBeenCalledWith('a.example', 'm1')
  })

  it('deleteMediaByPolicy 透传过滤条件', async () => {
    await expect(service.deleteMediaByPolicy({ beforeTs: 1000, maxSize: 2048 })).resolves.toEqual({ deleted: 3 })
    expect(admin.deleteMediaByPolicy).toHaveBeenCalledWith({ beforeTs: 1000, maxSize: 2048 })
  })

  it('getGlobalQuarantineChanges 默认游标为 0', async () => {
    await service.getGlobalQuarantineChanges()
    expect(admin.getGlobalMediaQuarantineChanges).toHaveBeenCalledWith({ from: 0 })
  })

  it('getUserMedia 成功时透传 media 与 total', async () => {
    admin.getUserMedia.mockResolvedValueOnce({
      media: [{ media_id: 'u1', media_type: 'image/png', media_length: 256 }],
      total: 1
    })
    await expect(service.getUserMedia('@u:a')).resolves.toEqual({
      media: [{ media_id: 'u1', media_type: 'image/png', media_length: 256 }],
      total: 1
    })
    expect(admin.getUserMedia).toHaveBeenCalledWith('@u:a')
  })

  it('getUserMedia 出错时返回 null', async () => {
    admin.getUserMedia.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getUserMedia('@u:a')).resolves.toBeNull()
  })

  it('getMediaList 优先使用 next_batch 作为游标', async () => {
    admin.getMedia.mockResolvedValueOnce({
      media: [{ media_id: 'm2', media_type: 'image/png', created_ts: 1 }],
      total: 1,
      next_batch: 'batch-1'
    })
    const page = await service.getMediaList(10)
    expect(page.nextToken).toBe('batch-1')
    expect(page.media).toEqual([
      {
        mediaId: 'm2',
        mediaType: 'image/png',
        contentUri: '',
        createdAt: 1,
        uploadName: undefined,
        mediaLength: undefined
      }
    ])
  })

  it('getRoomMedia 省略 from/limit 时不带查询参数', async () => {
    await service.getRoomMedia('!r:a')
    expect(admin.getRoomMedia).toHaveBeenCalledWith('!r:a', undefined)
  })

  it('quarantineRoomMedia 省略 userId 时不带 userId 字段', async () => {
    await expect(service.quarantineRoomMedia('!r:a')).resolves.toEqual({ room_id: '!r:a', quarantined: true })
    expect(admin.quarantineRoomMedia).toHaveBeenCalledWith('!r:a', undefined)
  })

  it('deleteUserMedia 成功时透传 deleted', async () => {
    admin.deleteUserMedia.mockResolvedValueOnce({ deleted: 7 })
    await expect(service.deleteUserMedia('@u:a')).resolves.toEqual({ deleted: 7 })
    expect(admin.deleteUserMedia).toHaveBeenCalledWith('@u:a')
  })

  it('getMediaQuarantineChanges 透传 from 与 limit', async () => {
    await service.getMediaQuarantineChanges('m1', { from: 'sid-3', limit: 50 })
    expect(admin.getMediaQuarantineChanges).toHaveBeenCalledWith('m1', { from: 'sid-3', limit: 50 })
  })

  it('getMediaQuarantineChanges 省略 options 时只透传 mediaId', async () => {
    await expect(service.getMediaQuarantineChanges('m1')).resolves.toEqual({ changes: [], total: 0 })
    expect(admin.getMediaQuarantineChanges).toHaveBeenCalledWith('m1', undefined)
  })
})
