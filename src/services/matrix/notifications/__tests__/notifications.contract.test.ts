/**
 * Notifications service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Tests URL construction for MatrixPushService.
 */
import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixPushService } from '../MatrixPushService'

const HOMESERVER = 'https://hs.push-contract.test'
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
  http.get(`${HOMESERVER}/_matrix/client/v3/pushers`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({ pushers: [] })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v3/pushers/set`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({})
  })
)

describe('Push service URL construction contract (real SDK + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.push-contract.test',
      deviceId: 'DEV1'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('getPushers hits /_matrix/client/v3/pushers (no duplication)', async () => {
    await matrixPushService.getPushers()

    const calls = seenUrls.filter((u) => u.includes('/pushers') && !u.includes('/pushers/set'))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/pushers`)
  })

  it('unregisterPusher hits /_matrix/client/v3/pushers/set (no duplication)', async () => {
    await matrixPushService.unregisterPusher('pushkey-1', 'app-id-1')

    const calls = seenUrls.filter((u) => u.includes('/pushers/set'))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/pushers/set`)
  })
})
