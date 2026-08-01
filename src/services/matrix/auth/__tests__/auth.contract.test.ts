/**
 * Auth service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Unlike the unit tests in MatrixAuthService.test.ts which vi.mock the SDK
 * entirely, these tests use a REAL SDK client so URL construction, prefix
 * handling, and the /_matrix/client/v3 prefix actually execute.
 *
 * If a service method passes a fully-prefixed path (/_matrix/client/v3/...)
 * to client.http.authedRequest, the SDK will double-prepend the prefix,
 * producing /_matrix/client/v3/_matrix/client/v3/... — the MSW handler
 * won't match and the test will FAIL.
 */
import { createClient, extendMatrixClientWithManagers, type MatrixClient } from 'matrix-js-sdk'
import { extendMatrixClient as extendSaml } from 'matrix-js-sdk/saml'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { MatrixAuthService } from '../MatrixAuthService'

const HOMESERVER = 'https://hs.auth-contract.test'

// Track every URL that hits MSW
const seenUrls: string[] = []

// Create a REAL SDK client (not mocked)
let realClient: MatrixClient

// Mock MatrixClientService.getClient to return the real client
vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: () => realClient,
    getHomeserverUrl: () => HOMESERVER,
    login: vi.fn()
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
  http.get(`${HOMESERVER}/_matrix/client/v3/account/whoami`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({ user_id: '@test:hs.auth-contract.test', device_id: 'DEV1' })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/capabilities`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({ capabilities: {} })
  }),
  http.post(`${HOMESERVER}/_matrix/client/v3/logout`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({})
  }),
  http.get(`${HOMESERVER}/_matrix/client/r0/saml/metadata`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({ enabled: true })
  })
)

describe('MatrixAuthService URL construction contract (real SDK + msw)', () => {
  beforeAll(async () => {
    // Register manager getters (getCapabilitiesManager, getAccountManager,
    // getAuthManager, ...) on MatrixClient.prototype. Without this, createClient()
    // returns a bare client with no manager methods (under Vitest the SDK skips
    // its async auto-init, so the registration must be explicit).
    await extendMatrixClientWithManagers()
    // The saml module is not wired into extendMatrixClientWithManagers() in the
    // current SDK build, so register getSamlAuthManager explicitly here.
    extendSaml()
  })

  beforeEach(() => {
    seenUrls.length = 0
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.auth-contract.test',
      deviceId: 'DEV1'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('whoami hits /_matrix/client/v3/account/whoami exactly once (no duplication)', async () => {
    await MatrixAuthService.whoami()

    const whoamiCalls = seenUrls.filter((u) => u.includes('/whoami'))
    expect(whoamiCalls).toHaveLength(1)
    expect(whoamiCalls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/account/whoami`)
  })

  it('getCapabilities hits /_matrix/client/v3/capabilities exactly once (no duplication)', async () => {
    await MatrixAuthService.getCapabilities()

    const capCalls = seenUrls.filter((u) => u.includes('/capabilities'))
    expect(capCalls).toHaveLength(1)
    expect(capCalls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/capabilities`)
  })

  it('logout hits /_matrix/client/v3/logout exactly once (no duplication)', async () => {
    await MatrixAuthService.logout()

    const logoutCalls = seenUrls.filter((u) => u.includes('/logout'))
    expect(logoutCalls).toHaveLength(1)
    expect(logoutCalls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/logout`)
  })

  it('getSamlMetadata hits /_matrix/client/r0/saml/metadata exactly once (no duplication)', async () => {
    await MatrixAuthService.getSamlMetadata()

    const samlCalls = seenUrls.filter((u) => u.includes('/saml/metadata'))
    expect(samlCalls).toHaveLength(1)
    expect(samlCalls[0]).toBe(`${HOMESERVER}/_matrix/client/r0/saml/metadata`)
  })
})
