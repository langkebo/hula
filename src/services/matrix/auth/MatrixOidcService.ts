import { info, error as logError } from '@tauri-apps/plugin-log'
import { matrixClientService } from '../MatrixClientService'

export interface OidcDiscoveryDocument {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
  jwks_uri: string
  registration_endpoint?: string
  scopes_supported?: string[]
  response_types_supported: string[]
  response_modes_supported?: string[]
  grant_types_supported?: string[]
  subject_types_supported: string[]
  id_token_signing_alg_values_supported?: string[]
  token_endpoint_auth_methods_supported?: string[]
  code_challenge_methods_supported?: string[]
}

export interface OidcUserInfo {
  sub: string
  name?: string
  picture?: string
  email?: string
}

export interface OidcAuthorizationUrlParams {
  redirectUri: string
  state?: string
  codeChallenge?: string
  codeChallengeMethod?: string
}

export interface OidcTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  id_token?: string
}

const OIDC_DISCOVERY_PATH = '/.well-known/openid-configuration'
const DEFAULT_OIDC_SCOPES = ['openid', 'profile', 'email']
const OIDC_HOMESERVER_STORAGE_KEY = 'oidc_homeserver_url'

class MatrixOidcService {
  private discovery: OidcDiscoveryDocument | null = null
  private homeserverUrl: string = ''

  async discoverOidc(homeserverUrl: string): Promise<OidcDiscoveryDocument | null> {
    try {
      info(`[MatrixOidcService] Discovering OIDC for ${homeserverUrl}`)
      this.setHomeserverUrl(homeserverUrl)

      const url = `${homeserverUrl}${OIDC_DISCOVERY_PATH}`

      const response = await fetch(url)
      if (!response.ok) {
        logError(`[MatrixOidcService] OIDC discovery failed: ${response.status}`)
        return null
      }

      const discovery: OidcDiscoveryDocument = await response.json()
      this.discovery = discovery
      info(`[MatrixOidcService] OIDC discovered successfully. Issuer: ${discovery.issuer}`)
      return discovery
    } catch (err) {
      logError(`[MatrixOidcService] OIDC Discovery failed: ${err}`)
      return null
    }
  }

  isOidcEnabled(): boolean {
    return this.discovery !== null && this.resolveHomeserverUrl() !== ''
  }

  getHomeserverUrl(): string {
    return this.resolveHomeserverUrl()
  }

  async getAuthorizationUrl(params: OidcAuthorizationUrlParams): Promise<string | null> {
    if (!this.discovery) {
      logError('[MatrixOidcService] OIDC not discovered. Call discoverOidc first.')
      return null
    }

    try {
      const state = params.state || this.generateRandomString(32)
      const codeChallenge =
        params.codeChallenge || (await this.generateCodeChallenge(params.codeChallengeMethod || 'S256'))

      const url = new URL(this.discovery.authorization_endpoint)
      url.searchParams.set('client_id', 'matrix-client')
      url.searchParams.set('response_type', 'code')
      url.searchParams.set('scope', DEFAULT_OIDC_SCOPES.join(' '))
      url.searchParams.set('redirect_uri', params.redirectUri)
      url.searchParams.set('state', state)
      url.searchParams.set('code_challenge', codeChallenge)
      url.searchParams.set('code_challenge_method', params.codeChallengeMethod || 'S256')

      sessionStorage.setItem('oidc_state', state)
      sessionStorage.setItem('oidc_code_verifier', await this.getCodeVerifier())

      info(`[MatrixOidcService] Generated authorization URL`)
      return url.toString()
    } catch (err) {
      logError(`[MatrixOidcService] Error generating auth URL: ${err}`)
      return null
    }
  }

  async handleCallback(code: string, state: string): Promise<OidcTokenResponse | null> {
    const savedState = sessionStorage.getItem('oidc_state')
    const codeVerifier = sessionStorage.getItem('oidc_code_verifier')
    const homeserverUrl = this.resolveHomeserverUrl()

    if (!savedState || savedState !== state) {
      logError('[MatrixOidcService] Invalid OIDC state')
      return null
    }

    if (!codeVerifier) {
      logError('[MatrixOidcService] Missing code verifier')
      return null
    }

    if (!homeserverUrl) {
      logError('[MatrixOidcService] Missing homeserver URL for OIDC callback')
      return null
    }

    try {
      info(`[MatrixOidcService] Exchanging authorization code for tokens`)

      const response = await fetch(`${homeserverUrl}/_matrix/client/v3/oidc/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: `${window.location.origin}/oidc/callback`,
          code_verifier: codeVerifier
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        logError(`[MatrixOidcService] Token exchange failed: ${response.status} - ${errorText}`)
        return null
      }

      const tokenResponse: OidcTokenResponse = await response.json()
      info(`[MatrixOidcService] Token exchange successful`)

      sessionStorage.removeItem('oidc_state')
      sessionStorage.removeItem('oidc_code_verifier')

      return tokenResponse
    } catch (err) {
      logError(`[MatrixOidcService] Error handling callback: ${err}`)
      return null
    }
  }

  async getUserInfo(): Promise<OidcUserInfo | null> {
    if (!this.discovery) {
      logError('[MatrixOidcService] OIDC not discovered')
      return null
    }

    try {
      const client = matrixClientService.getClient()
      if (!client) {
        logError('[MatrixOidcService] Matrix client not initialized')
        return null
      }

      const userInfo = await client.oidcUserInfo()
      return userInfo as unknown as OidcUserInfo
    } catch (err) {
      logError(`[MatrixOidcService] Error getting user info: ${err}`)
      return null
    }
  }

  async logout(): Promise<boolean> {
    const homeserverUrl = this.resolveHomeserverUrl()
    if (!homeserverUrl) {
      logError('[MatrixOidcService] Missing homeserver URL for OIDC logout')
      return false
    }

    try {
      info(`[MatrixOidcService] Logging out via OIDC`)

      const response = await fetch(`${homeserverUrl}/_matrix/client/v3/oidc/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        logError(`[MatrixOidcService] OIDC logout failed: ${response.status}`)
        return false
      }

      info(`[MatrixOidcService] OIDC logout successful`)
      return true
    } catch (err) {
      logError(`[MatrixOidcService] Error during OIDC logout: ${err}`)
      return false
    }
  }

  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    let result = ''
    const randomValues = new Uint8Array(length)
    crypto.getRandomValues(randomValues)
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length]
    }
    return result
  }

  private async generateCodeChallengeMethodS256(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(codeVerifier)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = new Uint8Array(hashBuffer)
    return btoa(String.fromCharCode(...hashArray))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  private async generateCodeChallenge(method: string = 'S256'): Promise<string> {
    const codeVerifier = this.generateRandomString(64)
    sessionStorage.setItem('oidc_code_verifier', codeVerifier)

    if (method === 'S256') {
      return this.generateCodeChallengeMethodS256(codeVerifier)
    }
    return codeVerifier
  }

  private async getCodeVerifier(): Promise<string> {
    return sessionStorage.getItem('oidc_code_verifier') || this.generateRandomString(64)
  }

  async exchangeOidcForMatrixToken(
    oidcAccessToken: string,
    oidcRefreshToken?: string
  ): Promise<{ user_id: string; access_token: string; device_id: string; refresh_token?: string } | null> {
    const homeserverUrl = this.resolveHomeserverUrl()
    if (!homeserverUrl) {
      logError('[MatrixOidcService] Missing homeserver URL for OIDC token exchange')
      return null
    }

    try {
      info(`[MatrixOidcService] Exchanging OIDC token for Matrix token`)

      const response = await fetch(`${homeserverUrl}/_matrix/client/v3/oidc/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'urn:matrix:oidc:grant-type:token-exchange',
          oidc_access_token: oidcAccessToken,
          oidc_refresh_token: oidcRefreshToken
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        logError(`[MatrixOidcService] Token exchange failed: ${response.status} - ${errorText}`)
        return null
      }

      const result = await response.json()
      info(`[MatrixOidcService] OIDC to Matrix token exchange successful`)
      return result
    } catch (err) {
      logError(`[MatrixOidcService] Error exchanging OIDC for Matrix token: ${err}`)
      return null
    }
  }

  private setHomeserverUrl(homeserverUrl: string): void {
    this.homeserverUrl = homeserverUrl
    sessionStorage.setItem(OIDC_HOMESERVER_STORAGE_KEY, homeserverUrl)
  }

  private resolveHomeserverUrl(): string {
    if (this.homeserverUrl) {
      return this.homeserverUrl
    }

    const storedHomeserverUrl = sessionStorage.getItem(OIDC_HOMESERVER_STORAGE_KEY)?.trim() || ''
    if (storedHomeserverUrl) {
      this.homeserverUrl = storedHomeserverUrl
    }

    return this.homeserverUrl
  }
}

export const matrixOidcService = new MatrixOidcService()
