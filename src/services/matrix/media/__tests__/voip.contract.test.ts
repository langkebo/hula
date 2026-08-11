/**
 * Media/VoIP service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Tests URL construction for MatrixVoIPService.
 */
import { createClient, initializeManagerExtensions, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixVoIPService } from '../MatrixVoIPService'

const HOMESERVER = 'https://hs.voip-contract.test'
const seenUrls: string[] = []
let realClient: MatrixClient

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: () => realClient,
    getHomeserverUrl: () => HOMESERVER,
    waitForClientReady: () => Promise.resolve(realClient)
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

setupMswServer(
  http.get(`${HOMESERVER}/_matrix/client/v3/voip/turnServer`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({
      username: 'user',
      password: 'pass',
      uris: ['turn:turn.test:3478'],
      ttl: 3600
    })
  })
)

describe('VoIP service URL construction contract (real SDK + msw)', () => {
  beforeAll(async () => {
    // In Vitest environment, SDK skips async manager init. Manually initialize
    // so client.getTurnServerManager() is available.
    await initializeManagerExtensions()
  })

  beforeEach(() => {
    seenUrls.length = 0
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.voip-contract.test',
      deviceId: 'DEV1'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('getTurnServer hits /_matrix/client/v3/voip/turnServer (no duplication)', async () => {
    const result = await matrixVoIPService.getTurnServer()

    const calls = seenUrls.filter((u) => u.includes('/voip/turnServer'))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/voip/turnServer`)
    expect(result.username).toBe('user')
  })
})
