import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { AdminMediaService } from '../MediaService'

const TEST_BASE_URL = 'https://matrix.example.com'

const _server = setupMswServer(
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

const makeAdmin = () => ({
  getMedia: vi.fn(),
  deleteMedia: vi.fn(),
  purgeMediaCache: vi.fn(),
  getMediaStats: vi.fn()
})

describe('AdminMediaService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let service: AdminMediaService

  beforeEach(() => {
    vi.clearAllMocks()
    authedRequestImpl.mockImplementation(
      async (method: string, path: string, queryParams?: unknown, body?: unknown) => {
        const url = new URL(`${TEST_BASE_URL}${path}`)
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
          body: body ? JSON.stringify(body) : undefined
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

  it('getMediaStats 出错时返回 null', async () => {
    admin.getMediaStats.mockRejectedValueOnce(new Error('boom'))
    await expect(service.getMediaStats()).resolves.toBeNull()
  })

  it('purgeRemoteMedia 通过 admin HTTP 端点发送 before_ts 与 include_profiles', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue({ http: { authedRequest: authedRequestImpl } } as never)

    await expect(service.purgeRemoteMedia(1700000000000, true)).resolves.toEqual({ deleted: 3 })
    expect(authedRequestImpl).toHaveBeenCalledWith('POST', '/_matrix/client/v1/admin/purge_remote_media', undefined, {
      before_ts: 1700000000000,
      include_profiles: true
    })
  })

  it('purgeRemoteMedia 客户端未初始化时抛错', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)
    await expect(service.purgeRemoteMedia(1)).rejects.toThrow('[AdminMedia] 客户端未初始化')
  })
})
