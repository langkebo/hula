import type { MatrixClient } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { matrixOidcService } from '../MatrixOidcService'

const resetOidcServiceState = () => {
  const service = matrixOidcService as unknown as {
    discovery: unknown | null
    homeserverUrl: string
  }
  service.discovery = null
  service.homeserverUrl = ''
}

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => null as MatrixClient | null)
  },
  default: {
    getClient: vi.fn(() => null as MatrixClient | null)
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
}))

describe('MatrixOidcService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://issuer.example.com',
          authorization_endpoint: 'https://issuer.example.com/auth',
          token_endpoint: 'https://issuer.example.com/token',
          userinfo_endpoint: 'https://issuer.example.com/userinfo',
          jwks_uri: 'https://issuer.example.com/jwks',
          response_types_supported: ['code'],
          subject_types_supported: ['public']
        })
      })
    )

    const discovered = await matrixOidcService.discoverOidc('https://hs.example.com')
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
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'oidc-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'oidc-refresh-token'
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    sessionStorage.setItem('oidc_state', 'expected-state')
    sessionStorage.setItem('oidc_code_verifier', 'verifier')
    sessionStorage.setItem('oidc_homeserver_url', 'https://hs.example.com')

    const result = await matrixOidcService.handleCallback('code-123', 'expected-state')

    expect(result?.access_token).toBe('oidc-token')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hs.example.com/_matrix/client/v3/oidc/token',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
    )
  })

  it('should return null user info when runtime client missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          issuer: 'https://issuer.example.com',
          authorization_endpoint: 'https://issuer.example.com/auth',
          token_endpoint: 'https://issuer.example.com/token',
          userinfo_endpoint: 'https://issuer.example.com/userinfo',
          jwks_uri: 'https://issuer.example.com/jwks',
          response_types_supported: ['code'],
          subject_types_supported: ['public']
        })
      })
    )
    await matrixOidcService.discoverOidc('https://hs.example.com')
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    const userInfo = await matrixOidcService.getUserInfo()

    expect(userInfo).toBeNull()
  })
})
