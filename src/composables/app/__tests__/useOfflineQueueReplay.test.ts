import { beforeEach, describe, expect, it, vi } from 'vitest'

// Capture the replay function set by initOfflineQueue
const { replayFnRef } = vi.hoisted(() => ({
  replayFnRef: { current: null as ((op: Record<string, unknown>) => Promise<void>) | null }
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    setReplayFn: vi.fn((fn) => {
      replayFnRef.current = fn
    }),
    startNetworkListener: vi.fn(),
    enqueue: vi.fn(),
    getQueue: vi.fn(() => []),
    getPendingCount: vi.fn(() => 0),
    replayAll: vi.fn(async () => ({ succeeded: 0, failed: 0 }))
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

import { useOfflineQueueReplay } from '@/composables/app/useOfflineQueueReplay'

describe('useOfflineQueueReplay — friend operations', () => {
  beforeEach(() => {
    replayFnRef.current = null
  })

  it('处理 friend_accept 操作时调用 acceptFriendRequest', async () => {
    const acceptFriendRequest = vi.fn().mockResolvedValue(undefined)
    const { initOfflineQueue } = useOfflineQueueReplay({
      getMatrixClientService: vi.fn().mockResolvedValue({ getClient: () => null }),
      getMatrixMessageService: vi.fn().mockResolvedValue({}),
      getMatrixReceiptService: vi.fn().mockResolvedValue({}),
      getMatrixReactionService: vi.fn().mockResolvedValue({}),
      getMatrixRoomService: vi.fn().mockResolvedValue({}),
      getMatrixRoomCreationService: vi.fn().mockResolvedValue({}),
      getRoomOperations: vi.fn().mockResolvedValue({}),
      getMatrixFriendService: vi.fn().mockResolvedValue({ acceptFriendRequest })
    })

    await initOfflineQueue()
    expect(replayFnRef.current).not.toBeNull()

    await replayFnRef.current!({
      id: 'test-1',
      type: 'friend_accept',
      roomId: '',
      payload: { userId: '@user:server' },
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending'
    })

    expect(acceptFriendRequest).toHaveBeenCalledWith('@user:server')
  })

  it('处理 friend_reject 操作时调用 rejectFriendRequest', async () => {
    const rejectFriendRequest = vi.fn().mockResolvedValue(undefined)
    const { initOfflineQueue } = useOfflineQueueReplay({
      getMatrixClientService: vi.fn().mockResolvedValue({ getClient: () => null }),
      getMatrixMessageService: vi.fn().mockResolvedValue({}),
      getMatrixReceiptService: vi.fn().mockResolvedValue({}),
      getMatrixReactionService: vi.fn().mockResolvedValue({}),
      getMatrixRoomService: vi.fn().mockResolvedValue({}),
      getMatrixRoomCreationService: vi.fn().mockResolvedValue({}),
      getRoomOperations: vi.fn().mockResolvedValue({}),
      getMatrixFriendService: vi.fn().mockResolvedValue({ rejectFriendRequest })
    })

    await initOfflineQueue()
    await replayFnRef.current!({
      id: 'test-2',
      type: 'friend_reject',
      roomId: '',
      payload: { userId: '@user:server' },
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending'
    })

    expect(rejectFriendRequest).toHaveBeenCalledWith('@user:server')
  })

  it('处理 friend_cancel 操作时调用 cancelFriendRequest', async () => {
    const cancelFriendRequest = vi.fn().mockResolvedValue(undefined)
    const { initOfflineQueue } = useOfflineQueueReplay({
      getMatrixClientService: vi.fn().mockResolvedValue({ getClient: () => null }),
      getMatrixMessageService: vi.fn().mockResolvedValue({}),
      getMatrixReceiptService: vi.fn().mockResolvedValue({}),
      getMatrixReactionService: vi.fn().mockResolvedValue({}),
      getMatrixRoomService: vi.fn().mockResolvedValue({}),
      getMatrixRoomCreationService: vi.fn().mockResolvedValue({}),
      getRoomOperations: vi.fn().mockResolvedValue({}),
      getMatrixFriendService: vi.fn().mockResolvedValue({ cancelFriendRequest })
    })

    await initOfflineQueue()
    await replayFnRef.current!({
      id: 'test-3',
      type: 'friend_cancel',
      roomId: '',
      payload: { userId: '@user:server' },
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending'
    })

    expect(cancelFriendRequest).toHaveBeenCalledWith('@user:server')
  })
})

describe('useOfflineQueueReplay — burn after read operations', () => {
  beforeEach(() => {
    replayFnRef.current = null
  })

  it('处理 burn_enable 操作时调用 enableBurn', async () => {
    const enableBurn = vi.fn().mockResolvedValue(null)
    const { initOfflineQueue } = useOfflineQueueReplay({
      getMatrixClientService: vi.fn().mockResolvedValue({ getClient: () => null }),
      getMatrixMessageService: vi.fn().mockResolvedValue({}),
      getMatrixReceiptService: vi.fn().mockResolvedValue({}),
      getMatrixReactionService: vi.fn().mockResolvedValue({}),
      getMatrixRoomService: vi.fn().mockResolvedValue({}),
      getMatrixRoomCreationService: vi.fn().mockResolvedValue({}),
      getRoomOperations: vi.fn().mockResolvedValue({}),
      getMatrixBurnAfterReadService: vi.fn().mockResolvedValue({ enableBurn })
    })

    await initOfflineQueue()
    await replayFnRef.current!({
      id: 'test-4',
      type: 'burn_enable',
      roomId: '!room:server',
      payload: { roomId: '!room:server', burnAfterMs: 60000 },
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending'
    })

    expect(enableBurn).toHaveBeenCalledWith('!room:server', 60000)
  })

  it('处理 burn_disable 操作时调用 disableBurn', async () => {
    const disableBurn = vi.fn().mockResolvedValue(null)
    const { initOfflineQueue } = useOfflineQueueReplay({
      getMatrixClientService: vi.fn().mockResolvedValue({ getClient: () => null }),
      getMatrixMessageService: vi.fn().mockResolvedValue({}),
      getMatrixReceiptService: vi.fn().mockResolvedValue({}),
      getMatrixReactionService: vi.fn().mockResolvedValue({}),
      getMatrixRoomService: vi.fn().mockResolvedValue({}),
      getMatrixRoomCreationService: vi.fn().mockResolvedValue({}),
      getRoomOperations: vi.fn().mockResolvedValue({}),
      getMatrixBurnAfterReadService: vi.fn().mockResolvedValue({ disableBurn })
    })

    await initOfflineQueue()
    await replayFnRef.current!({
      id: 'test-5',
      type: 'burn_disable',
      roomId: '!room:server',
      payload: { roomId: '!room:server' },
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending'
    })

    expect(disableBurn).toHaveBeenCalledWith('!room:server')
  })
})

describe('useOfflineQueueReplay — widget operations', () => {
  beforeEach(() => {
    replayFnRef.current = null
  })

  it('处理 widget_create 操作时调用 createWidget', async () => {
    const createWidget = vi.fn().mockResolvedValue(null)
    const { initOfflineQueue } = useOfflineQueueReplay({
      getMatrixClientService: vi.fn().mockResolvedValue({ getClient: () => null }),
      getMatrixMessageService: vi.fn().mockResolvedValue({}),
      getMatrixReceiptService: vi.fn().mockResolvedValue({}),
      getMatrixReactionService: vi.fn().mockResolvedValue({}),
      getMatrixRoomService: vi.fn().mockResolvedValue({}),
      getMatrixRoomCreationService: vi.fn().mockResolvedValue({}),
      getRoomOperations: vi.fn().mockResolvedValue({}),
      getMatrixWidgetService: vi.fn().mockResolvedValue({ createWidget })
    })

    await initOfflineQueue()
    await replayFnRef.current!({
      id: 'test-widget-1',
      type: 'widget_create',
      roomId: '!room:server',
      payload: {
        roomId: '!room:server',
        widgetType: 'm.custom',
        url: 'https://example.com/widget',
        name: 'My Widget'
      },
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending'
    })

    expect(createWidget).toHaveBeenCalledWith('!room:server', {
      widgetType: 'm.custom',
      url: 'https://example.com/widget',
      name: 'My Widget'
    })
  })

  it('处理 widget_delete 操作时调用 deleteWidget', async () => {
    const deleteWidget = vi.fn().mockResolvedValue(true)
    const { initOfflineQueue } = useOfflineQueueReplay({
      getMatrixClientService: vi.fn().mockResolvedValue({ getClient: () => null }),
      getMatrixMessageService: vi.fn().mockResolvedValue({}),
      getMatrixReceiptService: vi.fn().mockResolvedValue({}),
      getMatrixReactionService: vi.fn().mockResolvedValue({}),
      getMatrixRoomService: vi.fn().mockResolvedValue({}),
      getMatrixRoomCreationService: vi.fn().mockResolvedValue({}),
      getRoomOperations: vi.fn().mockResolvedValue({}),
      getMatrixWidgetService: vi.fn().mockResolvedValue({ deleteWidget })
    })

    await initOfflineQueue()
    await replayFnRef.current!({
      id: 'test-widget-2',
      type: 'widget_delete',
      roomId: '!room:server',
      payload: { widgetId: 'widget-123' },
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending'
    })

    expect(deleteWidget).toHaveBeenCalledWith('widget-123')
  })
})

describe('useOfflineQueueReplay — reaction remove operation', () => {
  beforeEach(() => {
    replayFnRef.current = null
  })

  it('处理 reaction_remove 操作时调用 removeReaction', async () => {
    const removeReaction = vi.fn().mockResolvedValue(undefined)
    const { initOfflineQueue } = useOfflineQueueReplay({
      getMatrixClientService: vi.fn().mockResolvedValue({ getClient: () => null }),
      getMatrixMessageService: vi.fn().mockResolvedValue({}),
      getMatrixReceiptService: vi.fn().mockResolvedValue({}),
      getMatrixReactionService: vi.fn().mockResolvedValue({ removeReaction }),
      getMatrixRoomService: vi.fn().mockResolvedValue({}),
      getMatrixRoomCreationService: vi.fn().mockResolvedValue({}),
      getRoomOperations: vi.fn().mockResolvedValue({})
    })

    await initOfflineQueue()
    await replayFnRef.current!({
      id: 'test-reaction-remove',
      type: 'reaction_remove',
      roomId: '!room:server',
      payload: { roomId: '!room:server', reactionEventId: '$reaction_1' },
      createdAt: Date.now(),
      retryCount: 0,
      maxRetries: 3,
      status: 'pending'
    })

    expect(removeReaction).toHaveBeenCalledWith('!room:server', '$reaction_1')
  })
})
