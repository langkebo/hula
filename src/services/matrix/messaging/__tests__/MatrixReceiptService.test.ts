import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixReceiptService } from '../MatrixReceiptService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: vi.fn()
  }
}))

import { info, warn } from '@tauri-apps/plugin-log'
import { offlineQueueService } from '@/services/offline/OfflineQueueService'
import matrixClientService from '../../MatrixClientService'

describe('MatrixReceiptService', () => {
  let mockReceiptManager: {
    sendReadReceipt: ReturnType<typeof vi.fn>
    sendReadReceiptByEventId: ReturnType<typeof vi.fn>
    setReadMarker: ReturnType<typeof vi.fn>
    getReceipt: ReturnType<typeof vi.fn>
  }

  let mockRoom: {
    getLiveTimeline: ReturnType<typeof vi.fn>
    getMember: ReturnType<typeof vi.fn>
    getEventReadUpTo: ReturnType<typeof vi.fn>
    getUnreadNotificationCount: ReturnType<typeof vi.fn>
  }

  let mockClient: {
    getReadReceiptsManager: ReturnType<typeof vi.fn>
    getRoom: ReturnType<typeof vi.fn>
    getUserId: ReturnType<typeof vi.fn>
    getRooms: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    const pendingTasks = (matrixReceiptService as any).pendingMarkAsReadTasks as Map<
      string,
      { timer: ReturnType<typeof setTimeout> | null }
    >
    pendingTasks?.forEach((task) => {
      if (task.timer) {
        clearTimeout(task.timer)
      }
    })
    pendingTasks?.clear()
    // 重置回执去重缓存，避免跨用例污染（同 roomId+eventId 会被误判为已发送而跳过）
    ;(matrixReceiptService as any).lastSentReceiptEventId?.clear()
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    vi.useRealTimers()

    mockReceiptManager = {
      sendReadReceipt: vi.fn(),
      sendReadReceiptByEventId: vi.fn(),
      setReadMarker: vi.fn(),
      getReceipt: vi.fn(() => [])
    }

    mockRoom = {
      getLiveTimeline: vi.fn(() => ({
        getEvents: vi.fn(() => [])
      })),
      getMember: vi.fn((userId: string) => ({
        name: userId.split(':')[0].replace('@', ''),
        getMxcAvatarUrl: vi.fn(() => `mxc://matrix.org/avatar/${userId}`)
      })),
      getEventReadUpTo: vi.fn(() => null),
      getUnreadNotificationCount: vi.fn(() => 0)
    }

    mockClient = {
      getReadReceiptsManager: vi.fn(() => mockReceiptManager),
      getRoom: vi.fn(() => mockRoom),
      getUserId: vi.fn(() => '@me:matrix.org'),
      getRooms: vi.fn(() => [])
    }
  })

  it('在客户端未初始化时抛错', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    await expect(
      matrixReceiptService.sendReadReceipt('!room:id', {
        getId: () => '$event'
      } as unknown as MatrixEvent)
    ).rejects.toThrow('客户端未初始化')
  })

  it('通过 SDK ReadReceiptsManager 发送已读回执', async () => {
    mockReceiptManager.sendReadReceiptByEventId.mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    const result = await matrixReceiptService.sendReadReceipt('!room:id', {
      getId: () => '$event'
    } as unknown as MatrixEvent)

    expect(mockReceiptManager.sendReadReceiptByEventId).toHaveBeenCalledWith('!room:id', '$event')
    expect(result).toBe('$event')
  })

  it('通过 SDK ReadReceiptsManager 设置阅读标记', async () => {
    mockReceiptManager.setReadMarker.mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    await matrixReceiptService.sendReadMarker('!room:id', '$event')

    expect(mockReceiptManager.setReadMarker).toHaveBeenCalledWith('!room:id', '$event')
  })

  it('同一事件重复发送阅读回执时只发一次（去重）', async () => {
    mockReceiptManager.sendReadReceiptByEventId.mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    const event = { getId: () => '$dup-event' } as unknown as MatrixEvent
    await matrixReceiptService.sendReadReceipt('!room:id', event)
    await matrixReceiptService.sendReadReceipt('!room:id', event)

    expect(mockReceiptManager.sendReadReceiptByEventId).toHaveBeenCalledTimes(1)
    expect(mockReceiptManager.sendReadReceiptByEventId).toHaveBeenCalledWith('!room:id', '$dup-event')
  })

  it('并发触发同一事件只发一次（竞态去重，回归）', async () => {
    mockReceiptManager.sendReadReceiptByEventId.mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    const event = { getId: () => '$race-event' } as unknown as MatrixEvent
    // 不 await 第一个就发起第二个，模拟 changeRoom 的 markSessionRead 与单条已读并发
    const p1 = matrixReceiptService.sendReadReceipt('!room:id', event)
    const p2 = matrixReceiptService.sendReadReceipt('!room:id', event)
    await Promise.all([p1, p2])

    expect(mockReceiptManager.sendReadReceiptByEventId).toHaveBeenCalledTimes(1)
  })

  it('发送失败后清除占位允许重试（不永久吞掉回执）', async () => {
    mockReceiptManager.sendReadReceiptByEventId
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    const event = { getId: () => '$retry-event' } as unknown as MatrixEvent
    await expect(matrixReceiptService.sendReadReceipt('!room:id', event)).rejects.toThrow('network')
    // 失败后重试应再次发送（占位已清除）
    await matrixReceiptService.sendReadReceipt('!room:id', event)
    expect(mockReceiptManager.sendReadReceiptByEventId).toHaveBeenCalledTimes(2)
  })

  it('不同事件仍各自发送（去重不跨事件）', async () => {
    mockReceiptManager.sendReadReceiptByEventId.mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    await matrixReceiptService.sendReadReceipt('!room:id', { getId: () => '$e1' } as unknown as MatrixEvent)
    await matrixReceiptService.sendReadReceipt('!room:id', { getId: () => '$e2' } as unknown as MatrixEvent)

    expect(mockReceiptManager.sendReadReceiptByEventId).toHaveBeenCalledTimes(2)
  })

  it('使用 SDK 回执数据并补全成员展示信息', () => {
    mockReceiptManager.getReceipt.mockReturnValue([
      {
        userId: '@user1:matrix.org',
        eventId: '$event',
        ts: 123456
      }
    ])
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    const receipts = matrixReceiptService.getReadReceipts('!room:id', '$event')

    expect(receipts).toEqual([
      {
        userId: '@user1:matrix.org',
        eventId: '$event',
        timestamp: 123456,
        avatarUrl: 'mxc://matrix.org/avatar/@user1:matrix.org',
        displayName: 'user1'
      }
    ])
  })

  it('获取阅读者时排除自己', () => {
    mockReceiptManager.getReceipt.mockReturnValue([
      { userId: '@me:matrix.org', eventId: '$event', ts: 1 },
      { userId: '@user1:matrix.org', eventId: '$event', ts: 2 }
    ])
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    const readers = matrixReceiptService.getEventReaders('!room:id', '$event')

    expect(readers).toEqual(['@user1:matrix.org'])
  })

  it('离线时将阅读回执加入队列', async () => {
    // 模拟离线状态
    const originalOnLine = navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      value: false,
      configurable: true
    })

    const roomId = '!room:id'
    const eventId = '$event'

    const result = await matrixReceiptService.sendReadReceiptByEventId(roomId, eventId)

    expect(offlineQueueService.enqueue).toHaveBeenCalledWith('receipt', roomId, {
      roomId,
      eventId
    })
    expect(result).toBe(eventId)

    // 恢复在线状态
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      configurable: true
    })
  })

  it('标记房间已读时发送最后一条消息的回执', async () => {
    const events = [{ getId: () => '$event-1' }, { getId: () => '$event-2' }]
    mockRoom.getLiveTimeline.mockReturnValue({
      getEvents: vi.fn(() => events)
    })
    mockReceiptManager.sendReadReceiptByEventId.mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    await matrixReceiptService.markRoomAsRead('!room:id')

    expect(mockReceiptManager.sendReadReceiptByEventId).toHaveBeenCalledWith('!room:id', '$event-2')
  })

  it('房间延迟出现在 SDK 中时会等待后再发送已读回执', async () => {
    vi.useFakeTimers()
    const events = [{ getId: () => '$event-1' }, { getId: () => '$event-2' }]
    mockRoom.getLiveTimeline.mockReturnValue({
      getEvents: vi.fn(() => events)
    })
    mockReceiptManager.sendReadReceiptByEventId.mockResolvedValue(undefined)
    mockClient.getRoom.mockReturnValueOnce(null).mockReturnValueOnce(null).mockReturnValue(mockRoom)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    const pending = matrixReceiptService.markRoomAsRead('!room:id')
    await vi.advanceTimersByTimeAsync(200)
    await pending

    expect(mockClient.getRoom).toHaveBeenCalledTimes(3)
    expect(mockReceiptManager.sendReadReceiptByEventId).toHaveBeenCalledWith('!room:id', '$event-2')
  })

  it('房间始终不存在时会转入后台补偿队列', async () => {
    vi.useFakeTimers()
    mockClient.getRoom.mockReturnValue(null)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    const pending = matrixReceiptService.markRoomAsRead('!room:id')
    await vi.advanceTimersByTimeAsync(3000)
    await pending

    expect((matrixReceiptService as any).pendingMarkAsReadTasks.size).toBe(1)
    expect(mockReceiptManager.sendReadReceiptByEventId).not.toHaveBeenCalled()
  })

  it('房间稍后可用时会自动补发一次已读回执', async () => {
    vi.useFakeTimers()
    const events = [{ getId: () => '$event-1' }, { getId: () => '$event-2' }]
    mockRoom.getLiveTimeline.mockReturnValue({
      getEvents: vi.fn(() => events)
    })
    let currentRoom: typeof mockRoom | null = null
    mockClient.getRoom.mockImplementation(() => currentRoom as unknown as Room)
    mockReceiptManager.sendReadReceiptByEventId.mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    const pending = matrixReceiptService.markRoomAsRead('!room:id')
    await vi.advanceTimersByTimeAsync(3000)
    await pending

    expect(mockReceiptManager.sendReadReceiptByEventId).not.toHaveBeenCalled()

    currentRoom = mockRoom
    await vi.advanceTimersByTimeAsync(1000)

    expect(mockReceiptManager.sendReadReceiptByEventId).toHaveBeenCalledTimes(1)
    expect(mockReceiptManager.sendReadReceiptByEventId).toHaveBeenCalledWith('!room:id', '$event-2')
    expect((matrixReceiptService as any).pendingMarkAsReadTasks.size).toBe(0)
  })

  it('重复触发已读时只保留一个后台补偿任务并在最终超时后告警一次', async () => {
    vi.useFakeTimers()
    mockClient.getRoom.mockReturnValue(null)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    const first = matrixReceiptService.markRoomAsRead('!room:id')
    await vi.advanceTimersByTimeAsync(3000)
    await first

    const second = matrixReceiptService.markRoomAsRead('!room:id')
    await vi.advanceTimersByTimeAsync(3000)
    await second

    expect((matrixReceiptService as any).pendingMarkAsReadTasks.size).toBe(1)

    await vi.advanceTimersByTimeAsync(15000)

    expect((matrixReceiptService as any).pendingMarkAsReadTasks.size).toBe(0)
    expect(vi.mocked(warn)).not.toHaveBeenCalled()
    expect(vi.mocked(info)).toHaveBeenCalledWith(
      expect.stringContaining('[MatrixReceipt] 房间长时间未就绪，已跳过本次已读补发: !room:id')
    )
  })

  it('未找到房间时未读数为 0', () => {
    mockClient.getRoom.mockReturnValue(null)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    expect(matrixReceiptService.getUnreadCount('!room:id')).toBe(0)
  })

  it('优先使用 SDK room.getUnreadNotificationCount', () => {
    const room = {
      getUnreadNotificationCount: vi.fn(() => 5)
    }
    mockClient.getRoom.mockReturnValue(room as unknown as Room)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

    expect(matrixReceiptService.getUnreadCount('!room:id')).toBe(5)
  })

  // FT-133: clearCache 应清理缓存的 client/manager 和 pending 任务
  describe('clearCache (FT-133: explicit cache cleanup)', () => {
    it('清理已缓存的 client 和 manager 引用', () => {
      mockReceiptManager.getReceipt.mockReturnValue([])
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      // 触发缓存
      matrixReceiptService.getReadReceipts('!room:id', '$event')
      expect((matrixReceiptService as any).cachedClient).toBeTruthy()
      expect((matrixReceiptService as any).cachedManager).toBeTruthy()

      // 清理
      matrixReceiptService.clearCache()

      expect((matrixReceiptService as any).cachedClient).toBeNull()
      expect((matrixReceiptService as any).cachedManager).toBeNull()
    })

    it('清理 pending mark-as-read 任务并清除定时器', async () => {
      vi.useFakeTimers()
      mockClient.getRoom.mockReturnValue(null)
      vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)

      const pending = matrixReceiptService.markRoomAsRead('!room:id')
      await vi.advanceTimersByTimeAsync(3000)
      await pending

      expect((matrixReceiptService as any).pendingMarkAsReadTasks.size).toBe(1)

      matrixReceiptService.clearCache()

      expect((matrixReceiptService as any).pendingMarkAsReadTasks.size).toBe(0)
      vi.useRealTimers()
    })
  })
})
