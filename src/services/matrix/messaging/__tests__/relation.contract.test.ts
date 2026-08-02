/**
 * Message-relation service contract tests.
 *
 * fetchRelations, fetchRelationsByType, getAggregations delegate to the SDK
 * RelationsManager — tests verify the manager is called with correct args
 * (manager is stubbed).
 *
 * sendRelation delegates to SDK RelationsManager.sendRelationViaSendRelation,
 * which issues a PUT through client.http.authedRequest — tested via MSW at the
 * HTTP boundary using the real manager (prototype method registered by
 * extendMatrixClientWithManagers).
 */
import { createClient, extendMatrixClientWithManagers, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixClientService } from '../../MatrixClientService'
import { matrixMessageRelationService } from '../MatrixMessageRelationService'

const HOMESERVER = 'https://hs.relation-contract.test'
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

describe('Message-relation service contract', () => {
  let mockRelationsManager: {
    fetchRelations: ReturnType<typeof vi.fn>
    getAggregations: ReturnType<typeof vi.fn>
  }

  beforeAll(async () => {
    // Register getRelationsManager (and all other manager getters) on
    // MatrixClient.prototype. Required for the sendRelation test, which
    // exercises the real SDK RelationsManager.sendRelationViaSendRelation
    // path through authedRequest → MSW.
    await extendMatrixClientWithManagers()
  })

  beforeEach(() => {
    seenUrls.length = 0
    vi.spyOn(matrixClientService, 'getHomeserverUrl').mockReturnValue(HOMESERVER)
    vi.spyOn(matrixClientService, 'waitForClientReady').mockImplementation(() => Promise.resolve(realClient))
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.relation-contract.test',
      deviceId: 'DEV1'
    })

    mockRelationsManager = {
      fetchRelations: vi.fn(),
      getAggregations: vi.fn()
    }
    // Directly assign getRelationsManager since extendMatrixClientWithManagers()
    // is not called in the test environment, so the prototype method is absent.
    ;(realClient as unknown as { getRelationsManager: () => typeof mockRelationsManager }).getRelationsManager = () =>
      mockRelationsManager
    vi.spyOn(matrixClientService, 'getClient').mockImplementation(() => realClient)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetchRelations delegates to SDK RelationsManager.fetchRelations with args', async () => {
    mockRelationsManager.fetchRelations.mockResolvedValue({ chunk: [{ event_id: '$rel-1' }], next_batch: 'nb' })

    const result = await matrixMessageRelationService.fetchRelations('!r:hs', '$e1', {
      from: 'tok-1',
      limit: 10,
      dir: 'b'
    })

    expect(mockRelationsManager.fetchRelations).toHaveBeenCalledWith('!r:hs', '$e1', null, null, {
      from: 'tok-1',
      limit: 10,
      dir: 'b'
    })
    expect(result?.chunk).toHaveLength(1)
  })

  it('fetchRelationsByType delegates to SDK RelationsManager.fetchRelations with relType', async () => {
    mockRelationsManager.fetchRelations.mockResolvedValue({ chunk: [{ event_id: '$rel-2' }] })

    const result = await matrixMessageRelationService.fetchRelationsByType('!r:hs', '$e1', 'm.replace', { limit: 5 })

    expect(mockRelationsManager.fetchRelations).toHaveBeenCalledWith('!r:hs', '$e1', 'm.replace', null, { limit: 5 })
    expect(result?.chunk).toHaveLength(1)
  })

  it('getAggregations delegates to SDK RelationsManager.getAggregations', async () => {
    mockRelationsManager.getAggregations.mockResolvedValue({ chunk: [{ type: 'm.annotation', key: '👍', count: 3 }] })

    const result = await matrixMessageRelationService.getAggregations('!r:hs', '$e1', 'm.annotation')

    expect(mockRelationsManager.getAggregations).toHaveBeenCalledWith('!r:hs', '$e1', 'm.annotation')
    expect(result?.chunk?.[0]?.count).toBe(3)
  })

  it('sendRelation hits /_matrix/client/v3/rooms/{roomId}/relations/{eventId}/{relType}/{txnId} with PUT (no duplication)', async () => {
    // beforeEach installed a stub getRelationsManager on the instance (for the
    // delegation tests). Remove it so the real prototype method registered by
    // extendMatrixClientWithManagers is used — sendRelationViaSendRelation
    // then flows through client.http.authedRequest to MSW.
    delete (realClient as unknown as Record<string, unknown>).getRelationsManager

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

  it('fetchRelations returns null when client missing (no SDK call)', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null as never)

    const result = await matrixMessageRelationService.fetchRelations('!r:hs', '$e1')

    expect(result).toBeNull()
    expect(mockRelationsManager.fetchRelations).not.toHaveBeenCalled()
  })
})
