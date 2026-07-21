/**
 * Message service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute.
 * Catches URL double-prefix bugs that vi.mock tests miss.
 *
 * Covers `MatrixMessageService.fetchServerMessages` (private), reached via
 * `getMessageList` with an empty-room stub so the server-fetch fallback fires.
 * Before the stripMatrixPrefix fix, the path was
 * `/_matrix/client/v3/rooms/.../messages` and the SDK re-prepended
 * `/_matrix/client/v3`, producing `/_matrix/client/v3/_matrix/client/v3/...`
 * and a 404. This test locks in the short-path fix.
 */
import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixClientService } from '../../MatrixClientService'
import { matrixMessageService } from '../MatrixMessageService'

const HOMESERVER = 'https://hs.message-contract.test'
const seenUrls: { method: string; url: string }[] = []
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

setupMswServer(
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/messages`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ chunk: [{ event_id: '$srv-1' }, { event_id: '$srv-2' }] })
  })
)

describe('Message service URL construction contract (real SDK + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    vi.spyOn(matrixClientService, 'getHomeserverUrl').mockReturnValue(HOMESERVER)
    vi.spyOn(matrixClientService, 'getClient').mockImplementation(() => realClient)
    vi.spyOn(matrixClientService, 'waitForClientReady').mockImplementation(() => Promise.resolve(realClient))
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.message-contract.test',
      deviceId: 'DEV1'
    })
    // The real SDK client has no rooms loaded (no /sync), so getRoom returns
    // null and getMessageList short-circuits before reaching fetchServerMessages.
    // Override getRoom to return an empty-timeline room so the server-fetch
    // fallback path executes. The SDK's http.authedRequest is NOT stubbed —
    // URL construction runs through real SDK code, which is what we test.
    ;(realClient as unknown as { getRoom: ReturnType<typeof vi.fn> }).getRoom = vi.fn(() => ({
      timeline: []
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('getMessageList (before fallback) hits /_matrix/client/v3/rooms/{roomId}/messages (no duplication)', async () => {
    const result = await matrixMessageService.getMessageList({
      roomId: '!r:hs',
      before: '$nonexistent',
      limit: 20
    })

    expect(seenUrls).toHaveLength(1)
    expect(seenUrls[0].method).toBe('GET')
    // encodeURIComponent('!r:hs') = '!r%3Ahs'; the `$` in the from token is
    // URL-encoded by the SDK's query-string builder.
    expect(seenUrls[0].url).toBe(
      `${HOMESERVER}/_matrix/client/v3/rooms/!r%3Ahs/messages?from=%24nonexistent&limit=20&dir=b`
    )
    expect(seenUrls[0].url).not.toMatch(/\/_matrix\/client\/v3\/_matrix\/client\/v3/)
    // Server events are prepended to the (empty) local timeline.
    expect(result.events).toHaveLength(2)
    expect(result.hasMore).toBe(false)
  })

  it('getMessageList (after fallback) uses dir=f for forward pagination', async () => {
    await matrixMessageService.getMessageList({
      roomId: '!r:hs',
      after: '$nonexistent',
      limit: 5
    })

    expect(seenUrls).toHaveLength(1)
    expect(seenUrls[0].url).toBe(
      `${HOMESERVER}/_matrix/client/v3/rooms/!r%3Ahs/messages?from=%24nonexistent&limit=5&dir=f`
    )
    expect(seenUrls[0].url).not.toMatch(/\/_matrix\/client\/v3\/_matrix\/client\/v3/)
  })

  it('getMessageList skips server fetch when room has no local timeline gap', async () => {
    // With `before` matching an in-timeline event, the server fallback is
    // not triggered — assert no HTTP call is made.
    const room = { timeline: [{ getId: () => '$known' }] }
    ;(realClient as unknown as { getRoom: ReturnType<typeof vi.fn> }).getRoom = vi.fn(() => room)

    await matrixMessageService.getMessageList({
      roomId: '!r:hs',
      before: '$known',
      limit: 20
    })

    expect(seenUrls).toHaveLength(0)
  })
})
