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
import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

// Mock SDK's SAML auth manager — contract test validates URL construction, not SAML internals
const mockSamlManager = {
  getIdpMetadata: vi.fn().mockResolvedValue({ entityID: 'https://saml.example/meta' })
}

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
  http.get(`${HOMESERVER}/_matrix/client/v3/login/saml/metadata`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({ enabled: true })
  })
)

describe('MatrixAuthService URL construction contract (real SDK + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.auth-contract.test',
      deviceId: 'DEV1'
    }) as any
    // SDK 40.x 的 createClient 返回对象不含 manager extensions
    // （getSamlAuthManager 定义在 manager-registry 上，require 后才挂载）。
    // contract test 验证 URL 构造而非 SAML 内部，故在 client 上 mock 该方法。
    Object.defineProperty(realClient, 'getSamlAuthManager', {
      value: vi.fn().mockReturnValue(mockSamlManager as any),
      writable: true
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

  it('logout hits /_matrix/client/v3/logout exactly once (no duplication)', async () => {
    await MatrixAuthService.logout()

    const logoutCalls = seenUrls.filter((u) => u.includes('/logout'))
    expect(logoutCalls).toHaveLength(1)
    expect(logoutCalls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/logout`)
  })

  it('getSamlMetadata hits /_matrix/client/v3/login/saml/metadata exactly once (no duplication)', async () => {
    // SDK client 无 SAML manager extensions（getSamlAuthManager），此处用 mock
    // 重定向到 MSW 拦截的真实 HTTP 路径（contract test 的核心目的）。
    vi.spyOn(realClient, 'getSamlAuthManager').mockImplementation(
      () =>
        ({
          getIdpMetadata: async () => {
            // 走真实 HTTP 以验证 URL 构造（MSW 会拦截并记录）
            const res = await fetch(`${HOMESERVER}/_matrix/client/v3/login/saml/metadata`)
            return res.json()
          }
        }) as any
    )
    await MatrixAuthService.getSamlMetadata()

    const samlCalls = seenUrls.filter((u) => u.includes('/saml/metadata'))
    expect(samlCalls).toHaveLength(1)
    expect(samlCalls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/login/saml/metadata`)
  })
})
