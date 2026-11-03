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
    getMediaQuota: vi.fn().mockResolvedValue({}),
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
    deleteUserMedia: vi.fn().mockResolvedValue(undefined),
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
})

it('getMediaInfo 出错时返回 null', async () => {
  const admin = makeAdmin({ getMediaInfo: vi.fn().mockRejectedValue(new Error('boom')) })
  const svc = new AdminMediaService(() => admin as never)
  expect(await svc.getMediaInfo('m1')).toBeNull()
})

it('quarantineMedia 透传 serverName 与 mediaId', async () => {
  const admin = makeAdmin()
  const svc = new AdminMediaService(() => admin as never)
  await svc.quarantineMedia('a.example', 'm1')
  expect(admin.quarantineMedia).toHaveBeenCalledWith('a.example', 'm1')
})

it('deleteMediaByPolicy 透传过滤条件', async () => {
  const admin = makeAdmin()
  const svc = new AdminMediaService(() => admin as never)
  expect(await svc.deleteMediaByPolicy({ beforeTs: 1000, maxSize: 2048 })).toEqual({ deleted: 3 })
  expect(admin.deleteMediaByPolicy).toHaveBeenCalledWith({ beforeTs: 1000, maxSize: 2048 })
})

it('getGlobalQuarantineChanges 默认游标为 0', async () => {
  const admin = makeAdmin()
  const svc = new AdminMediaService(() => admin as never)
  await svc.getGlobalQuarantineChanges()
  expect(admin.getGlobalMediaQuarantineChanges).toHaveBeenCalledWith({ from: 0 })
})

it('getUserMedia 出错时返回 null', async () => {
  const admin = makeAdmin({ getUserMedia: vi.fn().mockRejectedValue(new Error('boom')) })
  const svc = new AdminMediaService(() => admin as never)
  expect(await svc.getUserMedia('@u:a')).toBeNull()
})
