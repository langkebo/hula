/**
 * Space service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute
 * through real matrix-js-sdk code. Catches V1 double-prefix bugs
 * (/_matrix/client/v3/_matrix/client/v1/spaces/... → 404) that vi.mock
 * tests miss because the stub authedRequest bypasses SDK URL construction.
 *
 * The real SDK client lacks the project's custom getSpaceManager()
 * extension, so getSpaceHierarchy/getSpaceHierarchyV1 fall back to
 * authedRequestWithPath — exactly the code path we need to verify.
 *
 * Covers 4 authedRequestWithPath call sites in MatrixSpaceService:
 * getSpaceHierarchy (fallback), getSpaceHierarchyV1 (fallback),
 * checkSpaceRequiresAuth, getSpaceHierarchyPublic (authed path).
 */
import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixClientService } from '../../MatrixClientService'
import { matrixSpaceService } from '../MatrixSpaceService'

const HOMESERVER = 'https://hs.space-contract.test'
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
  http.get(`${HOMESERVER}/_matrix/client/v1/spaces/:spaceId/hierarchy`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ rooms: [{ room_id: '!r1:hs', name: 'Room 1' }], next_batch: 'nb' })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v1/spaces/:spaceId/hierarchy/v1`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ rooms: [{ room_id: '!r2:hs', name: 'Room 2' }] })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v1/rooms/:roomId/hierarchy`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ rooms: [{ room_id: '!r3:hs', name: 'Room 3' }] })
  })
)

describe('Space service URL construction contract (real SDK + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    vi.spyOn(matrixClientService, 'getHomeserverUrl').mockReturnValue(HOMESERVER)
    vi.spyOn(matrixClientService, 'getClient').mockImplementation(() => realClient)
    vi.spyOn(matrixClientService, 'waitForClientReady').mockImplementation(() => Promise.resolve(realClient))
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.space-contract.test',
      deviceId: 'DEV1'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const V1_DOUBLE_PREFIX = /\/_matrix\/client\/v3\/_matrix\/client\/v1/

  it('getSpaceHierarchy falls back to /_matrix/client/v1/spaces/:spaceId/hierarchy (no V1 double-prefix)', async () => {
    const result = await matrixSpaceService.getSpaceHierarchy('!space:hs', { limit: 10, maxDepth: 3 })

    const calls = seenUrls.filter((u) => u.url.includes('/spaces/!space%3Ahs/hierarchy'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/spaces/!space%3Ahs/hierarchy?limit=10&max_depth=3`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.rooms).toHaveLength(1)
    expect(result.next_batch).toBe('nb')
  })

  it('getSpaceHierarchyV1 falls back to /_matrix/client/v1/spaces/:spaceId/hierarchy/v1 (no V1 double-prefix)', async () => {
    const result = await matrixSpaceService.getSpaceHierarchyV1('!space:hs', { limit: 5 })

    const calls = seenUrls.filter((u) => u.url.includes('/hierarchy/v1'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/spaces/!space%3Ahs/hierarchy/v1?limit=5`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.rooms).toHaveLength(1)
  })

  it('checkSpaceRequiresAuth hits /_matrix/client/v1/rooms/:roomId/hierarchy with max_depth=1 (no V1 double-prefix)', async () => {
    const result = await matrixSpaceService.checkSpaceRequiresAuth('!space:hs')

    const calls = seenUrls.filter((u) => u.url.includes('/rooms/!space%3Ahs/hierarchy'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/rooms/!space%3Ahs/hierarchy?max_depth=1`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.requiresAuth).toBe(false)
    expect(result.accessible).toBe(true)
  })

  it('getSpaceHierarchyPublic (authed) hits /_matrix/client/v1/rooms/:roomId/hierarchy (no V1 double-prefix)', async () => {
    const result = await matrixSpaceService.getSpaceHierarchyPublic('!space:hs', { limit: 20, maxDepth: 2 })

    const calls = seenUrls.filter((u) => u.url.includes('/rooms/!space%3Ahs/hierarchy'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v1/rooms/!space%3Ahs/hierarchy?limit=20&max_depth=2`)
    expect(calls[0].url).not.toMatch(V1_DOUBLE_PREFIX)
    expect(result.rooms).toHaveLength(1)
  })
})
