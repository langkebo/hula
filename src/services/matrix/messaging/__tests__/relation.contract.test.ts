/**
 * Message-relation service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute.
 * Catches URL double-prefix bugs that vi.mock tests miss.
 *
 * Covers the 4 public methods that previously called `client.http.authedRequest`
 * directly: fetchRelations, fetchRelationsByType, getAggregations, sendRelation.
 *
 * After refactoring:
 * - fetchRelations / fetchRelationsByType use `client.relations()` (SDK high-level,
 *   hits /_matrix/client/v1/rooms/.../relations/...).
 * - getAggregations uses `client.getRelationsManager().getAggregations()` (SDK high-level,
 *   hits /_matrix/client/v1/rooms/.../aggregations/... per Matrix spec v1).
 * - sendRelation uses `client.sendEvent()` (SDK high-level,
 *   hits /_matrix/client/v3/rooms/.../send/...).
 */
import { createClient, extendMatrixClientWithManagers, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixClientService } from '../../MatrixClientService'
import { matrixMessageRelationService } from '../MatrixMessageRelationService'

const HOMESERVER = 'https://hs.relation-contract.test'
const PREFIX_V1 = '/_matrix/client/v1'
const PREFIX_V3 = '/_matrix/client/v3'
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

setupMswServer(
  // client.relations() calls fetchRoomEvent in addition to fetchRelations
  http.get(`${HOMESERVER}${PREFIX_V3}/rooms/:roomId/event/:eventId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ event_id: '$e1', type: 'm.room.message', content: { body: 'orig' } })
  }),
  // fetchRelations → client.relations() → SDK uses ClientPrefix.V1
  http.get(`${HOMESERVER}${PREFIX_V1}/rooms/:roomId/relations/:eventId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ chunk: [{ event_id: '$rel-1' }], next_batch: 'nb' })
  }),
  // fetchRelationsByType → client.relations() → SDK uses ClientPrefix.V1
  http.get(`${HOMESERVER}${PREFIX_V1}/rooms/:roomId/relations/:eventId/:relType`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ chunk: [{ event_id: '$rel-2' }] })
  }),
  // getAggregations → client.getRelationsManager().getAggregations() → SDK RelationsManager uses ClientPrefix.V1 (per Matrix spec)
  http.get(`${HOMESERVER}${PREFIX_V1}/rooms/:roomId/aggregations/:eventId/:relType`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ chunk: [{ type: 'm.annotation', key: '👍', count: 3 }] })
  }),
  // sendRelation → client.sendEvent() → SDK send endpoint V3
  http.put(`${HOMESERVER}${PREFIX_V3}/rooms/:roomId/send/:eventType/:txnId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ event_id: '$new-rel' })
  })
)

describe('Message-relation service URL construction contract (real SDK + msw)', () => {
  beforeAll(async () => {
    // In Vitest environment, SDK skips async manager init (shouldSkipAsyncManagerInit).
    // Manually initialize so client.relations() / getRelationsManager() are available.
    await extendMatrixClientWithManagers()
  })

  beforeEach(() => {
    seenUrls.length = 0
    vi.spyOn(matrixClientService, 'getHomeserverUrl').mockReturnValue(HOMESERVER)
    vi.spyOn(matrixClientService, 'getClient').mockImplementation(() => realClient)
    vi.spyOn(matrixClientService, 'waitForClientReady').mockImplementation(() => Promise.resolve(realClient))
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.relation-contract.test',
      deviceId: 'DEV1'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetchRelations hits /_matrix/client/v1/rooms/{roomId}/relations/{eventId} (no duplication)', async () => {
    await matrixMessageRelationService.fetchRelations('!r:hs', '$e1', {
      from: 'tok-1',
      limit: 10,
      dir: 'b'
    })

    // client.relations() also calls fetchRoomEvent (GET .../event/$e1) — filter to relations URLs
    const relationsUrls = seenUrls.filter((s) => s.url.includes('/relations/'))
    expect(relationsUrls).toHaveLength(1)
    expect(relationsUrls[0].method).toBe('GET')
    // encodeURIComponent('!r:hs') = '!r%3Ahs' ('!' is unreserved, not encoded)
    // encodeURIComponent('$e1')  = '%24e1'
    expect(relationsUrls[0].url).toBe(
      `${HOMESERVER}${PREFIX_V1}/rooms/!r%3Ahs/relations/%24e1?from=tok-1&limit=10&dir=b`
    )
    expect(relationsUrls[0].url).not.toMatch(/\/_matrix\/client\/v1\/_matrix\/client\/v1/)
  })

  it('fetchRelationsByType hits /_matrix/client/v1/rooms/{roomId}/relations/{eventId}/{relType} (no duplication)', async () => {
    const result = await matrixMessageRelationService.fetchRelationsByType('!r:hs', '$e1', 'm.replace', { limit: 5 })

    const relationsUrls = seenUrls.filter((s) => s.url.includes('/relations/'))
    expect(relationsUrls).toHaveLength(1)
    expect(relationsUrls[0].method).toBe('GET')
    expect(relationsUrls[0].url).toBe(`${HOMESERVER}${PREFIX_V1}/rooms/!r%3Ahs/relations/%24e1/m.replace?limit=5`)
    expect(relationsUrls[0].url).not.toMatch(/\/_matrix\/client\/v1\/_matrix\/client\/v1/)
    expect(result?.chunk).toHaveLength(1)
  })

  it('getAggregations hits /_matrix/client/v1/rooms/{roomId}/aggregations/{eventId}/{relType} (no duplication)', async () => {
    const result = await matrixMessageRelationService.getAggregations('!r:hs', '$e1', 'm.annotation')

    expect(seenUrls).toHaveLength(1)
    expect(seenUrls[0].method).toBe('GET')
    expect(seenUrls[0].url).toBe(`${HOMESERVER}${PREFIX_V1}/rooms/!r%3Ahs/aggregations/%24e1/m.annotation`)
    expect(seenUrls[0].url).not.toMatch(/\/_matrix\/client\/v1\/_matrix\/client\/v1/)
    expect(result?.chunk?.[0]?.count).toBe(3)
  })

  it('sendRelation hits /_matrix/client/v3/rooms/{roomId}/send/{eventType}/{txnId} with PUT (no duplication)', async () => {
    const before = Date.now()
    const result = await matrixMessageRelationService.sendRelation(
      '!r:hs',
      '$root',
      'm.annotation',
      'm.reaction',
      { 'm.relates_to': { event_id: '$root', key: '👍', rel_type: 'm.annotation' } },
      '👍'
    )
    const after = Date.now()

    expect(seenUrls).toHaveLength(1)
    expect(seenUrls[0].method).toBe('PUT')
    expect(seenUrls[0].url).not.toMatch(/\/_matrix\/client\/v3\/_matrix\/client\/v3/)

    // txnId is generated as `txn_${Date.now()}` — extract and validate recency.
    const match = seenUrls[0].url.match(/\/m\.reaction\/(txn_\d+)$/)
    expect(match).not.toBeNull()
    const txnTs = Number(match![1].replace('txn_', ''))
    expect(txnTs).toBeGreaterThanOrEqual(before)
    expect(txnTs).toBeLessThanOrEqual(after)

    expect(result?.event_id).toBe('$new-rel')
  })

  it('fetchRelations returns null when client missing (no HTTP call)', async () => {
    const previousClient = realClient
    realClient = null as unknown as MatrixClient
    try {
      const result = await matrixMessageRelationService.fetchRelations('!r:hs', '$e1')
      expect(result).toBeNull()
      expect(seenUrls).toHaveLength(0)
    } finally {
      realClient = previousClient
    }
  })
})
