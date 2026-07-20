import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import matrixClientService from '../../MatrixClientService'
import { matrixThreadService } from '../MatrixThreadService'

// 定义 ThreadingManager 的兼容接口，用于测试 mock
interface ThreadingManagerCompat {
  getGlobalThreadList?: (
    limit?: number,
    from?: string
  ) => Promise<{ threads: unknown[]; next_batch?: string; total: number }>
  createGlobalThread?: (
    roomId: string,
    rootEventId: string,
    content?: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
  getSubscribedThreads?: () => Promise<unknown[]>
  getGlobalUnreadThreads?: () => Promise<unknown[]>
  createRoomThread?: (
    roomId: string,
    rootEventId: string,
    content?: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
  getRoomThreadList?: (
    roomId: string,
    limit?: number,
    from?: string,
    includeAll?: boolean
  ) => Promise<{ threads: unknown[]; next_batch?: string }>
  searchRoomThreads?: (roomId: string, query: string, limit?: number) => Promise<unknown[]>
  getRoomUnreadThreads?: (roomId: string) => Promise<unknown[]>
  getRoomThread?: (
    roomId: string,
    threadId: string,
    includeReplies?: boolean,
    replyLimit?: number
  ) => Promise<Record<string, unknown> | null>
  deleteRoomThread?: (roomId: string, threadId: string) => Promise<void>
  freezeThread?: (roomId: string, threadId: string) => Promise<void>
  unfreezeThread?: (roomId: string, threadId: string) => Promise<void>
  addThreadReply?: (
    roomId: string,
    threadId: string,
    content: Record<string, unknown>,
    inReplyToEventId?: string
  ) => Promise<Record<string, unknown>>
  getThreadReplies?: (roomId: string, threadId: string) => Promise<unknown[]>
  subscribeToThread?: (roomId: string, threadId: string, notificationLevel?: string) => Promise<unknown | null>
  unsubscribeFromThread?: (roomId: string, threadId: string) => Promise<void>
  muteThread?: (roomId: string, threadId: string) => Promise<unknown | null>
  markThreadRead?: (
    roomId: string,
    threadId: string,
    eventId: string,
    originServerTs: number
  ) => Promise<Record<string, unknown> | null>
  getThreadStats?: (roomId: string, threadId: string) => Promise<unknown | null>
  redactThreadReply?: (roomId: string, eventId: string) => Promise<void>
  getLegacyRoomThreadList?: (roomId: string) => Promise<unknown[]>
}

vi.mock('../../MatrixReceiptService', () => ({
  matrixReceiptService: {
    sendReadReceipt: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('MatrixThreadService - REST API Methods', () => {
  let mockThreadingManager: {
    getGlobalThreadList: ReturnType<typeof vi.fn>
    createGlobalThread: ReturnType<typeof vi.fn>
    getSubscribedThreads: ReturnType<typeof vi.fn>
    getGlobalUnreadThreads: ReturnType<typeof vi.fn>
    createRoomThread: ReturnType<typeof vi.fn>
    getRoomThreadList: ReturnType<typeof vi.fn>
    searchRoomThreads: ReturnType<typeof vi.fn>
    getRoomUnreadThreads: ReturnType<typeof vi.fn>
    getRoomThread: ReturnType<typeof vi.fn>
    deleteRoomThread: ReturnType<typeof vi.fn>
    freezeThread: ReturnType<typeof vi.fn>
    unfreezeThread: ReturnType<typeof vi.fn>
    addThreadReply: ReturnType<typeof vi.fn>
    getThreadReplies: ReturnType<typeof vi.fn>
    subscribeToThread: ReturnType<typeof vi.fn>
    unsubscribeFromThread: ReturnType<typeof vi.fn>
    muteThread: ReturnType<typeof vi.fn>
    markThreadRead: ReturnType<typeof vi.fn>
    getThreadStats: ReturnType<typeof vi.fn>
    redactThreadReply: ReturnType<typeof vi.fn>
    getLegacyRoomThreadList: ReturnType<typeof vi.fn>
  }
  let mockClient: Partial<MatrixClient>

  beforeEach(() => {
    mockThreadingManager = {
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

    mockClient = {
      threadingManager: mockThreadingManager as unknown as ThreadingManagerCompat,
      getRoom: vi.fn(() => null),
      getRooms: vi.fn(() => [])
    } as unknown as MatrixClient

    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(mockClient as unknown as MatrixClient)
  })

  describe('getGlobalThreadListViaApi', () => {
    it('should return global thread list', async () => {
      mockThreadingManager.getGlobalThreadList.mockResolvedValue({
        threads: [{ id: 't1' }, { id: 't2' }],
        total: 2,
        next_batch: 'batch_token'
      })

      const result = await matrixThreadService.getGlobalThreadListViaApi(50)

      expect(result.threads).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.nextBatch).toBe('batch_token')
    })

    it('should return empty when manager unavailable', async () => {
      ;(mockClient as unknown as { threadingManager: unknown }).threadingManager = null

      const result = await matrixThreadService.getGlobalThreadListViaApi()

      expect(result.threads).toEqual([])
      expect(result.total).toBe(0)
    })

    it('should return empty on error', async () => {
      mockThreadingManager.getGlobalThreadList.mockRejectedValue(new Error('Network'))

      const result = await matrixThreadService.getGlobalThreadListViaApi()

      expect(result.threads).toEqual([])
    })
  })

  describe('createGlobalThreadViaApi', () => {
    it('should create global thread', async () => {
      mockThreadingManager.createGlobalThread.mockResolvedValue({ thread_id: 't1' })

      const result = await matrixThreadService.createGlobalThreadViaApi('!room:example.com', '$event1')

      expect(result).toEqual({ thread_id: 't1' })
    })

    it('should return null when manager unavailable', async () => {
      ;(mockClient as unknown as { threadingManager: unknown }).threadingManager = null

      const result = await matrixThreadService.createGlobalThreadViaApi('!room', '$event')

      expect(result).toBeNull()
    })
  })

  describe('getSubscribedThreadsViaApi', () => {
    it('should return subscribed threads', async () => {
      mockThreadingManager.getSubscribedThreads.mockResolvedValue([{ id: 't1' }])

      const result = await matrixThreadService.getSubscribedThreadsViaApi()

      expect(result).toHaveLength(1)
    })

    it('should return empty array on non-array result', async () => {
      mockThreadingManager.getSubscribedThreads.mockResolvedValue(null)

      const result = await matrixThreadService.getSubscribedThreadsViaApi()

      expect(result).toEqual([])
    })
  })

  describe('getRoomThreadListViaApi', () => {
    it('should return room thread list', async () => {
      mockThreadingManager.getRoomThreadList.mockResolvedValue({
        threads: [{ id: 't1', roomId: '!room' }],
        next_batch: 'next'
      })

      const result = await matrixThreadService.getRoomThreadListViaApi('!room:example.com')

      expect(result.threads).toHaveLength(1)
      expect(result.nextBatch).toBe('next')
    })
  })

  describe('searchRoomThreadsViaApi', () => {
    it('should search threads', async () => {
      mockThreadingManager.searchRoomThreads.mockResolvedValue([{ id: 't1' }])

      const result = await matrixThreadService.searchRoomThreadsViaApi('!room', 'test query')

      expect(result).toHaveLength(1)
    })
  })

  describe('deleteRoomThreadViaApi', () => {
    it('should delete thread', async () => {
      mockThreadingManager.deleteRoomThread.mockResolvedValue(undefined)

      await matrixThreadService.deleteRoomThreadViaApi('!room', 't1')

      expect(mockThreadingManager.deleteRoomThread).toHaveBeenCalledWith('!room', 't1')
    })

    it('should throw when manager unavailable', async () => {
      ;(mockClient as unknown as { threadingManager: unknown }).threadingManager = null

      await expect(matrixThreadService.deleteRoomThreadViaApi('!room', 't1')).rejects.toThrow('ThreadingManager')
    })
  })

  describe('freezeThreadViaApi / unfreezeThreadViaApi', () => {
    it('should freeze thread', async () => {
      mockThreadingManager.freezeThread.mockResolvedValue(undefined)

      await matrixThreadService.freezeThreadViaApi('!room', 't1')

      expect(mockThreadingManager.freezeThread).toHaveBeenCalledWith('!room', 't1')
    })

    it('should unfreeze thread', async () => {
      mockThreadingManager.unfreezeThread.mockResolvedValue(undefined)

      await matrixThreadService.unfreezeThreadViaApi('!room', 't1')

      expect(mockThreadingManager.unfreezeThread).toHaveBeenCalledWith('!room', 't1')
    })
  })

  describe('addThreadReplyViaApi', () => {
    it('should add reply to thread', async () => {
      mockThreadingManager.addThreadReply.mockResolvedValue({ event_id: '$reply1' })

      const result = await matrixThreadService.addThreadReplyViaApi('!room', 't1', { body: 'reply' })

      expect(result).toEqual({ event_id: '$reply1' })
    })
  })

  describe('subscribeToThreadViaApi / unsubscribeFromThreadViaApi', () => {
    it('should subscribe to thread', async () => {
      mockThreadingManager.subscribeToThread.mockResolvedValue({ notificationLevel: 'all', isMuted: false })

      const result = await matrixThreadService.subscribeToThreadViaApi('!room', 't1')

      expect(result?.notificationLevel).toBe('all')
    })

    it('should unsubscribe from thread', async () => {
      mockThreadingManager.unsubscribeFromThread.mockResolvedValue(undefined)

      await matrixThreadService.unsubscribeFromThreadViaApi('!room', 't1')

      expect(mockThreadingManager.unsubscribeFromThread).toHaveBeenCalledWith('!room', 't1')
    })
  })

  describe('muteThreadViaApi', () => {
    it('should mute thread', async () => {
      mockThreadingManager.muteThread.mockResolvedValue({ notificationLevel: 'none', isMuted: true })

      const result = await matrixThreadService.muteThreadViaApi('!room', 't1')

      expect(result?.isMuted).toBe(true)
    })
  })

  describe('markThreadReadViaApi', () => {
    it('should mark thread as read', async () => {
      mockThreadingManager.markThreadRead.mockResolvedValue({})

      const result = await matrixThreadService.markThreadReadViaApi('!room', 't1', '$event1', 1000)

      expect(result).toEqual({})
    })
  })

  describe('getThreadStatsViaApi', () => {
    it('should return thread statistics', async () => {
      mockThreadingManager.getThreadStats.mockResolvedValue({
        totalReplies: 10,
        totalParticipants: 3
      })

      const result = await matrixThreadService.getThreadStatsViaApi('!room', 't1')

      expect(result?.totalReplies).toBe(10)
    })
  })

  describe('redactThreadReplyViaApi', () => {
    it('should redact thread reply', async () => {
      mockThreadingManager.redactThreadReply.mockResolvedValue(undefined)

      await matrixThreadService.redactThreadReplyViaApi('!room', '$event1')

      expect(mockThreadingManager.redactThreadReply).toHaveBeenCalledWith('!room', '$event1')
    })
  })

  describe('getLegacyRoomThreadList', () => {
    it('should return legacy thread list', async () => {
      mockThreadingManager.getLegacyRoomThreadList.mockResolvedValue({
        chunk: [{ id: 't1' }],
        next_batch: 'next'
      })

      const result = await matrixThreadService.getLegacyRoomThreadList('@user:example.com', '!room')

      expect(result.chunk).toHaveLength(1)
      expect(result.nextBatch).toBe('next')
    })
  })
})
