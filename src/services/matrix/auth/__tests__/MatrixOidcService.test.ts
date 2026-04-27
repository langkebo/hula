import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { matrixOidcService } from '../MatrixOidcService'

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn()
  },
  default: {
    getClient: vi.fn()
  }
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn()
}))

describe('MatrixOidcService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
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
    vi.mocked(matrixClientService.getClient).mockReturnValue(null as any)

    const userInfo = await matrixOidcService.getUserInfo()

    expect(userInfo).toBeNull()
  })
})
