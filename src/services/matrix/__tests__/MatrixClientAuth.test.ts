import { describe, expect, it, vi } from 'vitest'
import { MatrixClientAuth, resolveStableDeviceId } from '@/services/matrix/MatrixClientAuth'
import { loginByHttpFallback, tokenLoginByHttpFallback } from '@/services/matrix/MatrixClientAuthHttp'
import { persistRefreshedToken } from '@/services/matrix/matrixClientPlatform'
import { clearCryptoStoragePasswordCache, deleteCryptoStoragePassword } from '@/services/secure/cryptoStorageKey'
import { AvatarUtils } from '@/utils/AvatarUtils'

// ---- 依赖 mock（白盒：不依赖真实 SDK / 网络）-----------------------------------

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), trace: vi.fn() })
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('@/services/matrix/MatrixClientAuthHttp', () => ({
  loginByHttpFallback: vi.fn(),
  tokenLoginByHttpFallback: vi.fn()
}))

vi.mock('@/services/matrix/matrixClientPlatform', () => ({
  persistRefreshedToken: vi.fn(),
  setupSystemResumeListener: vi.fn()
}))

vi.mock('@/services/secure/cryptoStorageKey', () => ({
  clearCryptoStoragePasswordCache: vi.fn(),
  deleteCryptoStoragePassword: vi.fn()
}))

vi.mock('@/utils/AvatarUtils', () => ({
  AvatarUtils: { setMxcResolver: vi.fn() }
}))

// ---- 测试工具 ----------------------------------------------------------------

function makeClient() {
  return {
    loginRequest: vi.fn(),
    login: vi.fn(),
    loginFlows: vi.fn(),
    getSsoLoginUrl: vi.fn(() => 'http://sso.url'),
    refreshToken: vi.fn(),
    setAccessToken: vi.fn(),
    getUserId: vi.fn(() => '@alice:hs'),
    getDeviceId: vi.fn(() => 'DEV1'),
    logout: vi.fn(async () => undefined)
  }
}

function makeConnectionManager() {
  return {
    client: null as ReturnType<typeof makeClient> | null,
    config: null as Record<string, unknown> | null,
    getClient: vi.fn(),
    getConfig: vi.fn(),
    updateConnectionState: vi.fn(),
    setClient: vi.fn()
  }
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  const connectionManager = makeConnectionManager()
  const deps = {
    connectionManager,
    eventRouter: { setSyncStateHandler: vi.fn() },
    syncManager: { stop: vi.fn() },
    cryptoTracker: { clearCryptoStoreForLogout: vi.fn(() => Promise.resolve()) },
    tokenManager: { schedule: vi.fn(), clear: vi.fn() },
    lifecycle: {
      initialize: vi.fn(async () => undefined),
      stopClient: vi.fn(async () => undefined),
      resolveDeviceIdByWhoami: vi.fn<() => Promise<string | undefined>>(async () => undefined)
    },
    startClientGuard: { reset: vi.fn() },
    ...overrides
  }
  return deps
}

function makeAuth() {
  const deps = makeDeps()
  const auth = new MatrixClientAuth(deps as never)
  const client = makeClient()
  return { auth, deps, client }
}

// 构造一个带默认成功响应的 loginResponse
function makeLoginResponse(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'token-1',
    user_id: '@alice:hs',
    device_id: 'DEV1',
    refresh_token: undefined,
    expires_in_ms: undefined,
    ...overrides
  }
}

describe('resolveStableDeviceId', () => {
  it('优先使用 config.deviceId', () => {
    expect(resolveStableDeviceId({ deviceId: 'CONF-DEV' } as never, 'GEN-DEV')).toBe('CONF-DEV')
  })

  it('config 无 deviceId 时回退到 clientGeneratedId', () => {
    expect(resolveStableDeviceId({} as never, 'GEN-DEV')).toBe('GEN-DEV')
  })

  it('两者皆无时返回 undefined', () => {
    expect(resolveStableDeviceId({} as never, undefined)).toBeUndefined()
  })
})

describe('MatrixClientAuth.login', () => {
  beforeEach(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('tjg.persistedDeviceId:')) localStorage.removeItem(key)
    }
  })

  it('无 client 时返回客户端未初始化', async () => {
    const { auth, deps } = makeAuth()
    const result = await auth.login('alice', 'pw')
    expect(result).toEqual({ success: false, error: '客户端未初始化' })
    expect(deps.lifecycle.initialize).not.toHaveBeenCalled()
  })

  it('登录成功并调度 refresh token 续期', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)
    deps.connectionManager.getConfig.mockReturnValue({ homeserverUrl: 'https://hs', deviceId: 'DEV1' })
    client.loginRequest.mockResolvedValue(makeLoginResponse({ refresh_token: 'rt', expires_in_ms: 3600000 }))

    const result = await auth.login('alice', 'pw', 'MyDevice')

    expect(client.loginRequest).toHaveBeenCalledWith({
      type: 'm.login.password',
      identifier: { type: 'm.id.user', user: 'alice' },
      password: 'pw',
      initial_device_display_name: 'MyDevice',
      device_id: 'DEV1'
    })
    expect(deps.connectionManager.updateConnectionState).toHaveBeenCalledWith('CONNECTED')
    expect(deps.lifecycle.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'token-1', userId: '@alice:hs', deviceId: 'DEV1' })
    )
    expect(deps.tokenManager.schedule).toHaveBeenCalledWith(client, 'rt', 3600000)
    expect(result).toEqual({
      success: true,
      userId: '@alice:hs',
      deviceId: 'DEV1',
      accessToken: 'token-1',
      refreshToken: 'rt'
    })
  })

  it('SDK 登录失败时回退到 HTTP 登录', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)
    deps.connectionManager.getConfig.mockReturnValue({ homeserverUrl: 'https://hs' })
    client.loginRequest.mockRejectedValue(new Error('fetch failed'))
    ;(loginByHttpFallback as ReturnType<typeof vi.fn>).mockResolvedValue(makeLoginResponse({ device_id: 'FB-DEV' }))

    const result = await auth.login('alice', 'pw')

    expect(loginByHttpFallback).toHaveBeenCalledWith('https://hs', 'alice', 'pw', undefined)
    expect(result.success).toBe(true)
    expect(result.deviceId).toBe('FB-DEV')
  })

  it('SDK 登录失败且无 homeserverUrl 时返回配置缺失错误', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)
    deps.connectionManager.getConfig.mockReturnValue({})
    client.loginRequest.mockRejectedValue(new Error('fetch failed'))

    const result = await auth.login('alice', 'pw')

    expect(result.success).toBe(false)
    expect(result.error).toBe('matrix_error.auth.client_config_missing')
    expect(deps.connectionManager.updateConnectionState).toHaveBeenCalledWith('ERROR')
  })

  it('HTTP 回退也失败时返回错误并置 ERROR 状态', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)
    deps.connectionManager.getConfig.mockReturnValue({ homeserverUrl: 'https://hs' })
    client.loginRequest.mockRejectedValue(new Error('fetch failed'))
    ;(loginByHttpFallback as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('http fallback failed'))

    const result = await auth.login('alice', 'pw')

    expect(result).toEqual({ success: false, error: 'http fallback failed' })
    expect(deps.connectionManager.updateConnectionState).toHaveBeenCalledWith('ERROR')
  })

  it('复用持久化 deviceId 作为 device_id 登录，避免累积新设备', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)
    deps.connectionManager.getConfig.mockReturnValue({ homeserverUrl: 'https://hs' })
    localStorage.setItem('tjg.persistedDeviceId:alice', 'PERSISTED-DEV')
    client.loginRequest.mockResolvedValue(makeLoginResponse({ device_id: 'PERSISTED-DEV' }))

    await auth.login('alice', 'pw', 'MyDevice')

    expect(client.loginRequest).toHaveBeenCalledWith(expect.objectContaining({ device_id: 'PERSISTED-DEV' }))
  })

  it('登录成功后持久化 deviceId，供下次登录复用', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)
    deps.connectionManager.getConfig.mockReturnValue({ homeserverUrl: 'https://hs' })
    client.loginRequest.mockResolvedValue(makeLoginResponse({ device_id: 'NEW-DEV' }))

    await auth.login('alice', 'pw')

    expect(localStorage.getItem('tjg.persistedDeviceId:alice')).toBe('NEW-DEV')
  })
})

describe('MatrixClientAuth.getSSOLoginUrl', () => {
  it('无 client 时抛出未初始化错误', async () => {
    const { auth } = makeAuth()
    await expect(auth.getSSOLoginUrl()).rejects.toThrow('matrix_error.common.client_not_initialized')
  })

  it('返回 SSO 登录 URL', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)
    client.loginFlows.mockResolvedValue({ flows: [{ type: 'm.login.sso' }] })

    const url = await auth.getSSOLoginUrl('oidc-provider')

    expect(client.getSsoLoginUrl).toHaveBeenCalledWith(window.location.href, 'Tjg Client', 'oidc-provider')
    expect(url).toBe('http://sso.url')
  })

  it('无 sso flow 时抛出不支持错误', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)
    client.loginFlows.mockResolvedValue({ flows: [{ type: 'm.login.password' }] })

    await expect(auth.getSSOLoginUrl()).rejects.toThrow('matrix_error.auth.sso_not_supported')
  })

  it('loginFlows 抛错时向上抛出', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)
    client.loginFlows.mockRejectedValue(new Error('network down'))

    await expect(auth.getSSOLoginUrl()).rejects.toThrow('network down')
  })
})

describe('MatrixClientAuth.completeSSOLogin', () => {
  beforeEach(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('tjg.persistedDeviceId:')) localStorage.removeItem(key)
    }
  })

  it('无 client 时返回客户端未初始化', async () => {
    const { auth } = makeAuth()
    const result = await auth.completeSSOLogin('sso-token')
    expect(result).toEqual({ success: false, error: '客户端未初始化' })
  })

  it('SSO 登录成功', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)
    client.login.mockResolvedValue(makeLoginResponse())

    const result = await auth.completeSSOLogin('sso-token')

    expect(client.login).toHaveBeenCalledWith('m.login.token', { token: 'sso-token' })
    expect(result.success).toBe(true)
    expect(deps.lifecycle.initialize).toHaveBeenCalled()
  })

  it('SDK 登录失败时经 tokenLoginByHttpFallback 回退', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)
    deps.connectionManager.getConfig.mockReturnValue({ homeserverUrl: 'https://hs' })
    client.login.mockRejectedValue(new Error('fetch failed'))
    ;(tokenLoginByHttpFallback as ReturnType<typeof vi.fn>).mockResolvedValue(makeLoginResponse())

    const result = await auth.completeSSOLogin('sso-token')

    expect(tokenLoginByHttpFallback).toHaveBeenCalledWith('https://hs', 'sso-token')
    expect(result.success).toBe(true)
  })

  it('SSO 登录成功后持久化 deviceId，供下次登录复用', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)
    client.login.mockResolvedValue(makeLoginResponse({ user_id: '@alice:hs', device_id: 'SSO-DEV' }))

    await auth.completeSSOLogin('sso-token')

    expect(localStorage.getItem('tjg.persistedDeviceId:@alice:hs')).toBe('SSO-DEV')
  })
})

describe('MatrixClientAuth.loginWithToken', () => {
  it('无配置时返回配置未初始化', async () => {
    const { auth } = makeAuth()
    const result = await auth.loginWithToken('tok', '@alice:hs')
    expect(result).toEqual({ success: false, error: '配置未初始化' })
  })

  it('配置含 deviceId 时短路 whoami 并成功登录', async () => {
    const { auth, deps } = makeAuth()
    deps.connectionManager.getConfig.mockReturnValue({ homeserverUrl: 'https://hs', deviceId: 'CONF-DEV' })
    deps.connectionManager.getClient.mockReturnValue(null)

    const result = await auth.loginWithToken('tok', '@alice:hs')

    expect(deps.lifecycle.resolveDeviceIdByWhoami).not.toHaveBeenCalled()
    expect(deps.lifecycle.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'tok', userId: '@alice:hs', deviceId: 'CONF-DEV' })
    )
    expect(result.success).toBe(true)
    expect(result.deviceId).toBe('CONF-DEV')
  })

  it('配置无 deviceId 时通过 whoami 预解析', async () => {
    const { auth, deps } = makeAuth()
    deps.connectionManager.getConfig.mockReturnValue({ homeserverUrl: 'https://hs' })
    deps.connectionManager.getClient.mockReturnValue(null)
    deps.lifecycle.resolveDeviceIdByWhoami.mockResolvedValue('WHOAMI-DEV')

    const result = await auth.loginWithToken('tok', '@alice:hs')

    expect(deps.lifecycle.resolveDeviceIdByWhoami).toHaveBeenCalledWith('tok', 'https://hs')
    expect(result.success).toBe(true)
    expect(result.deviceId).toBe('WHOAMI-DEV')
  })

  it('提供 refreshToken 时刷新并持久化新 token', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getConfig.mockReturnValue({ homeserverUrl: 'https://hs', deviceId: 'DEV1' })
    deps.connectionManager.getClient.mockReturnValue(client)
    client.refreshToken.mockResolvedValue({
      access_token: 'new-token',
      refresh_token: 'new-rt',
      expires_in_ms: 7200000
    })

    const result = await auth.loginWithToken('tok', '@alice:hs', 'rt')

    expect(client.refreshToken).toHaveBeenCalledWith('rt')
    expect(client.setAccessToken).toHaveBeenCalledWith('new-token')
    expect(persistRefreshedToken).toHaveBeenCalledWith('@alice:hs', 'new-token', 'new-rt')
    expect(deps.tokenManager.schedule).toHaveBeenCalledWith(client, 'new-rt', 7200000)
    expect(result.success).toBe(true)
    expect(result.accessToken).toBe('new-token')
  })

  it('refreshToken 不支持时静默降级仍返回成功', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getConfig.mockReturnValue({ homeserverUrl: 'https://hs', deviceId: 'DEV1' })
    deps.connectionManager.getClient.mockReturnValue(client)
    client.refreshToken.mockRejectedValue(new Error('unsupported'))

    const result = await auth.loginWithToken('tok', '@alice:hs', 'rt')

    expect(result.success).toBe(true)
    expect(result.accessToken).toBe('tok')
  })

  it('initialize 抛错时返回错误并置 ERROR 状态', async () => {
    const { auth, deps } = makeAuth()
    deps.connectionManager.getConfig.mockReturnValue({ homeserverUrl: 'https://hs', deviceId: 'DEV1' })
    deps.connectionManager.getClient.mockReturnValue(null)
    deps.lifecycle.initialize.mockRejectedValue(new Error('init failed'))

    const result = await auth.loginWithToken('tok', '@alice:hs')

    expect(result).toEqual({ success: false, error: 'init failed' })
    expect(deps.connectionManager.updateConnectionState).toHaveBeenCalledWith('ERROR')
  })
})

describe('MatrixClientAuth.logout', () => {
  it('无 client 时不执行任何清理', async () => {
    const { auth, deps } = makeAuth()
    await auth.logout()
    expect(deps.tokenManager.clear).not.toHaveBeenCalled()
    expect(deps.syncManager.stop).not.toHaveBeenCalled()
  })

  it('登出成功并清理全部状态', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)

    await auth.logout()

    expect(deps.tokenManager.clear).toHaveBeenCalled()
    expect(client.logout).toHaveBeenCalled()
    expect(deps.lifecycle.stopClient).toHaveBeenCalled()
    expect(deps.syncManager.stop).toHaveBeenCalled()
    expect(AvatarUtils.setMxcResolver).toHaveBeenCalledWith(null)
    expect(deps.connectionManager.setClient).toHaveBeenCalledWith(null)
    expect(deps.connectionManager.updateConnectionState).toHaveBeenCalledWith('DISCONNECTED')
    expect(deps.startClientGuard.reset).toHaveBeenCalled()
    expect(deleteCryptoStoragePassword).toHaveBeenCalledWith('@alice:hs', 'DEV1')
    expect(clearCryptoStoragePasswordCache).toHaveBeenCalled()
    expect(deps.cryptoTracker.clearCryptoStoreForLogout).toHaveBeenCalledWith('@alice:hs')
  })

  it('client.logout 抛错时仍执行 finally 清理', async () => {
    const { auth, deps, client } = makeAuth()
    deps.connectionManager.getClient.mockReturnValue(client)
    client.logout.mockRejectedValue(new Error('logout failed'))

    await auth.logout()

    // finally 块仍执行清理
    expect(deps.connectionManager.updateConnectionState).toHaveBeenCalledWith('DISCONNECTED')
    expect(deps.startClientGuard.reset).toHaveBeenCalled()
    expect(clearCryptoStoragePasswordCache).toHaveBeenCalled()
  })
})
