/**
 * Message service contract tests.
 *
 * `fetchServerMessages` now delegates to SDK `RoomEventsManager.getMessages()`.
 * Tests verify the manager is called with correct args (roomId, dir, limit, from).
 *
 * `getMessageList` is reached via an empty-room stub so the server-fetch
 * fallback fires. The SDK manager is mocked — URL construction is the SDK's
 * responsibility, not the service's.
 */
import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { matrixMessageService } from '../MatrixMessageService'

const HOMESERVER = 'https://hs.message-contract.test'
let realClient: MatrixClient

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

// Transitive deps of MatrixMessageService — stubbed so the module loads
// cleanly without pulling in Tauri/i18n/storage stacks. None of these are
// exercised by `fetchServerMessages`.
vi.mock('../../MatrixEventService', () => ({
  matrixEventService: { sendEvent: vi.fn() }
}))
vi.mock('../MatrixReactionService', () => ({
  matrixReactionService: { addReaction: vi.fn(), removeReaction: vi.fn() }
}))
vi.mock('../MatrixReceiptService', () => ({
  matrixReceiptService: { sendReadReceiptByEventId: vi.fn() }
}))
vi.mock('../MatrixMessageRelationService', () => ({
  matrixMessageRelationService: { editMessage: vi.fn() }
}))
vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: { enqueue: vi.fn() }
}))

describe('Message service contract (SDK RoomEventsManager)', () => {
  let mockRoomEventsManager: {
    getMessages: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    vi.spyOn(matrixClientService, 'getHomeserverUrl').mockReturnValue(HOMESERVER)
    vi.spyOn(matrixClientService, 'waitForClientReady').mockImplementation(() => Promise.resolve(realClient))
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.message-contract.test',
      deviceId: 'DEV1'
    })

    mockRoomEventsManager = {
      getMessages: vi.fn()
    }
    // Directly assign getRoomEventsManager since extendMatrixClientWithManagers()
    // is not called in the test environment, so the prototype method is absent.
    ;(realClient as unknown as { getRoomEventsManager: () => typeof mockRoomEventsManager }).getRoomEventsManager =
      () => mockRoomEventsManager
    vi.spyOn(matrixClientService, 'getClient').mockImplementation(() => realClient)

    // The real SDK client has no rooms loaded (no /sync), so getRoom returns
    // null and getMessageList short-circuits before reaching fetchServerMessages.
    // Override getRoom to return an empty-timeline room so the server-fetch
    // fallback path executes.
    ;(realClient as unknown as { getRoom: ReturnType<typeof vi.fn> }).getRoom = vi.fn(() => ({
      timeline: []
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('getMessageList (before fallback) delegates to getMessages with dir=b', async () => {
    mockRoomEventsManager.getMessages.mockResolvedValue({
      chunk: [{ event_id: '$srv-1' }, { event_id: '$srv-2' }],
      start: '',
      end: ''
    })

    const result = await matrixMessageService.getMessageList({
      roomId: '!r:hs',
      before: '$nonexistent',
      limit: 20
    })

    expect(mockRoomEventsManager.getMessages).toHaveBeenCalledWith('!r:hs', 'b', 20, '$nonexistent')
    // Server events are prepended to the (empty) local timeline.
    expect(result.events).toHaveLength(2)
    expect(result.hasMore).toBe(false)
  })

  it('getMessageList (after fallback) uses dir=f for forward pagination', async () => {
    mockRoomEventsManager.getMessages.mockResolvedValue({ chunk: [], start: '', end: '' })

    await matrixMessageService.getMessageList({
      roomId: '!r:hs',
      after: '$nonexistent',
      limit: 5
    })

    expect(mockRoomEventsManager.getMessages).toHaveBeenCalledWith('!r:hs', 'f', 5, '$nonexistent')
  })

  it('getMessageList skips server fetch when room has no local timeline gap', async () => {
    // With `before` matching an in-timeline event, the server fallback is
    // not triggered — assert no SDK manager call is made.
    const room = { timeline: [{ getId: () => '$known' }] }
    ;(realClient as unknown as { getRoom: ReturnType<typeof vi.fn> }).getRoom = vi.fn(() => room)

    await matrixMessageService.getMessageList({
      roomId: '!r:hs',
      before: '$known',
      limit: 20
    })

    expect(mockRoomEventsManager.getMessages).not.toHaveBeenCalled()
  })
})
