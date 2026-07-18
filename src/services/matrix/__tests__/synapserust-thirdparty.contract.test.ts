/**
 * SynapseRustExtensionsService thirdparty contract tests — MSW intercepts at
 * the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute.
 * Catches URL double-prefix bugs that vi.mock tests miss.
 *
 * The 3 thirdparty methods (getThirdpartyProtocols, getThirdpartyLocation,
 * getThirdpartyUser) call `client.http.authedRequest` directly with paths
 * that used to be `${PREFIX_V3}/thirdparty/...` (i.e. `/_matrix/client/v3/...`).
 * The SDK re-prepended `/_matrix/client/v3`, producing
 * `/_matrix/client/v3/_matrix/client/v3/thirdparty/...` and a 404 in
 * production. The existing vi.mock test never noticed because it mocked
 * `matrixClientService.getClient()` with a stub client whose `authedRequest`
 * didn't run real SDK URL construction. This test locks in the short-path fix.
 */
import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { synapseRustExtensionsService } from '../SynapseRustExtensionsService'

const HOMESERVER = 'https://hs.synapserust-contract.test'
const seenUrls: { method: string; url: string }[] = []
let realClient: MatrixClient

vi.mock('../MatrixClientService', () => {
  // SynapseRustExtensionsService imports the named `matrixClientService`
  // export. Lazy getters reference `realClient` so vi.mock hoisting is safe.
  const instance = {
    getClient: (): MatrixClient => realClient,
    getHomeserverUrl: () => HOMESERVER,
    getAccessToken: () => 'contract-at',
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

// Transitive deps of SynapseRustExtensionsService — stubbed so the module
// loads cleanly. The thirdparty methods don't exercise runtimeFetch,
// EndpointCapabilityService, or MatrixCapabilityService.
vi.mock('../network/runtimeFetch', () => ({
  getRuntimeAwareFetch: vi.fn(() => vi.fn())
}))
vi.mock('../EndpointCapabilityService', () => ({
  default: { check: vi.fn(() => Promise.resolve(true)), clear: vi.fn() }
}))
vi.mock('../MatrixCapabilityService', () => ({
  matrixCapabilityService: { canUseFriendList: vi.fn(() => true) }
}))

setupMswServer(
  http.get(`${HOMESERVER}/_matrix/client/v3/thirdparty/protocols`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ irc: {}, matrix: {} })
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/thirdparty/location/:protocol`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json([{ alias: '#room:hs', protocol: 'irc' }])
  }),
  http.get(`${HOMESERVER}/_matrix/client/v3/thirdparty/user/:protocol`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json([{ user_id: '@nick:hs', protocol: 'irc' }])
  })
)

describe('SynapseRustExtensionsService thirdparty URL construction contract (real SDK + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.synapserust-contract.test',
      deviceId: 'DEV1'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('getThirdpartyProtocols hits /_matrix/client/v3/thirdparty/protocols (no duplication)', async () => {
    const result = await synapseRustExtensionsService.getThirdpartyProtocols()

    expect(seenUrls).toHaveLength(1)
    expect(seenUrls[0].method).toBe('GET')
    expect(seenUrls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/thirdparty/protocols`)
    expect(seenUrls[0].url).not.toMatch(/\/_matrix\/client\/v3\/_matrix\/client\/v3/)
    expect(result).toHaveProperty('irc')
    expect(result).toHaveProperty('matrix')
  })

  it('getThirdpartyLocation hits /_matrix/client/v3/thirdparty/location/{protocol} with query params (no duplication)', async () => {
    const result = await synapseRustExtensionsService.getThirdpartyLocation('irc', {
      field: 'value',
      search: 'room'
    })

    expect(seenUrls).toHaveLength(1)
    expect(seenUrls[0].method).toBe('GET')
    expect(seenUrls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/thirdparty/location/irc?field=value&search=room`)
    expect(seenUrls[0].url).not.toMatch(/\/_matrix\/client\/v3\/_matrix\/client\/v3/)
    expect(result).toHaveLength(1)
    expect(result[0].alias).toBe('#room:hs')
  })

  it('getThirdpartyUser hits /_matrix/client/v3/thirdparty/user/{protocol} (no duplication)', async () => {
    const result = await synapseRustExtensionsService.getThirdpartyUser('irc', { user: 'nick' })

    expect(seenUrls).toHaveLength(1)
    expect(seenUrls[0].method).toBe('GET')
    expect(seenUrls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/thirdparty/user/irc?user=nick`)
    expect(seenUrls[0].url).not.toMatch(/\/_matrix\/client\/v3\/_matrix\/client\/v3/)
    expect(result).toHaveLength(1)
    expect(result[0].user_id).toBe('@nick:hs')
  })

  it('all thirdparty methods return empty/null result when client missing (no HTTP call)', async () => {
    const previousClient = realClient
    realClient = null as unknown as MatrixClient
    try {
      const protocols = await synapseRustExtensionsService.getThirdpartyProtocols()
      const locations = await synapseRustExtensionsService.getThirdpartyLocation('irc')
      const users = await synapseRustExtensionsService.getThirdpartyUser('irc')

      expect(protocols).toEqual({})
      expect(locations).toEqual([])
      expect(users).toEqual([])
      expect(seenUrls).toHaveLength(0)
    } finally {
      realClient = previousClient
    }
  })
})
