import type { LoginResponse, MatrixClient } from 'matrix-js-sdk'

export async function loginByHttpFallback(params: {
  homeserverUrl: string
  username: string
  password: string
  deviceName?: string
  runtimeFetch: typeof fetch
  missingConfigMessage: string
  loginFailedWithStatus: (status: number) => string
}): Promise<LoginResponse> {
  const { homeserverUrl, username, password, deviceName, runtimeFetch, missingConfigMessage, loginFailedWithStatus } =
    params

  if (!homeserverUrl) {
    throw new Error(missingConfigMessage)
  }

  const response = await runtimeFetch(`${homeserverUrl.replace(/\/+$/, '')}/_matrix/client/v3/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'm.login.password',
      user: username,
      password,
      initial_device_display_name: deviceName || 'HuLa Client'
    })
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || loginFailedWithStatus(response.status))
  }

  return (await response.json()) as LoginResponse
}

export async function loginWithPassword(params: {
  client: MatrixClient
  username: string
  password: string
  deviceName?: string
  isMatrixApiError: (error: unknown) => boolean
  fallbackLogin: () => Promise<LoginResponse>
  onFallback: (error: unknown) => void
}): Promise<LoginResponse> {
  const { client, username, password, deviceName, isMatrixApiError, fallbackLogin, onFallback } = params

  try {
    return await client.login('m.login.password', {
      user: username,
      password,
      initial_device_display_name: deviceName || 'HuLa Client'
    })
  } catch (error) {
    if (isMatrixApiError(error)) {
      throw error
    }

    onFallback(error)
    return fallbackLogin()
  }
}

export async function resolveSsoLoginUrl(params: {
  client: MatrixClient
  identityProviderId?: string
  returnUrl: string
  unsupportedMessage: string
}): Promise<string> {
  const { client, identityProviderId, returnUrl, unsupportedMessage } = params
  const loginFlow = await client.loginFlows()
  const ssoFlow = loginFlow.flows.find((flow: Record<string, unknown>) => flow.type === 'm.login.sso')

  if (!ssoFlow) {
    throw new Error(unsupportedMessage)
  }

  return client.getSsoLoginUrl(returnUrl, 'HuLa Client', identityProviderId)
}

export async function completeSsoTokenLogin(client: MatrixClient, loginToken: string): Promise<LoginResponse> {
  return await client.login('m.login.token', {
    token: loginToken
  })
}

export async function refreshAccessToken(
  client: MatrixClient,
  refreshToken: string
): Promise<{
  accessToken?: string
  refreshToken?: string
  expiresInMs?: number
}> {
  const result = (await client.http.authedRequest('POST', '/_matrix/client/v3/refresh', undefined, {
    refresh_token: refreshToken
  })) as Record<string, unknown>

  return {
    accessToken: result.access_token as string | undefined,
    refreshToken: result.refresh_token as string | undefined,
    expiresInMs: result.expires_in_ms as number | undefined
  }
}
