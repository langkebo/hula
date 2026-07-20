import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import matrixClientService from '../../MatrixClientService'
import { matrixOidcService } from '../MatrixOidcService'

const TEST_BASE_URL = 'https://hs.example.com'

const _server = setupMswServer(
  http.get(`${TEST_BASE_URL}/.well-known/openid-configuration`, () => {
    return HttpResponse.json({
      issuer: 'https://issuer.example.com',
      authorization_endpoint: 'https://issuer.example.com/auth',
      token_endpoint: 'https://issuer.example.com/token',
      userinfo_endpoint: 'https://issuer.example.com/userinfo',
      jwks_uri: 'https://issuer.example.com/jwks',
      response_types_supported: ['code'],
      subject_types_supported: ['public']
    })
  }),
  http.post(`${TEST_BASE_URL}/_matrix/client/v3/oidc/token`, async ({ request }) => {
    const body = (await request.json()) as Record<string, string>
    if (body?.grant_type === 'urn:matrix:oidc:grant-type:token-exchange') {
      return HttpResponse.json({
        user_id: '@oidc:example.com',
        access_token: 'matrix-token',
        device_id: 'oidc-device',
        refresh_token: 'matrix-refresh'
      })
    }
    return HttpResponse.json({
      access_token: 'oidc-token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'oidc-refresh-token'
    })
  })
)

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
}))

const resetOidcServiceState = () => {
  const service = matrixOidcService as unknown as {
    discovery: unknown | null
    homeserverUrl: string
  }
  service.discovery = null
  service.homeserverUrl = ''
}

describe('MatrixOidcService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(matrixClientService, 'getClient').mockReturnValue(null)
    sessionStorage.clear()
    resetOidcServiceState()
  })

  it('should return null authorization url before discovery', async () => {
    const url = await matrixOidcService.getAuthorizationUrl({
      redirectUri: 'http://localhost/oidc/callback'
    })

    expect(url).toBeNull()
  })

  it('should discover oidc and generate authorization url', async () => {
    const discovered = await matrixOidcService.discoverOidc(TEST_BASE_URL)
    const url = await matrixOidcService.getAuthorizationUrl({
      redirectUri: 'http://localhost/oidc/callback',
      state: 'fixed-state'
    })

    expect(discovered?.issuer).toBe('https://issuer.example.com')
    expect(url).toContain('https://issuer.example.com/auth')
    expect(url).toContain('state=fixed-state')
  })

  it('should return null when callback state invalid', async () => {
    sessionStorage.setItem('oidc_state', 'expected-state')
    sessionStorage.setItem('oidc_code_verifier', 'verifier')

    const result = await matrixOidcService.handleCallback('code-123', 'wrong-state')

    expect(result).toBeNull()
  })

  it('should restore homeserver url from session storage during callback', async () => {
    sessionStorage.setItem('oidc_state', 'expected-state')
    sessionStorage.setItem('oidc_code_verifier', 'verifier')
    sessionStorage.setItem('oidc_homeserver_url', TEST_BASE_URL)

    const result = await matrixOidcService.handleCallback('code-123', 'expected-state')

    expect(result?.access_token).toBe('oidc-token')
  })

  it('should return null user info when runtime client missing', async () => {
    await matrixOidcService.discoverOidc(TEST_BASE_URL)
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    const userInfo = await matrixOidcService.getUserInfo()

    expect(userInfo).toBeNull()
  })
})
