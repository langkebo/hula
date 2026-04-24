import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixReceiptService } from '../MatrixReceiptService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  default: {
    getClient: vi.fn(() => null)
  }
}))

import matrixClientService from '../../MatrixClientService'

describe('MatrixReceiptService', () => {
  let mockReceiptManager: {
    sendReadReceipt: ReturnType<typeof vi.fn>
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
    vi.clearAllMocks()

    mockReceiptManager = {
      sendReadReceipt: vi.fn(),
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
    vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

    await expect(
      matrixReceiptService.sendReadReceipt('!room:id', {
        getId: () => '$event'
      } as any)
    ).rejects.toThrow('客户端未初始化')
  })

  it('通过 SDK ReadReceiptsManager 发送已读回执', async () => {
    mockReceiptManager.sendReadReceipt.mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

    const result = await matrixReceiptService.sendReadReceipt('!room:id', {
      getId: () => '$event'
    } as any)

    expect(mockReceiptManager.sendReadReceipt).toHaveBeenCalledWith('!room:id', '$event')
    expect(result).toBe('$event')
  })

  it('通过 SDK ReadReceiptsManager 设置阅读标记', async () => {
    mockReceiptManager.setReadMarker.mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

    await matrixReceiptService.sendReadMarker('!room:id', '$event')

    expect(mockReceiptManager.setReadMarker).toHaveBeenCalledWith('!room:id', '$event')
  })

  it('使用 SDK 回执数据并补全成员展示信息', () => {
    mockReceiptManager.getReceipt.mockReturnValue([
      {
        userId: '@user1:matrix.org',
        eventId: '$event',
        ts: 123456
      }
    ])
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

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
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

    const readers = matrixReceiptService.getEventReaders('!room:id', '$event')

    expect(readers).toEqual(['@user1:matrix.org'])
  })

  it('标记房间已读时发送最后一条消息的回执', async () => {
    const events = [{ getId: () => '$event-1' }, { getId: () => '$event-2' }]
    mockRoom.getLiveTimeline.mockReturnValue({
      getEvents: vi.fn(() => events)
    })
    mockReceiptManager.sendReadReceipt.mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as any)

    await matrixReceiptService.markRoomAsRead('!room:id')

    expect(mockReceiptManager.sendReadReceipt).toHaveBeenCalledWith('!room:id', '$event-2')
  })
})
