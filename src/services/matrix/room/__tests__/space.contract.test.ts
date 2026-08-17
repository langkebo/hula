/**
 * Space service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute
 * through real matrix-js-sdk code. `getSpaceHierarchy` now delegates to
 * `SpaceManager.getSpaceHierarchyPage`（经 `initializeManagerExtensions`
 * 注册），命中 `/_matrix/client/v3/spaces/{id}/hierarchy`。
 */
import { createClient, initializeManagerExtensions, type MatrixClient } from 'matrix-js-sdk'
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
  http.get(`${HOMESERVER}/_matrix/client/v3/spaces/:spaceId/hierarchy`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ rooms: [{ room_id: '!r1:hs', name: 'Room 1' }], next_batch: 'nb' })
  })
)

describe('Space service URL construction contract (real SDK + msw)', () => {
  beforeEach(async () => {
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
    await initializeManagerExtensions()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('getSpaceHierarchy hits /_matrix/client/v3/spaces/:spaceId/hierarchy via SpaceManager', async () => {
    const result = await matrixSpaceService.getSpaceHierarchy('!space:hs', { limit: 10, maxDepth: 3 })

    const calls = seenUrls.filter((u) => u.url.includes('/spaces/!space%3Ahs/hierarchy'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/spaces/!space%3Ahs/hierarchy?limit=10&max_depth=3`)
    expect(result.rooms).toHaveLength(1)
    expect(result.next_batch).toBe('nb')
  })
})
