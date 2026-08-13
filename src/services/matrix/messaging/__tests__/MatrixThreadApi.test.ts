import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import type { MatrixClient } from '../../sdk'
import { MatrixThreadApi } from '../MatrixThreadApi'
import type { ThreadingManagerCompat } from '../threadTypes'

// 定义 ThreadingManager 兼容接口，用于测试 mock
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
    mockClient = { threadingManager: mockManager as unknown as ThreadingManagerCompat } as unknown as MatrixClient
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as MatrixClient)
    api = new MatrixThreadApi()
  })

  /** 让 threadingManager 不可用，模拟客户端未暴露扩展 */
  function disableManager() {
    ;(mockClient as unknown as { threadingManager: unknown }).threadingManager = null
  }

  describe('getGlobalThreadListViaApi', () => {
    it('should return mapped thread list', async () => {
      mockManager.getGlobalThreadList.mockResolvedValue({
        threads: [{ id: 't1' }],
        next_batch: 'batch',
        total: 1
      })

      const result = await api.getGlobalThreadListViaApi(50, 'from')

      expect(mockManager.getGlobalThreadList).toHaveBeenCalledWith(50, 'from')
      expect(result).toEqual({ threads: [{ id: 't1' }], nextBatch: 'batch', total: 1 })
    })

    it('should use default limit 50', async () => {
      mockManager.getGlobalThreadList.mockResolvedValue({ threads: [], total: 0 })

      await api.getGlobalThreadListViaApi()

      expect(mockManager.getGlobalThreadList).toHaveBeenCalledWith(50, undefined)
    })

    it('should return empty when manager unavailable', async () => {
      disableManager()
      const result = await api.getGlobalThreadListViaApi()
      expect(result).toEqual({ threads: [], total: 0 })
    })

    it('should return empty on error', async () => {
      mockManager.getGlobalThreadList.mockRejectedValue(new Error('Network'))
      const result = await api.getGlobalThreadListViaApi()
      expect(result).toEqual({ threads: [], total: 0 })
    })
  })

  describe('createGlobalThreadViaApi', () => {
    it('should create global thread', async () => {
      mockManager.createGlobalThread.mockResolvedValue({ thread_id: 't1' })
      const result = await api.createGlobalThreadViaApi('!room', '$root', { body: 'x' })
      expect(result).toEqual({ thread_id: 't1' })
    })

    it('should return null when manager unavailable', async () => {
      disableManager()
      expect(await api.createGlobalThreadViaApi('!room', '$root')).toBeNull()
    })

    it('should rethrow errors', async () => {
      mockManager.createGlobalThread.mockRejectedValue(new Error('boom'))
      await expect(api.createGlobalThreadViaApi('!room', '$root')).rejects.toThrow('boom')
    })
  })

  describe('getSubscribedThreadsViaApi', () => {
    it('should return subscribed threads', async () => {
      mockManager.getSubscribedThreads.mockResolvedValue([{ id: 't1' }])
      expect(await api.getSubscribedThreadsViaApi()).toEqual([{ id: 't1' }])
    })

    it('should return empty on non-array result', async () => {
      mockManager.getSubscribedThreads.mockResolvedValue(null)
      expect(await api.getSubscribedThreadsViaApi()).toEqual([])
    })

    it('should return empty when manager unavailable', async () => {
      disableManager()
      expect(await api.getSubscribedThreadsViaApi()).toEqual([])
    })

    it('should return empty on error', async () => {
      mockManager.getSubscribedThreads.mockRejectedValue(new Error('boom'))
      expect(await api.getSubscribedThreadsViaApi()).toEqual([])
    })
  })

  describe('getGlobalUnreadThreadsViaApi', () => {
    it('should return global unread threads', async () => {
      mockManager.getGlobalUnreadThreads.mockResolvedValue([{ id: 't1' }])
      expect(await api.getGlobalUnreadThreadsViaApi()).toEqual([{ id: 't1' }])
    })

    it('should return empty on non-array result', async () => {
      mockManager.getGlobalUnreadThreads.mockResolvedValue({})
      expect(await api.getGlobalUnreadThreadsViaApi()).toEqual([])
    })

    it('should return empty when manager unavailable', async () => {
      disableManager()
      expect(await api.getGlobalUnreadThreadsViaApi()).toEqual([])
    })
  })

  describe('createRoomThreadViaApi', () => {
    it('should create room thread', async () => {
      mockManager.createRoomThread.mockResolvedValue({ event_id: '$e' })
      expect(await api.createRoomThreadViaApi('!room', '$root')).toEqual({ event_id: '$e' })
    })

    it('should return null when manager unavailable', async () => {
      disableManager()
      expect(await api.createRoomThreadViaApi('!room', '$root')).toBeNull()
    })

    it('should rethrow errors', async () => {
      mockManager.createRoomThread.mockRejectedValue(new Error('boom'))
      await expect(api.createRoomThreadViaApi('!room', '$root')).rejects.toThrow('boom')
    })
  })

  describe('getRoomThreadListViaApi', () => {
    it('should return room thread list', async () => {
      mockManager.getRoomThreadList.mockResolvedValue({
        threads: [{ id: 't1', roomId: '!room' }],
        next_batch: 'next'
      })
      const result = await api.getRoomThreadListViaApi('!room', 100, 'from', true)
      expect(mockManager.getRoomThreadList).toHaveBeenCalledWith('!room', 100, 'from', true)
      expect(result).toEqual({ threads: [{ id: 't1', roomId: '!room' }], nextBatch: 'next' })
    })

    it('should default threads to empty when missing', async () => {
      mockManager.getRoomThreadList.mockResolvedValue({ next_batch: 'next' } as never)
      const result = await api.getRoomThreadListViaApi('!room')
      expect(result.threads).toEqual([])
      expect(result.nextBatch).toBe('next')
    })

    it('should return empty thread list when manager unavailable', async () => {
      disableManager()
      expect(await api.getRoomThreadListViaApi('!room')).toEqual({ threads: [] })
    })

    it('should return empty on error', async () => {
      mockManager.getRoomThreadList.mockRejectedValue(new Error('boom'))
      expect(await api.getRoomThreadListViaApi('!room')).toEqual({ threads: [] })
    })
  })

  describe('searchRoomThreadsViaApi', () => {
    it('should search threads', async () => {
      mockManager.searchRoomThreads.mockResolvedValue([{ id: 't1', roomId: '!room' }])
      const result = await api.searchRoomThreadsViaApi('!room', 'q', 20)
      expect(mockManager.searchRoomThreads).toHaveBeenCalledWith('!room', 'q', 20)
      expect(result).toEqual([{ id: 't1', roomId: '!room' }])
    })

    it('should return empty on null result', async () => {
      mockManager.searchRoomThreads.mockResolvedValue(null)
      expect(await api.searchRoomThreadsViaApi('!room', 'q')).toEqual([])
    })

    it('should return empty when manager unavailable', async () => {
      disableManager()
      expect(await api.searchRoomThreadsViaApi('!room', 'q')).toEqual([])
    })

    it('should return empty on error', async () => {
      mockManager.searchRoomThreads.mockRejectedValue(new Error('boom'))
      expect(await api.searchRoomThreadsViaApi('!room', 'q')).toEqual([])
    })
  })

  describe('getRoomUnreadThreadsViaApi', () => {
    it('should return room unread threads', async () => {
      mockManager.getRoomUnreadThreads.mockResolvedValue([{ id: 't1' }])
      expect(await api.getRoomUnreadThreadsViaApi('!room')).toEqual([{ id: 't1' }])
    })

    it('should return empty on non-array result', async () => {
      mockManager.getRoomUnreadThreads.mockResolvedValue(null)
      expect(await api.getRoomUnreadThreadsViaApi('!room')).toEqual([])
    })

    it('should return empty when manager unavailable', async () => {
      disableManager()
      expect(await api.getRoomUnreadThreadsViaApi('!room')).toEqual([])
    })
  })

  describe('getRoomThreadViaApi', () => {
    it('should return thread detail', async () => {
      mockManager.getRoomThread.mockResolvedValue({ id: 't1' })
      const result = await api.getRoomThreadViaApi('!room', 't1', true, 50)
      expect(mockManager.getRoomThread).toHaveBeenCalledWith('!room', 't1', true, 50)
      expect(result).toEqual({ id: 't1' })
    })

    it('should return null when manager unavailable', async () => {
      disableManager()
      expect(await api.getRoomThreadViaApi('!room', 't1')).toBeNull()
    })

    it('should return null on error', async () => {
      mockManager.getRoomThread.mockRejectedValue(new Error('boom'))
      expect(await api.getRoomThreadViaApi('!room', 't1')).toBeNull()
    })
  })

  describe('deleteRoomThreadViaApi', () => {
    it('should delete thread', async () => {
      mockManager.deleteRoomThread.mockResolvedValue(undefined)
      await api.deleteRoomThreadViaApi('!room', 't1')
      expect(mockManager.deleteRoomThread).toHaveBeenCalledWith('!room', 't1')
    })

    it('should throw when manager unavailable', async () => {
      disableManager()
      await expect(api.deleteRoomThreadViaApi('!room', 't1')).rejects.toThrow('ThreadingManager')
    })

    it('should rethrow errors', async () => {
      mockManager.deleteRoomThread.mockRejectedValue(new Error('boom'))
      await expect(api.deleteRoomThreadViaApi('!room', 't1')).rejects.toThrow('boom')
    })
  })

  describe('freezeThreadViaApi', () => {
    it('should freeze thread', async () => {
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
      mockManager.unfreezeThread.mockResolvedValue(undefined)
      await api.unfreezeThreadViaApi('!room', 't1')
      expect(mockManager.unfreezeThread).toHaveBeenCalledWith('!room', 't1')
    })

    it('should throw when manager unavailable', async () => {
      disableManager()
      await expect(api.unfreezeThreadViaApi('!room', 't1')).rejects.toThrow('ThreadingManager')
    })
  })

  describe('addThreadReplyViaApi', () => {
    it('should add reply', async () => {
      mockManager.addThreadReply.mockResolvedValue({ event_id: '$r' })
      const result = await api.addThreadReplyViaApi('!room', 't1', { body: 'x' }, '$in')
      expect(mockManager.addThreadReply).toHaveBeenCalledWith('!room', 't1', { body: 'x' }, '$in')
      expect(result).toEqual({ event_id: '$r' })
    })

    it('should return null when manager unavailable', async () => {
      disableManager()
      expect(await api.addThreadReplyViaApi('!room', 't1', { body: 'x' })).toBeNull()
    })

    it('should rethrow errors', async () => {
      mockManager.addThreadReply.mockRejectedValue(new Error('boom'))
      await expect(api.addThreadReplyViaApi('!room', 't1', { body: 'x' })).rejects.toThrow('boom')
    })
  })

  describe('getThreadRepliesViaApi', () => {
    it('should return replies', async () => {
      mockManager.getThreadReplies.mockResolvedValue([{ id: 'r1' }])
      expect(await api.getThreadRepliesViaApi('!room', 't1')).toEqual([{ id: 'r1' }])
    })

    it('should return empty on non-array result', async () => {
      mockManager.getThreadReplies.mockResolvedValue(null)
      expect(await api.getThreadRepliesViaApi('!room', 't1')).toEqual([])
    })

    it('should return empty when manager unavailable', async () => {
      disableManager()
      expect(await api.getThreadRepliesViaApi('!room', 't1')).toEqual([])
    })
  })

  describe('subscribeToThreadViaApi', () => {
    it('should subscribe', async () => {
      mockManager.subscribeToThread.mockResolvedValue({ notificationLevel: 'all', isMuted: false })
      const result = await api.subscribeToThreadViaApi('!room', 't1', 'all')
      expect(mockManager.subscribeToThread).toHaveBeenCalledWith('!room', 't1', 'all')
      expect(result?.notificationLevel).toBe('all')
    })

    it('should use default notification level', async () => {
      mockManager.subscribeToThread.mockResolvedValue({ notificationLevel: 'all', isMuted: false })
      await api.subscribeToThreadViaApi('!room', 't1')
      expect(mockManager.subscribeToThread).toHaveBeenCalledWith('!room', 't1', 'all')
    })

    it('should return null when manager unavailable', async () => {
      disableManager()
      expect(await api.subscribeToThreadViaApi('!room', 't1')).toBeNull()
    })
  })

  describe('unsubscribeFromThreadViaApi', () => {
    it('should unsubscribe', async () => {
      mockManager.unsubscribeFromThread.mockResolvedValue(undefined)
      await api.unsubscribeFromThreadViaApi('!room', 't1')
      expect(mockManager.unsubscribeFromThread).toHaveBeenCalledWith('!room', 't1')
    })

    it('should throw when manager unavailable', async () => {
      disableManager()
      await expect(api.unsubscribeFromThreadViaApi('!room', 't1')).rejects.toThrow('ThreadingManager')
    })
  })

  describe('muteThreadViaApi', () => {
    it('should mute thread', async () => {
      mockManager.muteThread.mockResolvedValue({ notificationLevel: 'none', isMuted: true })
      expect(await api.muteThreadViaApi('!room', 't1')).toEqual({ notificationLevel: 'none', isMuted: true })
    })

    it('should return null when manager unavailable', async () => {
      disableManager()
      expect(await api.muteThreadViaApi('!room', 't1')).toBeNull()
    })

    it('should rethrow errors', async () => {
      mockManager.muteThread.mockRejectedValue(new Error('boom'))
      await expect(api.muteThreadViaApi('!room', 't1')).rejects.toThrow('boom')
    })
  })

  describe('markThreadReadViaApi', () => {
    it('should mark thread read', async () => {
      mockManager.markThreadRead.mockResolvedValue({})
      const result = await api.markThreadReadViaApi('!room', 't1', '$e', 1000)
      expect(mockManager.markThreadRead).toHaveBeenCalledWith('!room', 't1', '$e', 1000)
      expect(result).toEqual({})
    })

    it('should return null when manager unavailable', async () => {
      disableManager()
      expect(await api.markThreadReadViaApi('!room', 't1', '$e', 1000)).toBeNull()
    })

    it('should return null on error', async () => {
      mockManager.markThreadRead.mockRejectedValue(new Error('boom'))
      expect(await api.markThreadReadViaApi('!room', 't1', '$e', 1000)).toBeNull()
    })
  })

  describe('getThreadStatsViaApi', () => {
    it('should return stats', async () => {
      mockManager.getThreadStats.mockResolvedValue({ totalReplies: 10, totalParticipants: 3 })
      expect(await api.getThreadStatsViaApi('!room', 't1')).toEqual({ totalReplies: 10, totalParticipants: 3 })
    })

    it('should return null when manager unavailable', async () => {
      disableManager()
      expect(await api.getThreadStatsViaApi('!room', 't1')).toBeNull()
    })

    it('should return null on error', async () => {
      mockManager.getThreadStats.mockRejectedValue(new Error('boom'))
      expect(await api.getThreadStatsViaApi('!room', 't1')).toBeNull()
    })
  })

  describe('redactThreadReplyViaApi', () => {
    it('should redact reply', async () => {
      mockManager.redactThreadReply.mockResolvedValue(undefined)
      await api.redactThreadReplyViaApi('!room', '$e')
      expect(mockManager.redactThreadReply).toHaveBeenCalledWith('!room', '$e')
    })

    it('should throw when manager unavailable', async () => {
      disableManager()
      await expect(api.redactThreadReplyViaApi('!room', '$e')).rejects.toThrow('ThreadingManager')
    })
  })

  describe('getLegacyRoomThreadList', () => {
    it('should return legacy thread list', async () => {
      mockManager.getLegacyRoomThreadList.mockResolvedValue({ chunk: [{ id: 't1' }], next_batch: 'next' })
      const result = await api.getLegacyRoomThreadList('@u:server', '!room', 50, 'from', true)
      expect(mockManager.getLegacyRoomThreadList).toHaveBeenCalledWith('@u:server', '!room', 50, 'from', true)
      expect(result).toEqual({ chunk: [{ id: 't1' }], nextBatch: 'next' })
    })

    it('should default chunk to empty when missing', async () => {
      mockManager.getLegacyRoomThreadList.mockResolvedValue({ next_batch: 'next' } as never)
      const result = await api.getLegacyRoomThreadList('@u:server', '!room')
      expect(result.chunk).toEqual([])
      expect(result.nextBatch).toBe('next')
    })

    it('should return empty chunk when manager unavailable', async () => {
      disableManager()
      expect(await api.getLegacyRoomThreadList('@u:server', '!room')).toEqual({ chunk: [] })
    })

    it('should return empty chunk on error', async () => {
      mockManager.getLegacyRoomThreadList.mockRejectedValue(new Error('boom'))
      expect(await api.getLegacyRoomThreadList('@u:server', '!room')).toEqual({ chunk: [] })
    })
  })
})
