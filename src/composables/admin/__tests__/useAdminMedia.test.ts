import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getMediaList: vi.fn(),
    getMediaInfo: vi.fn(),
    getMediaInfoByServer: vi.fn(),
    getGlobalQuarantineChanges: vi.fn(),
    getMediaQuarantineChanges: vi.fn(),
    getRoomMedia: vi.fn(),
    getUserMedia: vi.fn(),
    deleteMedia: vi.fn(),
    deleteMediaByServer: vi.fn(),
    deleteMediaByPolicy: vi.fn(),
    quarantineMedia: vi.fn(),
    unquarantineMedia: vi.fn(),
    protectMedia: vi.fn(),
    protectMediaById: vi.fn(),
    unprotectMedia: vi.fn(),
    deleteRoomMedia: vi.fn(),
    quarantineRoomMedia: vi.fn(),
    unquarantineRoomMedia: vi.fn(),
    deleteUserMedia: vi.fn(),
    quarantineUserMedia: vi.fn()
  }
}))

import { adminService } from '@/services/matrix/admin'
import { useAdminMedia } from '../useAdminMedia'

describe('useAdminMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loadLibrary 首次加载写入列表与游标', async () => {
    vi.mocked(adminService.getMediaList).mockResolvedValueOnce({
      media: [
        {
          mediaId: 'm1',
          mediaType: 'image/png',
          contentUri: 'mxc://a.example/m1',
          createdAt: 1700000000000
        }
      ],
      nextToken: 'cursor-2'
    })

    const c = useAdminMedia()
    await c.loadLibrary()

    expect(c.library.value).toHaveLength(1)
    expect(c.libraryNextBatch.value).toBe('cursor-2')
    expect(c.libraryLoading.value).toBe(false)
    expect(adminService.getMediaList).toHaveBeenCalledWith(100, undefined)
  })

  it('loadMoreLibrary 携带游标追加并刷新游标', async () => {
    vi.mocked(adminService.getMediaList)
      .mockResolvedValueOnce({
        media: [
          {
            mediaId: 'm1',
            mediaType: 'image/png',
            contentUri: '',
            createdAt: 1
          }
        ],
        nextToken: 'cursor-2'
      })
      .mockResolvedValueOnce({
        media: [
          {
            mediaId: 'm2',
            mediaType: 'video/mp4',
            contentUri: '',
            createdAt: 2
          }
        ]
      })

    const c = useAdminMedia()
    await c.loadLibrary()
    await c.loadMoreLibrary()

    expect(c.library.value).toHaveLength(2)
    expect(c.libraryNextBatch.value).toBeNull()
    expect(adminService.getMediaList).toHaveBeenLastCalledWith(100, 'cursor-2')

    await c.loadMoreLibrary()
    expect(adminService.getMediaList).toHaveBeenCalledTimes(2)
  })

  it('loadLibrary 失败时清空列表且不抛出', async () => {
    vi.mocked(adminService.getMediaList).mockRejectedValueOnce(new Error('boom'))

    const c = useAdminMedia()
    await expect(c.loadLibrary()).resolves.toBeUndefined()

    expect(c.library.value).toEqual([])
    expect(c.libraryNextBatch.value).toBeNull()
    expect(c.libraryLoading.value).toBe(false)
  })

  it('openMediaDetail 写入详情，返回 null 时置空', async () => {
    vi.mocked(adminService.getMediaInfo).mockResolvedValueOnce({ media_id: 'm1', media_type: 'image/png' })

    const c = useAdminMedia()
    await c.openMediaDetail('m1')

    expect(c.selectedMedia.value).toEqual({ media_id: 'm1', media_type: 'image/png' })
    expect(c.detailLoading.value).toBe(false)

    vi.mocked(adminService.getMediaInfo).mockResolvedValueOnce(null)
    await c.openMediaDetail('m2')
    expect(c.selectedMedia.value).toBeNull()
  })

  it('openMediaDetailByServer 走按服务器查询并写入详情', async () => {
    vi.mocked(adminService.getMediaInfoByServer).mockResolvedValueOnce({
      media_id: 'm1',
      media_type: 'image/png'
    })

    const c = useAdminMedia()
    await c.openMediaDetailByServer('hs.example', 'm1')

    expect(adminService.getMediaInfoByServer).toHaveBeenCalledWith('hs.example', 'm1')
    expect(c.selectedMedia.value).toEqual({ media_id: 'm1', media_type: 'image/png' })
    expect(c.detailLoading.value).toBe(false)

    vi.mocked(adminService.getMediaInfoByServer).mockResolvedValueOnce(null)
    await c.openMediaDetailByServer('hs.example', 'm2')
    expect(c.selectedMedia.value).toBeNull()
  })

  it('openMediaDetailByServer 抛错时清空详情', async () => {
    vi.mocked(adminService.getMediaInfoByServer).mockRejectedValueOnce(new Error('boom'))

    const c = useAdminMedia()
    await c.openMediaDetailByServer('hs.example', 'm1')

    expect(c.selectedMedia.value).toBeNull()
    expect(c.detailLoading.value).toBe(false)
  })

  it('closeMediaDetail 清空详情', async () => {
    vi.mocked(adminService.getMediaInfo).mockResolvedValueOnce({ media_id: 'm1' })

    const c = useAdminMedia()
    await c.openMediaDetail('m1')
    c.closeMediaDetail()

    expect(c.selectedMedia.value).toBeNull()
  })

  it('loadQuarantineChanges 使用数值游标翻页', async () => {
    vi.mocked(adminService.getGlobalQuarantineChanges)
      .mockResolvedValueOnce({
        next_batch: 42,
        changes: [{ origin: 'a.example', media_id: 'm1', quarantined: true }]
      })
      .mockResolvedValueOnce({
        next_batch: 43,
        changes: [{ origin: 'a.example', media_id: 'm2', quarantined: false }]
      })

    const c = useAdminMedia()
    await c.loadQuarantineChanges()
    expect(c.quarantineChanges.value).toHaveLength(1)
    expect(c.quarantineNextBatch.value).toBe(42)
    expect(adminService.getGlobalQuarantineChanges).toHaveBeenCalledWith(undefined)

    await c.loadMoreQuarantineChanges()
    expect(c.quarantineChanges.value).toHaveLength(2)
    expect(c.quarantineNextBatch.value).toBe(43)
    expect(adminService.getGlobalQuarantineChanges).toHaveBeenLastCalledWith(42)
  })

  it('loadQuarantineChanges 失败时清空变更流', async () => {
    vi.mocked(adminService.getGlobalQuarantineChanges).mockResolvedValueOnce(null)

    const c = useAdminMedia()
    await c.loadQuarantineChanges()

    expect(c.quarantineChanges.value).toEqual([])
    expect(c.quarantineNextBatch.value).toBe(0)
    expect(c.quarantineLoading.value).toBe(false)
  })

  it('loadMoreQuarantineChanges 本页为空时停止且不再发请求', async () => {
    vi.mocked(adminService.getGlobalQuarantineChanges)
      .mockResolvedValueOnce({
        next_batch: 42,
        changes: [{ origin: 'a.example', media_id: 'm1', quarantined: true }]
      })
      .mockResolvedValueOnce({
        next_batch: 42,
        changes: []
      })

    const c = useAdminMedia()
    await c.loadQuarantineChanges()
    await c.loadMoreQuarantineChanges()

    expect(adminService.getGlobalQuarantineChanges).toHaveBeenLastCalledWith(42)
    expect(c.quarantineChanges.value).toHaveLength(1)

    await c.loadMoreQuarantineChanges()
    expect(adminService.getGlobalQuarantineChanges).toHaveBeenCalledTimes(2)
    expect(c.quarantineChanges.value).toHaveLength(1)
  })

  it('loadMoreQuarantineChanges 游标未前进时不重复追加且停止翻页', async () => {
    vi.mocked(adminService.getGlobalQuarantineChanges)
      .mockResolvedValueOnce({
        next_batch: 42,
        changes: [{ origin: 'a.example', media_id: 'm1', quarantined: true }]
      })
      .mockResolvedValueOnce({
        next_batch: 42,
        changes: [{ origin: 'a.example', media_id: 'm1', quarantined: true }]
      })

    const c = useAdminMedia()
    await c.loadQuarantineChanges()
    await c.loadMoreQuarantineChanges()

    expect(adminService.getGlobalQuarantineChanges).toHaveBeenLastCalledWith(42)
    expect(c.quarantineChanges.value).toHaveLength(1)

    await c.loadMoreQuarantineChanges()
    expect(adminService.getGlobalQuarantineChanges).toHaveBeenCalledTimes(2)
    expect(c.quarantineChanges.value).toHaveLength(1)
  })

  it('loadMediaQuarantineHistory 返回变更列表，失败时为[]', async () => {
    vi.mocked(adminService.getMediaQuarantineChanges).mockResolvedValueOnce({
      changes: [
        {
          stream_id: 1,
          media_id: 'm1',
          server_name: 'a.example',
          change_type: 'quarantine',
          changed_by: '@admin:a.example',
          created_ts: 1
        }
      ],
      total: 1
    })

    const c = useAdminMedia()
    await expect(c.loadMediaQuarantineHistory('m1')).resolves.toHaveLength(1)

    vi.mocked(adminService.getMediaQuarantineChanges).mockResolvedValueOnce(null)
    await expect(c.loadMediaQuarantineHistory('m2')).resolves.toEqual([])
  })

  it('loadRoomMedia 记录房间与字符串游标并支持追加', async () => {
    vi.mocked(adminService.getRoomMedia)
      .mockResolvedValueOnce({
        media: [
          {
            media_id: 'm1',
            media_type: 'image/png',
            upload_name: 'a.png',
            created_ts: 1,
            media_length: 10
          }
        ],
        total: 1,
        next_batch: 'room-cursor-2'
      })
      .mockResolvedValueOnce({
        media: [
          {
            media_id: 'm2',
            media_type: 'image/png',
            upload_name: 'b.png',
            created_ts: 2,
            media_length: 20
          }
        ],
        total: 1,
        next_batch: null
      })

    const c = useAdminMedia()
    await c.loadRoomMedia('!r:a.example')
    expect(c.roomMedia.value).toHaveLength(1)
    expect(c.roomMediaNextBatch.value).toBe('room-cursor-2')
    expect(c.roomMediaRoomId.value).toBe('!r:a.example')

    await c.loadMoreRoomMedia()
    expect(c.roomMedia.value).toHaveLength(2)
    expect(c.roomMediaNextBatch.value).toBeNull()
    expect(adminService.getRoomMedia).toHaveBeenLastCalledWith('!r:a.example', 'room-cursor-2')
  })

  it('loadRoomMedia 未加载房间时 loadMoreRoomMedia 直接返回', async () => {
    const c = useAdminMedia()
    await c.loadMoreRoomMedia()

    expect(adminService.getRoomMedia).not.toHaveBeenCalled()
  })

  it('loadUserMedia 写入用户媒体，失败时清空', async () => {
    vi.mocked(adminService.getUserMedia).mockResolvedValueOnce({
      media: [{ media_id: 'm1' }],
      total: 1
    })

    const c = useAdminMedia()
    await c.loadUserMedia('@u:a.example')
    expect(c.userMedia.value).toHaveLength(1)
    expect(c.userMediaLoading.value).toBe(false)
    expect(c.userMediaUserId.value).toBe('@u:a.example')
    expect(adminService.getUserMedia).toHaveBeenCalledWith('@u:a.example')

    vi.mocked(adminService.getUserMedia).mockResolvedValueOnce(null)
    await c.loadUserMedia('@u:a.example')
    expect(c.userMedia.value).toEqual([])
  })

  it('deleteOne 按 serverName 选择删除接口', async () => {
    const c = useAdminMedia()

    await c.deleteOne('a.example', 'm1')
    expect(adminService.deleteMediaByServer).toHaveBeenCalledWith('a.example', 'm1')

    await c.deleteOne(null, 'm2')
    expect(adminService.deleteMedia).toHaveBeenCalledWith('m2')
    expect(c.mutating.value).toBe(false)
  })

  it('quarantine 失败时抛出由视图反馈且复位 mutating', async () => {
    vi.mocked(adminService.quarantineMedia).mockRejectedValueOnce(new Error('boom'))

    const c = useAdminMedia()
    const pending = c.quarantine('a.example', 'm1')
    expect(c.mutating.value).toBe(true)

    await expect(pending).rejects.toThrow('boom')
    expect(c.mutating.value).toBe(false)
  })

  it('deleteByPolicy 返回删除条数，服务层为 null 时抛出且复位 mutating', async () => {
    vi.mocked(adminService.deleteMediaByPolicy).mockResolvedValueOnce({ deleted: 5 })

    const c = useAdminMedia()
    await expect(c.deleteByPolicy({ beforeTs: 1234 })).resolves.toBe(5)

    vi.mocked(adminService.deleteMediaByPolicy).mockResolvedValueOnce(null)
    await expect(c.deleteByPolicy({ maxSize: 1024 })).rejects.toThrow('按策略删除媒体失败')
    expect(c.mutating.value).toBe(false)
  })

  it('返回值写方法服务层返回 null 时抛出中文错误', async () => {
    vi.mocked(adminService.protectMedia).mockResolvedValueOnce(null)
    vi.mocked(adminService.protectMediaById).mockResolvedValueOnce(null)
    vi.mocked(adminService.unprotectMedia).mockResolvedValueOnce(null)
    vi.mocked(adminService.quarantineRoomMedia).mockResolvedValueOnce(null)
    vi.mocked(adminService.unquarantineRoomMedia).mockResolvedValueOnce(null)
    vi.mocked(adminService.quarantineUserMedia).mockResolvedValueOnce(null)
    vi.mocked(adminService.deleteUserMedia).mockResolvedValueOnce(null)

    const c = useAdminMedia()
    await expect(c.protect('a.example', 'm1')).rejects.toThrow('保护媒体失败: m1')
    await expect(c.protectById('m2')).rejects.toThrow('保护媒体失败: m2')
    await expect(c.unprotect('m1')).rejects.toThrow('取消保护媒体失败: m1')
    await expect(c.quarantineRoom('!r:a.example', '@u:a.example')).rejects.toThrow('隔离房间媒体失败: !r:a.example')
    await expect(c.unquarantineRoom('!r:a.example')).rejects.toThrow('取消隔离房间媒体失败: !r:a.example')
    await expect(c.quarantineUser('@u:a.example')).rejects.toThrow('隔离用户媒体失败: @u:a.example')
    await expect(c.deleteUserAll('@u:a.example')).rejects.toThrow('删除用户媒体失败: @u:a.example')

    expect(c.mutating.value).toBe(false)
  })
})
