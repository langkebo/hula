import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import type { MatrixClient } from '../../sdk'
import { MatrixThreadApi } from '../MatrixThreadApi'
import type { ThreadingManagerCompat } from '../threadTypes'

// 定义 ThreadingManager 兼容接口，用于测试 mock
// 注：此接口需与 threadTypes.ts 中的 ThreadingManagerCompat 严格保持一致
type MockManager = {
  [K in keyof ThreadingManagerCompat]-?: ReturnType<typeof vi.fn>
}

function buildMockManager(): MockManager {
  return {
    getGlobalThreadList: vi.fn(),
    createGlobalThread: vi.fn(),
    getSubscribedThreads: vi.fn(),
    getGlobalUnreadThreads: vi.fn(),
    createRoomThread: vi.fn(),
    getRoomThreadList: vi.fn(),
    searchRoomThreads: vi.fn(),
    getRoomUnreadThreads: vi.fn(),
    getRoomThread: vi.fn(),
    deleteRoomThread: vi.fn(),
    freezeThread: vi.fn(),
    unfreezeThread: vi.fn(),
    addThreadReply: vi.fn(),
    getThreadReplies: vi.fn(),
    subscribeToThread: vi.fn(),
    unsubscribeFromThread: vi.fn(),
    muteThread: vi.fn(),
    markThreadRead: vi.fn(),
    getThreadStats: vi.fn(),
    redactThreadReply: vi.fn(),
    getLegacyRoomThreadList: vi.fn()
  }
}

describe('MatrixThreadApi', () => {
  let api: MatrixThreadApi
  let mockManager: MockManager
  let mockClient: Partial<MatrixClient>

  beforeEach(() => {
    mockManager = buildMockManager()
    mockClient = {}
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as MatrixClient)
    api = new MatrixThreadApi()
  })

  /** 让 threadingManager 不可用，模拟客户端未暴露扩展 */
  function disableManager() {
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
      getThreadingManager: vi.fn().mockReturnValue(null)
    } as unknown as MatrixClient)
  }

  function enableManager() {
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue({
      getThreadingManager: vi.fn().mockReturnValue(mockManager as unknown as ThreadingManagerCompat)
    } as unknown as MatrixClient)
  }

  describe('getRoomThreadViaApi', () => {
    it('should return thread detail with query object', async () => {
      enableManager()
      mockManager.getRoomThread.mockResolvedValue({ id: 't1', room_id: '!room', thread_id: 't1', root_event_id: '$r1' })
      const result = await api.getRoomThreadViaApi('!room', 't1', true, 50)
      expect(mockManager.getRoomThread).toHaveBeenCalledWith('!room', 't1', { includeReplies: true, replyLimit: 50 })
      expect(result).toEqual({ id: 't1', room_id: '!room', thread_id: 't1', root_event_id: '$r1' })
    })

    it('should return null when manager unavailable', async () => {
      disableManager()
      expect(await api.getRoomThreadViaApi('!room', 't1')).toBeNull()
    })

    it('should return null on error', async () => {
      enableManager()
      mockManager.getRoomThread.mockRejectedValue(new Error('boom'))
      expect(await api.getRoomThreadViaApi('!room', 't1')).toBeNull()
    })
  })

  describe('deleteRoomThreadViaApi', () => {
    it('should delete thread', async () => {
      enableManager()
      mockManager.deleteRoomThread.mockResolvedValue(undefined)

      await api.deleteRoomThreadViaApi('!room', 't1')
      expect(mockManager.deleteRoomThread).toHaveBeenCalledWith('!room', 't1')
    })

    it('should throw when manager unavailable', async () => {
      disableManager()
      await expect(api.deleteRoomThreadViaApi('!room', 't1')).rejects.toThrow('ThreadingManager')
    })

    it('should rethrow errors', async () => {
      enableManager()
      mockManager.deleteRoomThread.mockRejectedValue(new Error('boom'))

      await expect(api.deleteRoomThreadViaApi('!room', 't1')).rejects.toThrow('boom')
    })
  })

  describe('freezeThreadViaApi', () => {
    it('should freeze thread', async () => {
      enableManager()
      mockManager.freezeThread.mockResolvedValue(undefined)

      await api.freezeThreadViaApi('!room', 't1')
      expect(mockManager.freezeThread).toHaveBeenCalledWith('!room', 't1')
    })

    it('should throw when manager unavailable', async () => {
      disableManager()
      await expect(api.freezeThreadViaApi('!room', 't1')).rejects.toThrow('ThreadingManager')
    })
  })

  describe('unfreezeThreadViaApi', () => {
    it('should unfreeze thread', async () => {
      enableManager()
      mockManager.unfreezeThread.mockResolvedValue(undefined)

      await api.unfreezeThreadViaApi('!room', 't1')
      expect(mockManager.unfreezeThread).toHaveBeenCalledWith('!room', 't1')
    })

    it('should throw when manager unavailable', async () => {
      disableManager()
      await expect(api.unfreezeThreadViaApi('!room', 't1')).rejects.toThrow('ThreadingManager')
    })
  })

  describe('getThreadRepliesViaApi', () => {
    it('should return replies (SDK returns array)', async () => {
      enableManager()
      mockManager.getThreadReplies.mockResolvedValue([{ id: 'r1' }])

      expect(await api.getThreadRepliesViaApi('!room', 't1')).toEqual([{ id: 'r1' }])
      // API 透传查询对象给 SDK（SDK 内部 buildQuery 会剔除 undefined），不再传裸 undefined
      expect(mockManager.getThreadReplies).toHaveBeenCalledWith('!room', 't1', { limit: undefined })
    })

    it('should return empty on non-array result', async () => {
      enableManager()
      mockManager.getThreadReplies.mockResolvedValue(null)
      expect(await api.getThreadRepliesViaApi('!room', 't1')).toEqual([])
    })

    it('should rethrow errors so callers can tell failure from empty', async () => {
      enableManager()
      mockManager.getThreadReplies.mockRejectedValue(new Error('boom'))

      await expect(api.getThreadRepliesViaApi('!room', 't1')).rejects.toThrow('boom')
    })

    it('should return empty when manager unavailable', async () => {
      disableManager()
      expect(await api.getThreadRepliesViaApi('!room', 't1')).toEqual([])
    })
  })

  describe('subscribeToThreadViaApi', () => {
    it('should subscribe and map snake_case to camelCase', async () => {
      enableManager()
      mockManager.subscribeToThread.mockResolvedValue({
        notification_level: 'all',
        is_muted: false,
        subscribed_ts: 1234567890
      })
      const result = await api.subscribeToThreadViaApi('!room', 't1', 'all')
      expect(mockManager.subscribeToThread).toHaveBeenCalledWith('!room', 't1', 'all')
      expect(result).toEqual({ notificationLevel: 'all', isMuted: false, subscribedTs: 1234567890 })
    })

    it('should use default notification level', async () => {
      enableManager()
      mockManager.subscribeToThread.mockResolvedValue({ notification_level: 'all', is_muted: false })

      await api.subscribeToThreadViaApi('!room', 't1')
      expect(mockManager.subscribeToThread).toHaveBeenCalledWith('!room', 't1', 'all')
    })

    it('should return null when manager unavailable', async () => {
      disableManager()
      expect(await api.subscribeToThreadViaApi('!room', 't1')).toBeNull()
    })
  })

  describe('muteThreadViaApi', () => {
    it('should mute thread and map snake_case to camelCase', async () => {
      enableManager()
      mockManager.muteThread.mockResolvedValue({
        notification_level: 'none',
        is_muted: true
      })
      const result = await api.muteThreadViaApi('!room', 't1')
      expect(mockManager.muteThread).toHaveBeenCalledWith('!room', 't1')
      expect(result).toEqual({ notificationLevel: 'none', isMuted: true })
    })

    it('should return null when manager unavailable', async () => {
      disableManager()
      expect(await api.muteThreadViaApi('!room', 't1')).toBeNull()
    })

    it('should rethrow errors', async () => {
      enableManager()
      mockManager.muteThread.mockRejectedValue(new Error('boom'))

      await expect(api.muteThreadViaApi('!room', 't1')).rejects.toThrow('boom')
    })
  })

  describe('markThreadReadViaApi', () => {
    it('should mark thread read', async () => {
      enableManager()
      mockManager.markThreadRead.mockResolvedValue({
        id: 1,
        room_id: '!room',
        thread_id: 't1',
        user_id: '@u:hs',
        last_read_event_id: '$e',
        last_read_ts: 1000,
        unread_count: 0
      })
      const result = await api.markThreadReadViaApi('!room', 't1', '$e', 1000)
      expect(mockManager.markThreadRead).toHaveBeenCalledWith('!room', 't1', '$e', 1000)
      expect(result).toEqual({
        id: 1,
        room_id: '!room',
        thread_id: 't1',
        user_id: '@u:hs',
        last_read_event_id: '$e',
        last_read_ts: 1000,
        unread_count: 0
      })
    })

    it('should return null when manager unavailable', async () => {
      disableManager()
      expect(await api.markThreadReadViaApi('!room', 't1', '$e', 1000)).toBeNull()
    })

    it('should return null on error', async () => {
      enableManager()
      mockManager.markThreadRead.mockRejectedValue(new Error('boom'))
      expect(await api.markThreadReadViaApi('!room', 't1', '$e', 1000)).toBeNull()
    })
  })

  describe('getThreadStatsViaApi', () => {
    it('should return stats with camelCase field mapping', async () => {
      enableManager()
      mockManager.getThreadStats.mockResolvedValue({
        id: 1,
        room_id: '!room',
        thread_id: 't1',
        total_replies: 10,
        total_participants: 3,
        total_edits: 0,
        total_redactions: 0,
        first_reply_ts: null,
        last_reply_ts: 2000,
        avg_reply_time_ms: null,
        created_ts: 1000,
        updated_ts: 2000
      })
      const result = await api.getThreadStatsViaApi('!room', 't1')
      expect(result).toEqual({
        totalReplies: 10,
        totalParticipants: 3,
        totalEdits: 0,
        totalRedactions: 0,
        firstReplyTs: undefined,
        lastReplyTs: 2000,
        avgReplyTimeMs: undefined
      })
    })

    it('should return null when manager unavailable', async () => {
      disableManager()
      expect(await api.getThreadStatsViaApi('!room', 't1')).toBeNull()
    })

    it('should return null on error', async () => {
      enableManager()
      mockManager.getThreadStats.mockRejectedValue(new Error('boom'))
      expect(await api.getThreadStatsViaApi('!room', 't1')).toBeNull()
    })
  })

  describe('redactThreadReplyViaApi', () => {
    it('should redact reply', async () => {
      enableManager()
      mockManager.redactThreadReply.mockResolvedValue(undefined)

      await api.redactThreadReplyViaApi('!room', '$e')
      expect(mockManager.redactThreadReply).toHaveBeenCalledWith('!room', '$e')
    })

    it('should throw when manager unavailable', async () => {
      disableManager()
      await expect(api.redactThreadReplyViaApi('!room', '$e')).rejects.toThrow('ThreadingManager')
    })
  })
})
