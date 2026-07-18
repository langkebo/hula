/**
 * Message-relation service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute.
 * Catches URL double-prefix bugs that vi.mock tests miss.
 *
 * Covers the 4 public methods that call `client.http.authedRequest` directly
 * (no SDK Manager fallback): fetchRelations, fetchRelationsByType,
 * getAggregations, sendRelation.
 */
import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixMessageRelationService } from '../MatrixMessageRelationService'

const HOMESERVER = 'https://hs.relation-contract.test'
const seenUrls: { method: string; url: string }[] = []
let realClient: MatrixClient

vi.mock('../../MatrixClientService', () => {
  // MatrixMessageRelationService imports this module via `default` import,
  // BaseMatrixService imports via the named `matrixClientService` export —
  // provide both so the same mock satisfies every code path.
  // All getters reference `realClient` lazily so vi.mock hoisting is safe.
  const instance = {
    getClient: (): MatrixClient => realClient,
    getHomeserverUrl: () => HOMESERVER,
    waitForClientReady: () => Promise.resolve(realClient)
  }
  return { default: instance, matrixClientService: instance }
})

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

setupMswServer(
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/relations/:eventId`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ chunk: [{ event_id: '$rel-1' }], next_batch: 'nb' })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/relations/:eventId/:relType`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ chunk: [{ event_id: '$rel-2' }] })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/aggregations/:eventId/:relType`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ chunk: [{ type: 'm.annotation', key: '👍', count: 3 }] })
  }),
  http.put(`${HOMESERVER}/_matrix/client/v3/rooms/:roomId/relations/:eventId/:relType/:txnId`, async ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      event_id: '$new-rel',
      room_id: body.room_id ?? '!r:hs',
      relates_to: { event_id: '$root', rel_type: 'm.annotation' }
    })
  })
)

describe('Message-relation service URL construction contract (real SDK + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
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

  it('fetchRelations hits /_matrix/client/v3/rooms/{roomId}/relations/{eventId} (no duplication)', async () => {
    const result = await matrixMessageRelationService.fetchRelations('!r:hs', '$e1', {
      from: 'tok-1',
      limit: 10,
      dir: 'b'
    })

    // seenUrls is reset in beforeEach, so exactly one GET should be recorded.
    expect(seenUrls).toHaveLength(1)
    expect(seenUrls[0].method).toBe('GET')
    // encodeURIComponent('!r:hs') = '!r%3Ahs' ('!' is unreserved, not encoded)
    // encodeURIComponent('$e1')  = '%24e1'
    expect(seenUrls[0].url).toBe(
      `${HOMESERVER}/_matrix/client/v3/rooms/!r%3Ahs/relations/%24e1?from=tok-1&limit=10&dir=b`
    )
    expect(seenUrls[0].url).not.toMatch(/\/_matrix\/client\/v3\/_matrix\/client\/v3/)
    expect(result?.chunk).toHaveLength(1)
  })

  it('fetchRelationsByType hits /_matrix/client/v3/rooms/{roomId}/relations/{eventId}/{relType} (no duplication)', async () => {
    const result = await matrixMessageRelationService.fetchRelationsByType('!r:hs', '$e1', 'm.replace', { limit: 5 })

    expect(seenUrls).toHaveLength(1)
    expect(seenUrls[0].method).toBe('GET')
    expect(seenUrls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!r%3Ahs/relations/%24e1/m.replace?limit=5`)
    expect(seenUrls[0].url).not.toMatch(/\/_matrix\/client\/v3\/_matrix\/client\/v3/)
    expect(result?.chunk).toHaveLength(1)
  })

  it('getAggregations hits /_matrix/client/v3/rooms/{roomId}/aggregations/{eventId}/{relType} (no duplication)', async () => {
    const result = await matrixMessageRelationService.getAggregations('!r:hs', '$e1', 'm.annotation')

    expect(seenUrls).toHaveLength(1)
    expect(seenUrls[0].method).toBe('GET')
    expect(seenUrls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/rooms/!r%3Ahs/aggregations/%24e1/m.annotation`)
    expect(seenUrls[0].url).not.toMatch(/\/_matrix\/client\/v3\/_matrix\/client\/v3/)
    expect(result?.chunk?.[0]?.count).toBe(3)
  })

  it('sendRelation hits /_matrix/client/v3/rooms/{roomId}/relations/{eventId}/{relType}/{txnId} with PUT (no duplication)', async () => {
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
    const match = seenUrls[0].url.match(/\/m\.annotation\/(txn_\d+)$/)
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
